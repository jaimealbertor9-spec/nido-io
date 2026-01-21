import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { resend } from '@/lib/resend';
import { PaymentSuccessEmail } from '@/components/emails/PaymentSuccessEmail';

// ═══════════════════════════════════════════════════════════════════════════════
// WOMPI WEBHOOK HANDLER
// Handles transaction.updated events from Wompi payment gateway
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: Request): Promise<Response> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('[WOMPI WEBHOOK] 📨 Received event at:', new Date().toISOString());

  // 🛡️ RUNTIME ENV LOADING (Read variables only at request time)
  const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET || '';
  const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET || '';
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  try {
    // Parse the webhook payload
    const evento = await request.json();
    console.log('[WOMPI WEBHOOK] Event type:', evento.event);

    // Validate event structure
    if (!evento.data?.transaction) {
      console.error('[WOMPI WEBHOOK] ❌ Invalid event structure - no transaction data');
      return Response.json({ success: false, error: 'Invalid structure' }, { status: 400 });
    }

    const { transaction } = evento.data;
    const { id, reference, status, amount_in_cents } = transaction;

    console.log('[WOMPI WEBHOOK] Transaction:', { id, reference, status, amount_in_cents });

    // ─────────────────────────────────────────────────────────────────────
    // STEP 1: VERIFY SIGNATURE (Using Events Secret or Integrity Secret)
    // ─────────────────────────────────────────────────────────────────────
    if (evento.signature?.checksum && (WOMPI_EVENTS_SECRET || WOMPI_INTEGRITY_SECRET)) {
      const secret = WOMPI_EVENTS_SECRET || WOMPI_INTEGRITY_SECRET;
      // Wompi checksum: SHA256(properties + timestamp + secret)
      const properties = evento.signature.properties || [];
      let signatureString = '';

      // Build signature string from properties
      for (const prop of properties) {
        const value = prop.split('.').reduce((obj: any, key: string) => obj?.[key], evento.data);
        signatureString += value;
      }
      signatureString += evento.timestamp + secret;

      const calculatedChecksum = createHash('sha256').update(signatureString).digest('hex');

      if (calculatedChecksum !== evento.signature.checksum) {
        console.error('[WOMPI WEBHOOK] ❌ Invalid signature');
        console.error('[WOMPI WEBHOOK] Expected:', evento.signature.checksum);
        console.error('[WOMPI WEBHOOK] Calculated:', calculatedChecksum);
        return Response.json({ success: false, error: 'Invalid signature' }, { status: 400 });
      }
      console.log('[WOMPI WEBHOOK] ✅ Signature verified');
    } else {
      console.log('[WOMPI WEBHOOK] ⚠️ Skipping signature verification (no secret configured)');
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 2: ONLY PROCESS APPROVED TRANSACTIONS
    // ─────────────────────────────────────────────────────────────────────
    if (status !== 'APPROVED') {
      console.log(`[WOMPI WEBHOOK] ℹ️ Transaction status is ${status}, not APPROVED. Acknowledging.`);
      return Response.json({ success: true, message: `Status ${status} acknowledged, no action needed` });
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: CONNECT TO DATABASE
    // ─────────────────────────────────────────────────────────────────────
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('[WOMPI WEBHOOK] ❌ Missing database configuration');
      // Return 200 to prevent Wompi retries, but log the error
      return Response.json({ success: false, error: 'Server configuration error' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    });

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4A: UPDATE PAYMENT RECORD (pagos table)
    // ─────────────────────────────────────────────────────────────────────
    console.log('[WOMPI WEBHOOK] 🔍 Looking for payment with reference:', reference);

    const { data: pago, error: pagoError } = await supabase
      .from('pagos')
      .update({
        estado: 'aprobado',
        wompi_transaction_id: id,
        respuesta_pasarela: evento,
        updated_at: new Date().toISOString()
      })
      .eq('referencia_pedido', reference)
      .select('id, inmueble_id, usuario_id')
      .single();

    if (pagoError || !pago) {
      console.error('[WOMPI WEBHOOK] ❌ Payment not found or update failed:', pagoError);
      console.log('[WOMPI WEBHOOK] Attempting to find inmueble from redirect_url or reference...');

      // ═══════════════════════════════════════════════════════════════════
      // NEW: Extract property ID from redirect_url (draftId passthrough)
      // This handles Wompi Payment Links with opaque references (test_...)
      // ═══════════════════════════════════════════════════════════════════
      let propertyId: string | null = null;
      const redirectUrl = transaction.redirect_url;

      // PRIORITY 1: Try to extract draftId from redirect_url
      if (redirectUrl && redirectUrl.includes('draftId=')) {
        console.log('[WOMPI WEBHOOK] 📋 Checking redirect_url for draftId:', redirectUrl);
        try {
          const urlObj = new URL(redirectUrl);
          propertyId = urlObj.searchParams.get('draftId');
        } catch (e) {
          // Fallback to regex if URL parsing fails
          const match = redirectUrl.match(/draftId=([a-f0-9-]+)/i);
          if (match) propertyId = match[1];
        }
        if (propertyId) {
          console.log('[WOMPI WEBHOOK] ✅ Extracted propertyId from redirect_url:', propertyId);
        }
      }

      // PRIORITY 2: Fallback to parsing reference (NIDO-XXXXXXXX-TIMESTAMP format)
      if (!propertyId) {
        const parts = reference.split('-');
        if (parts.length >= 2 && parts[0] === 'NIDO') {
          const shortId = parts[1];
          console.log('[WOMPI WEBHOOK] 🔍 Trying to match property from reference shortId:', shortId);

          const { data: matchedInmueble } = await supabase
            .from('inmuebles')
            .select('id')
            .ilike('id', `${shortId}%`)
            .limit(1)
            .single();

          if (matchedInmueble) {
            propertyId = matchedInmueble.id;
            console.log('[WOMPI WEBHOOK] ✅ Found property via reference parsing:', propertyId);
          }
        }
      }

      // If we found a property, create the payment and update
      if (propertyId) {
        const { data: inmueble } = await supabase
          .from('inmuebles')
          .select('id, propietario_id, titulo, ciudad, precio')
          .eq('id', propertyId)
          .single();

        if (inmueble) {
          // Fetch property details for email
          const propertyName = inmueble.titulo || undefined;
          const propertyLocation = inmueble.ciudad || undefined;
          const propertyPrice = inmueble.precio || undefined;
          // Insert new payment record
          const { data: newPago, error: insertError } = await supabase
            .from('pagos')
            .insert({
              referencia_pedido: reference,
              wompi_transaction_id: id,
              monto: amount_in_cents / 100,
              estado: 'aprobado',
              inmueble_id: inmueble.id,
              usuario_id: inmueble.propietario_id,
              metodo_pago: 'wompi_link',
              respuesta_pasarela: evento
            })
            .select('id, inmueble_id')
            .single();

          if (insertError) {
            console.error('[WOMPI WEBHOOK] ❌ Failed to insert payment:', insertError);
            return Response.json({ success: false, error: 'Failed to record payment' });
          }

          console.log('[WOMPI WEBHOOK] ✅ Payment created:', newPago?.id);

          // Continue with inmueble update using the new payment
          await updateInmueble(supabase, inmueble.id, newPago?.id);

          // Send confirmation email with property details
          const customerEmail = transaction.customer_email;
          const customerName = transaction.customer_data?.full_name || 'Usuario';
          await sendPaymentConfirmationEmail(customerEmail, customerName, propertyName, propertyLocation, propertyPrice);

          return Response.json({
            success: true,
            message: 'Payment created and inmueble updated via draftId passthrough',
            propertyId: inmueble.id
          });
        }
      }

      console.error('[WOMPI WEBHOOK] ❌ Could not determine property ID from redirect_url or reference');
      return Response.json({
        success: false,
        error: 'Payment reference not found',
        debug: { reference, redirectUrl: redirectUrl || 'not provided' }
      });
    }

    console.log('[WOMPI WEBHOOK] ✅ Payment updated:', pago.id);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4B: UPDATE INMUEBLE (Property table)
    // ─────────────────────────────────────────────────────────────────────
    if (pago.inmueble_id) {
      await updateInmueble(supabase, pago.inmueble_id, pago.id);
    } else {
      console.log('[WOMPI WEBHOOK] ⚠️ No inmueble_id associated with payment');
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 5: SEND CONFIRMATION EMAIL
    // ─────────────────────────────────────────────────────────────────────
    // Fetch property details for email
    let propertyName: string | undefined;
    let propertyLocation: string | undefined;
    let propertyPrice: number | undefined;

    if (pago.inmueble_id) {
      const { data: propertyData } = await supabase
        .from('inmuebles')
        .select('titulo, ciudad, precio')
        .eq('id', pago.inmueble_id)
        .single();

      if (propertyData) {
        propertyName = propertyData.titulo || undefined;
        propertyLocation = propertyData.ciudad || undefined;
        propertyPrice = propertyData.precio || undefined;
      }
    }

    const customerEmail = transaction.customer_email;
    const customerName = transaction.customer_data?.full_name || 'Usuario';
    await sendPaymentConfirmationEmail(customerEmail, customerName, propertyName, propertyLocation, propertyPrice);

    console.log('[WOMPI WEBHOOK] ✅ Webhook processing complete');
    console.log('═══════════════════════════════════════════════════════════════');

    return Response.json({
      success: true,
      message: 'Payment approved and property updated',
      pagoId: pago.id
    });

  } catch (error: any) {
    console.error('[WOMPI WEBHOOK] 💥 Unexpected error:', error.message);
    // Return 200 to prevent Wompi retries (we'll handle it manually if needed)
    return Response.json({
      success: false,
      error: error.message,
      note: 'Acknowledged to prevent retries'
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Update Inmueble after successful payment
// ─────────────────────────────────────────────────────────────────────────────
async function updateInmueble(supabase: any, inmuebleId: string, pagoId: string | undefined) {
  const now = new Date();
  const expiration = new Date(now);
  expiration.setDate(expiration.getDate() + 30); // 30 days from now

  console.log('[WOMPI WEBHOOK] 📝 Updating inmueble:', inmuebleId);

  const { error: inmuebleError } = await supabase
    .from('inmuebles')
    .update({
      estado: 'en_revision',
      pago_id: pagoId,
      fecha_publicacion: now.toISOString(),
      fecha_expiracion: expiration.toISOString(),
      updated_at: now.toISOString()
    })
    .eq('id', inmuebleId);

  if (inmuebleError) {
    console.error('[WOMPI WEBHOOK] ❌ Failed to update inmueble:', inmuebleError);
  } else {
    console.log('[WOMPI WEBHOOK] ✅ Inmueble updated to en_revision with 30-day expiration');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Send payment confirmation email
// ─────────────────────────────────────────────────────────────────────────────
async function sendPaymentConfirmationEmail(
  email: string | undefined,
  nombre: string,
  propertyName?: string,
  propertyLocation?: string,
  propertyPrice?: number
) {
  if (!email) {
    console.log('[WOMPI WEBHOOK] ⚠️ No customer email provided, skipping email notification');
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Nido <onboarding@resend.dev>',
      to: email,
      subject: '¡Pago Recibido! Tu inmueble está en revisión',
      react: PaymentSuccessEmail({ nombre, propertyName, propertyLocation, propertyPrice }),
    });

    if (error) {
      console.error('[WOMPI WEBHOOK] ⚠️ Email failed to send:', error);
    } else {
      console.log('[WOMPI WEBHOOK] 📧 Email sent successfully:', data?.id);
    }
  } catch (emailError: any) {
    console.error('[WOMPI WEBHOOK] ⚠️ Email failed to send:', emailError.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: Health check endpoint
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  return Response.json({
    status: 'active',
    version: '4.0.0',
    timestamp: new Date().toISOString(),
    description: 'Wompi Webhook Handler - Handles payment confirmations'
  });
}