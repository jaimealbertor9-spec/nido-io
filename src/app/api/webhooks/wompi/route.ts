import { createHash } from 'crypto';
import { getServiceRoleClient } from '@/lib/supabase-admin';
import { resend } from '@/lib/resend';
import { PaymentSuccessEmail } from '@/components/emails/PaymentSuccessEmail';
import { logSystemEvent } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// WOMPI WEBHOOK HANDLER - FAIL-CLOSED SECURITY
// Handles transaction.updated events from Wompi payment gateway
// ALL requests MUST have valid signature - no exceptions
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: Request): Promise<Response> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('[WOMPI WEBHOOK] 📨 Received event at:', new Date().toISOString());

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: CRITICAL ENVIRONMENT CHECK (Fail-Closed Gate #1)
  // ═══════════════════════════════════════════════════════════════════════════
  const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET;

  if (!WOMPI_EVENTS_SECRET) {
    await logSystemEvent('CRITICAL', 'WOMPI_WEBHOOK', 'WOMPI_EVENTS_SECRET not configured - all requests blocked');
    return Response.json({ error: 'Server Misconfiguration' }, { status: 500 });
  }

  try {
    // Parse the webhook payload
    const evento = await request.json();
    console.log('[WOMPI WEBHOOK] Event type:', evento.event);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: STRICT SIGNATURE EXTRACTION (Fail-Closed Gate #2)
    // ═══════════════════════════════════════════════════════════════════════════
    const checksum = evento.signature?.checksum;

    if (!checksum) {
      await logSystemEvent('WARN', 'WOMPI_WEBHOOK', 'Missing signature in request - BLOCKED', {
        event_type: evento.event,
        has_data: !!evento.data
      });
      return Response.json({ error: 'Missing Signature' }, { status: 401 });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: MANDATORY SIGNATURE VALIDATION (Fail-Closed Gate #3)
    // ═══════════════════════════════════════════════════════════════════════════
    const properties = evento.signature.properties || [];
    let signatureString = '';

    // Build signature string from properties
    for (const prop of properties) {
      const value = prop.split('.').reduce((obj: any, key: string) => obj?.[key], evento.data);
      signatureString += value;
    }
    signatureString += evento.timestamp + WOMPI_EVENTS_SECRET;

    const calculatedChecksum = createHash('sha256').update(signatureString).digest('hex');

    if (calculatedChecksum !== checksum) {
      await logSystemEvent('ERROR', 'WOMPI_WEBHOOK', 'Invalid Signature - potential spoofing attempt BLOCKED', {
        event_type: evento.event
      });
      return Response.json({ error: 'Invalid Signature' }, { status: 401 });
    }

    await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Signature verified - proceeding with business logic');

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: BUSINESS LOGIC (Only reachable if signature is valid)
    // ═══════════════════════════════════════════════════════════════════════════

    // Validate event structure
    if (!evento.data?.transaction) {
      console.error('[WOMPI WEBHOOK] ❌ Invalid event structure - no transaction data');
      return Response.json({ success: false, error: 'Invalid structure' }, { status: 400 });
    }

    const { transaction } = evento.data;
    const { id, reference, status, amount_in_cents } = transaction;

    await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Processing transaction', { id, reference, status, amount_in_cents });

    // ─────────────────────────────────────────────────────────────────────
    // STEP 2: ONLY PROCESS APPROVED TRANSACTIONS
    // ─────────────────────────────────────────────────────────────────────
    if (status !== 'APPROVED') {
      console.log(`[WOMPI WEBHOOK] ℹ️ Transaction status is ${status}, not APPROVED. Acknowledging.`);
      return Response.json({ success: true, message: `Status ${status} acknowledged, no action needed` });
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: CONNECT TO DATABASE (Centralized, fail-fast on missing key)
    // ─────────────────────────────────────────────────────────────────────
    const supabase = getServiceRoleClient();

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3.1: PACKAGE PURCHASE DETECTION
    // References starting with 'NIDO-PKG-' are package/subscription buys,
    // NOT per-property payments. Route to dedicated handler.
    // Format: NIDO-PKG-{slug}-{userId_short}
    // ═══════════════════════════════════════════════════════════════════
    if (reference && reference.startsWith('NIDO-PKG-')) {
      await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Package purchase detected', { reference, id });
      return await handlePackagePurchase(supabase, reference, id, amount_in_cents, transaction, evento);
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3.5: IDEMPOTENCY CHECK
    // If this transaction.id has already been processed as 'aprobado',
    // return 200 immediately to prevent duplicate business logic.
    // ═══════════════════════════════════════════════════════════════════
    const { data: existingPayment } = await supabase
      .from('pagos')
      .select('id, estado')
      .eq('wompi_transaction_id', id)
      .maybeSingle();

    if (existingPayment && existingPayment.estado === 'aprobado') {
      await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Idempotency: transaction already processed - skipping', {
        transactionId: id,
        pagoId: existingPayment.id,
        reference
      });
      return Response.json({
        success: true,
        message: 'Transaction already processed (idempotent)',
        pagoId: existingPayment.id
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4A: ATOMIC LOCK — UPDATE PAYMENT RECORD (pagos table)
    // Uses .eq('estado','pendiente') to prevent race condition with browser.
    // If 0 rows returned, another thread (browser) already approved it.
    // ─────────────────────────────────────────────────────────────────────
    console.log('[WOMPI WEBHOOK] 🔍 Looking for pending payment with reference:', reference);

    const { data: lockedPagos, error: pagoError } = await supabase
      .from('pagos')
      .update({
        estado: 'aprobado',
        wompi_transaction_id: id,
        updated_at: new Date().toISOString()
      })
      .eq('referencia_pedido', reference)
      .eq('estado', 'pendiente')   // ← ATOMIC LOCK
      .select('id, inmueble_id, usuario_id, datos_transaccion');

    if (pagoError) {
      await logSystemEvent('WARN', 'WOMPI_WEBHOOK', 'Atomic lock update error', { reference, error: pagoError?.message });
    }

    // ─────────────────────────────────────────────────────────────────────
    // LOCK LOST: Browser thread already set estado=aprobado.
    // Return 200 immediately — all business logic was handled there.
    // ─────────────────────────────────────────────────────────────────────
    if (!lockedPagos || lockedPagos.length === 0) {
      await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Lock lost — browser already processed this payment (idempotent)', { reference, id });
      console.log('[LOCK-LOST] Webhook lock lost. Browser already processed this payment.');
      return Response.json({ success: true, message: 'Payment already processed by redirect flow (idempotent)' });
    }

    // This webhook WON the lock. Proceed with business logic.
    const pago = lockedPagos[0];
    await logSystemEvent('INFO', 'WOMPI_WEBHOOK', '🔒 Webhook acquired atomic lock. Processing...', {
      pagoId: pago.id, inmuebleId: pago.inmueble_id, reference
    });

    // ─────────────────────────────────────────────────────────────────────
    // FALLBACK PATH: No matching pagos row (missing reference linkage)
    // Find the orphaned pending row by draftId from the redirect_url, then
    // ADOPT it (UPDATE its referencia_pedido). NEVER blindly INSERT.
    // ─────────────────────────────────────────────────────────────────────
    if (!pago.inmueble_id) {
      await logSystemEvent('WARN', 'WOMPI_WEBHOOK', 'No inmueble_id on locked row — attempting draftId adoption', { reference });

      let propertyId: string | null = null;
      const redirectUrl = transaction.redirect_url;

      // Extract draftId from redirect_url (primary, reliable source)
      if (redirectUrl && redirectUrl.includes('draftId=')) {
        try {
          const urlObj = new URL(redirectUrl);
          propertyId = urlObj.searchParams.get('draftId');
        } catch {
          const match = redirectUrl.match(/draftId=([a-f0-9-]+)/i);
          if (match) propertyId = match[1];
        }
      }

      if (propertyId) {
        // Find the orphaned PENDING row for this property and ADOPT it
        const { data: orphanedPago } = await supabase
          .from('pagos')
          .select('id, usuario_id, datos_transaccion')
          .eq('inmueble_id', propertyId)
          .eq('estado', 'pendiente')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (orphanedPago) {
          // ADOPT: link Wompi's reference to our existing row
          await supabase
            .from('pagos')
            .update({
              referencia_pedido: reference,
              wompi_transaction_id: id,
              estado: 'aprobado',
              updated_at: new Date().toISOString()
            })
            .eq('id', orphanedPago.id)
            .eq('estado', 'pendiente');   // ← ATOMIC LOCK on adopt

          await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Orphaned pagos row adopted — reference linked', {
            pagoId: orphanedPago.id, propertyId, reference
          });

          // Proceed with the adopted row's data
          (pago as any).id = orphanedPago.id;
          (pago as any).inmueble_id = propertyId;
          (pago as any).usuario_id = orphanedPago.usuario_id;
          (pago as any).datos_transaccion = orphanedPago.datos_transaccion;
        } else {
          await logSystemEvent('WARN', 'WOMPI_WEBHOOK', 'No pending row to adopt for propertyId', { propertyId, reference });
        }
      }

      if (!pago.inmueble_id) {
        await logSystemEvent('ERROR', 'WOMPI_WEBHOOK', 'Could not determine property from webhook — no action taken', { reference });
        return Response.json({ success: false, error: 'Property not determinable from webhook', reference });
      }
    }

    await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Payment updated successfully', {
      pagoId: pago.id, inmuebleId: pago.inmueble_id, reference
    });

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4B: WALLET & CREDIT MINTING BRIDGE (Finding #1)
    // The webhook is now a full citizen of the payment bridge.
    // Reads package_slug from datos_transaccion (preserved by JSON merge in payment.ts)
    // ─────────────────────────────────────────────────────────────────────
    let duracionDias = 30; // default for legacy/unknown payments
    const storedData = pago.datos_transaccion as any;
    const packageSlug = storedData?.package_slug;

    if (packageSlug && pago.usuario_id && pago.inmueble_id) {
      console.log('[WOMPI WEBHOOK] 📦 [Bridge] Fetching package for slug:', packageSlug);

      const { data: pkg } = await supabase
        .from('packages')
        .select('id, creditos, duracion_anuncio_dias, features')
        .eq('slug', packageSlug)
        .single();

      if (pkg) {
        duracionDias = pkg.duracion_anuncio_dias || 30;

        // Idempotency guard — strictly tied to pago_id
        const { data: existingWallet } = await supabase
          .from('user_wallets')
          .select('id')
          .eq('pago_id', pago.id)
          .maybeSingle();

        if (existingWallet) {
          await logSystemEvent('INFO', 'WOMPI_WEBHOOK', '[Bridge] Wallet already minted for pago_id — skipping', { pagoId: pago.id, walletId: existingWallet.id });
        } else {
          const { data: newWallet, error: walletErr } = await supabase
            .from('user_wallets')
            .insert({
              user_id: pago.usuario_id,
              package_id: pkg.id,
              pago_id: pago.id,
              creditos_total: pkg.creditos,
              creditos_usados: 0,
            })
            .select('id')
            .single();

          if (walletErr || !newWallet) {
            await logSystemEvent('CRITICAL', 'WOMPI_WEBHOOK', '[Bridge] WALLET CREATION FAILED', { pagoId: pago.id, error: walletErr?.message });
          } else {
            await logSystemEvent('INFO', 'WOMPI_WEBHOOK', `[Bridge] Wallet minted: ${newWallet.id} | Credits: ${pkg.creditos}`, { pagoId: pago.id });

            const now = new Date();
            const expiration = new Date(now);
            expiration.setDate(expiration.getDate() + duracionDias);

            const { error: lcError } = await supabase
              .from('listing_credits')
              .insert({
                user_id: pago.usuario_id,
                inmueble_id: pago.inmueble_id,
                wallet_id: newWallet.id,
                features_snapshot: pkg.features || {},
                fecha_publicacion: now.toISOString(),
                fecha_expiracion: expiration.toISOString(),
              });

            if (lcError) {
              await logSystemEvent('CRITICAL', 'WOMPI_WEBHOOK', '[Bridge] listing_credits FAILED — rolling back wallet', { walletId: newWallet.id, error: lcError.message });
              try {
                await supabase.from('user_wallets').delete().eq('id', newWallet.id);
              } catch (deleteError: any) {
                console.error('[BRIDGE-CRITICAL] ORPHANED WALLET DETECTED. Manual cleanup required for wallet ID:', newWallet.id, deleteError);
              }
            } else {
              await logSystemEvent('INFO', 'WOMPI_WEBHOOK', '[Bridge] listing_credit minted', { inmuebleId: pago.inmueble_id, expires: expiration.toISOString() });
            }
          }
        }
      } else {
        await logSystemEvent('WARN', 'WOMPI_WEBHOOK', '[Bridge] Package not found for slug', { packageSlug });
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4C: UPDATE INMUEBLE (with dynamic duration from package)
    // ─────────────────────────────────────────────────────────────────────
    if (pago.inmueble_id) {
      const updateOk = await updateInmueble(supabase, pago.inmueble_id, pago.id, duracionDias);
      if (!updateOk) {
        await logSystemEvent('CRITICAL', 'WOMPI_WEBHOOK', 'PAYMENT RECORDED BUT PROPERTY UPDATE FAILED — requires manual intervention', {
          pagoId: pago.id, inmuebleId: pago.inmueble_id, reference
        });
      }
    } else {
      await logSystemEvent('WARN', 'WOMPI_WEBHOOK', 'No inmueble_id associated with payment', {
        pagoId: pago.id, reference
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 5: SEND ONE CONFIRMATION EMAIL
    // ─────────────────────────────────────────────────────────────────────
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

    await sendPaymentConfirmationEmail(
      transaction.customer_email,
      transaction.customer_data?.full_name || 'Usuario',
      propertyName,
      propertyLocation,
      propertyPrice
    );

    await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Webhook processing complete', { pagoId: pago.id, reference });

    return Response.json({
      success: true,
      message: 'Payment approved and property updated',
      pagoId: pago.id
    });

  } catch (error: any) {
    await logSystemEvent('ERROR', 'WOMPI_WEBHOOK', 'Unexpected error during processing', {
      error: error.message,
      stack: error.stack?.substring(0, 500)
    });
    // Return 200 to prevent Wompi retries (we'll handle it manually if needed)
    return Response.json({
      success: false,
      error: 'Internal processing error',
      note: 'Acknowledged to prevent retries'
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Update Inmueble after successful payment
// Returns true if update succeeded, false if it failed.
// Email sending has been REMOVED from here to prevent duplicates.
// The main flow is the single source of email sending.
// ─────────────────────────────────────────────────────────────────────────────
async function updateInmueble(supabase: any, inmuebleId: string, pagoId: string | undefined, duracionDias: number = 30): Promise<boolean> {
  const now = new Date();
  const expiration = new Date(now);
  expiration.setDate(expiration.getDate() + duracionDias); // #5 Fix: dynamic duration

  console.log('[WOMPI WEBHOOK] 📝 Updating inmueble:', inmuebleId, '| Duration:', duracionDias, 'days');

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
    return false;
  }

  console.log('[WOMPI WEBHOOK] ✅ Inmueble updated to en_revision | Expiration:', expiration.toISOString());
  return true;
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
// HELPER: Handle Package Purchase (Credit Packs & Subscriptions)
// Called when reference matches NIDO-PKG-{slug}-{userId_short}
// ─────────────────────────────────────────────────────────────────────────────
async function handlePackagePurchase(
  supabase: any,
  reference: string,
  transactionId: string,
  amountInCents: number,
  transaction: any,
  evento: any
): Promise<Response> {
  // Parse: NIDO-PKG-{slug}-{userId_short}
  const parts = reference.split('-');
  // parts: ['NIDO', 'PKG', slug, ...userId_parts]
  if (parts.length < 4) {
    await logSystemEvent('ERROR', 'WOMPI_WEBHOOK', 'Invalid package reference format', { reference });
    return Response.json({ success: false, error: 'Invalid package reference format' });
  }

  const packageSlug = parts[2];
  const userIdShort = parts.slice(3).join('-'); // Rejoin in case userId contains dashes

  console.log('[WOMPI WEBHOOK] 📦 Package purchase:', { packageSlug, userIdShort });

  // ─────────────────────────────────────────────────────────────────────
  // 1. Look up the package
  // ─────────────────────────────────────────────────────────────────────
  const { data: pkg, error: pkgError } = await supabase
    .from('packages')
    .select('id, slug, tipo, creditos, duracion_anuncio_dias, features, nombre')
    .eq('slug', packageSlug)
    .eq('activo', true)
    .single();

  if (pkgError || !pkg) {
    await logSystemEvent('ERROR', 'WOMPI_WEBHOOK', 'Package not found', { packageSlug, error: pkgError?.message });
    return Response.json({ success: false, error: `Package '${packageSlug}' not found` });
  }

  // ─────────────────────────────────────────────────────────────────────
  // 2. Find the user by short ID prefix
  // ─────────────────────────────────────────────────────────────────────
  const { data: user, error: userError } = await supabase
    .from('usuarios')
    .select('id, email, nombre')
    .ilike('id', `${userIdShort}%`)
    .limit(1)
    .single();

  if (userError || !user) {
    await logSystemEvent('ERROR', 'WOMPI_WEBHOOK', 'User not found for package purchase', { userIdShort, error: userError?.message });
    return Response.json({ success: false, error: 'User not found' });
  }

  // ─────────────────────────────────────────────────────────────────────
  // 3. Idempotency: check if this transaction already created a wallet/subscription
  // ─────────────────────────────────────────────────────────────────────
  const { data: existingPago } = await supabase
    .from('pagos')
    .select('id, estado')
    .eq('wompi_transaction_id', transactionId)
    .maybeSingle();

  if (existingPago && existingPago.estado === 'aprobado') {
    await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Package payment already processed (idempotent)', { transactionId });
    return Response.json({ success: true, message: 'Package payment already processed' });
  }

  // ─────────────────────────────────────────────────────────────────────
  // 4. Create payment record in pagos
  // ─────────────────────────────────────────────────────────────────────
  const { data: newPago, error: pagoInsertError } = await supabase
    .from('pagos')
    .insert({
      referencia_pedido: reference,
      wompi_transaction_id: transactionId,
      monto: amountInCents / 100,
      estado: 'aprobado',
      usuario_id: user.id,
      metodo_pago: 'wompi_link',
      respuesta_pasarela: evento,
      datos_transaccion: {
        package_slug: packageSlug,
        package_name: pkg.nombre,
        package_type: pkg.tipo
      }
    })
    .select('id')
    .single();

  if (pagoInsertError) {
    await logSystemEvent('CRITICAL', 'WOMPI_WEBHOOK', 'Failed to insert package payment', {
      reference, userId: user.id, error: pagoInsertError.message
    });
    return Response.json({ success: false, error: 'Failed to record package payment' });
  }

  // ─────────────────────────────────────────────────────────────────────
  // 5. Fulfill: create wallet (paquete) or subscription (suscripcion)
  // ─────────────────────────────────────────────────────────────────────
  if (pkg.tipo === 'paquete') {
    const { error: walletError } = await supabase
      .from('user_wallets')
      .insert({
        user_id: user.id,
        package_id: pkg.id,
        creditos_total: pkg.creditos,
        creditos_usados: 0,
        pago_id: newPago.id
      });

    if (walletError) {
      await logSystemEvent('CRITICAL', 'WOMPI_WEBHOOK', 'PAYMENT OK BUT WALLET CREATION FAILED', {
        pagoId: newPago.id, userId: user.id, error: walletError.message
      });
      return Response.json({ success: false, error: 'Wallet creation failed' });
    }

    await logSystemEvent('INFO', 'WOMPI_WEBHOOK', `Package '${pkg.nombre}' fulfilled — ${pkg.creditos} credits added`, {
      pagoId: newPago.id, userId: user.id, packageSlug
    });

  } else if (pkg.tipo === 'suscripcion') {
    const fechaInicio = new Date();
    const fechaFin = new Date();
    fechaFin.setDate(fechaFin.getDate() + 30);

    const { error: subError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        package_id: pkg.id,
        estado: 'activa',
        fecha_inicio: fechaInicio.toISOString(),
        fecha_fin: fechaFin.toISOString(),
        auto_renewal: true,
        pago_id: newPago.id
      });

    if (subError) {
      await logSystemEvent('CRITICAL', 'WOMPI_WEBHOOK', 'PAYMENT OK BUT SUBSCRIPTION CREATION FAILED', {
        pagoId: newPago.id, userId: user.id, error: subError.message
      });
      return Response.json({ success: false, error: 'Subscription creation failed' });
    }

    await logSystemEvent('INFO', 'WOMPI_WEBHOOK', `Subscription '${pkg.nombre}' activated until ${fechaFin.toISOString()}`, {
      pagoId: newPago.id, userId: user.id, packageSlug
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // 6. Send confirmation email
  // ─────────────────────────────────────────────────────────────────────
  await sendPackageConfirmationEmail(
    transaction.customer_email || user.email,
    user.nombre || transaction.customer_data?.full_name || 'Usuario',
    pkg.nombre,
    pkg.tipo,
    pkg.creditos
  );

  return Response.json({
    success: true,
    message: `Package '${pkg.nombre}' fulfilled successfully`,
    pagoId: newPago.id,
    userId: user.id
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Send package/subscription confirmation email
// ─────────────────────────────────────────────────────────────────────────────
async function sendPackageConfirmationEmail(
  email: string | undefined,
  nombre: string,
  packageName: string,
  packageType: string,
  credits: number
) {
  if (!email) {
    console.log('[WOMPI WEBHOOK] ⚠️ No email for package confirmation, skipping');
    return;
  }

  try {
    const subject = packageType === 'suscripcion'
      ? `¡Suscripción ${packageName} activada!`
      : `¡Paquete ${packageName} adquirido — ${credits} crédito(s)!`;

    // Use a simple text email for now; a React template can be added later
    await resend.emails.send({
      from: 'Nido <onboarding@resend.dev>',
      to: email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1A56DB;">¡Hola ${nombre}!</h2>
          <p>Tu ${packageType === 'suscripcion' ? 'suscripción' : 'paquete'} <strong>${packageName}</strong> ha sido activado exitosamente.</p>
          ${packageType === 'paquete' ? `<p>Ahora tienes <strong>${credits} crédito(s)</strong> disponibles para publicar inmuebles.</p>` : '<p>Tu suscripción ilimitada está activa por 30 días.</p>'}
          <p style="margin-top: 20px;"><a href="https://nido.io/mis-inmuebles" style="background: #1A56DB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Ir al Dashboard</a></p>
          <p style="color: #888; font-size: 12px; margin-top: 30px;">— Equipo Nido</p>
        </div>
      `
    });
    console.log('[WOMPI WEBHOOK] 📧 Package confirmation email sent to:', email);
  } catch (err: any) {
    console.error('[WOMPI WEBHOOK] ⚠️ Package email failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: Health check endpoint
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  return Response.json({
    status: 'active',
    version: '5.0.0',
    timestamp: new Date().toISOString(),
    description: 'Wompi Webhook Handler - Payments + Package Fulfillment'
  });
}