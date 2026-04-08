import { createHash, timingSafeEqual } from 'crypto';
import { getServiceRoleClient } from '@/lib/supabase-admin';
import { resend } from '@/lib/resend';
import { PaymentSuccessEmail } from '@/components/emails/PaymentSuccessEmail';
import { logSystemEvent } from '@/lib/logger';
import { WALLET_EXPIRY_DAYS } from '@/app/actions/constants';

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
    // STEP 1.5: REPLAY ATTACK PROTECTION (72-hour Edge-Level TTL)
    // ═══════════════════════════════════════════════════════════════════════════
    const rawTimestamp = evento.timestamp;

    if (!Number.isFinite(rawTimestamp) || rawTimestamp <= 0) {
      await logSystemEvent('WARN', 'WOMPI_WEBHOOK', 'Invalid timestamp type/value', { timestamp: rawTimestamp });
      return Response.json({ error: 'Invalid Timestamp' }, { status: 400 });
    }

    const timestampMs = String(rawTimestamp).length === 10 ? rawTimestamp * 1000 : rawTimestamp;
    const maxAgeMs = 72 * 60 * 60 * 1000; // 72 hours window for Wompi retries

    if (Date.now() - timestampMs > maxAgeMs) {
      await logSystemEvent('WARN', 'WOMPI_WEBHOOK', 'Stale webhook payload rejected (Replay Protection)', {
        timestamp: rawTimestamp
      });
      return Response.json({ error: 'Payload Expired' }, { status: 400 });
    }

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
    try {
      for (const prop of properties) {
        const value = prop.split('.').reduce((obj: any, key: string) => {
          if (obj === undefined || obj === null) throw new Error(`Missing path: ${key}`);
          return obj[key];
        }, evento.data);

        if (value === undefined) throw new Error(`Undefined value at path: ${prop}`);
        signatureString += value;
      }
      signatureString += evento.timestamp + WOMPI_EVENTS_SECRET;
    } catch (error: any) {
      await logSystemEvent('ERROR', 'WOMPI_WEBHOOK', 'Malformed payload during signature extraction', { error: error.message });
      return Response.json({ error: 'Malformed Signature Payload' }, { status: 400 });
    }

    const calculatedChecksum = createHash('sha256').update(signatureString).digest('hex');

    const validChecksumBuffer = Buffer.from(calculatedChecksum, 'hex');
    const providedChecksumBuffer = Buffer.from(checksum, 'hex');

    if (
      validChecksumBuffer.length !== providedChecksumBuffer.length ||
      !timingSafeEqual(validChecksumBuffer, providedChecksumBuffer)
    ) {
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
    // STEP 1: READ PENDING PAGOS ROW (SELECT — do NOT update yet)
    // ═══════════════════════════════════════════════════════════════════
    console.log('[WOMPI WEBHOOK] 🔍 Looking for pending payment with reference:', reference);

    const { data: pendingPagos, error: readError } = await supabase
      .from('pagos')
      .select('id, inmueble_id, usuario_id, datos_transaccion')
      .eq('referencia_pedido', reference)
      .eq('estado', 'pendiente');

    if (readError) {
      throw new Error(`Failed to read pagos: ${readError.message}`);
    }

    // ─────────────────────────────────────────────────────────────────────
    // NO PENDING ROW: Verify asset fulfillment before returning 200
    // Must check the EXACT pago_id (renewal fix: IS NOT NULL is not enough)
    // ─────────────────────────────────────────────────────────────────────
    if (!pendingPagos || pendingPagos.length === 0) {
      // Fetch the pagoId from the existing (non-pending) row to avoid undefined
      const { data: existingPago } = await supabase
        .from('pagos')
        .select('id, inmueble_id')
        .eq('referencia_pedido', reference)
        .maybeSingle();

      if (!existingPago) {
        await logSystemEvent('ERROR', 'WOMPI_WEBHOOK', 'No pagos row found for reference at all', { reference });
        return Response.json({ success: false, error: 'No payment record found for reference' });
      }

      // ASSET CHECK: Does inmueble have THIS EXACT pago_id?
      if (existingPago.inmueble_id) {
        const { data: inmuebleCheck } = await supabase
          .from('inmuebles')
          .select('pago_id')
          .eq('id', existingPago.inmueble_id)
          .maybeSingle();

        if (inmuebleCheck?.pago_id === existingPago.id) {
          await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Asset verified — inmueble has this exact pago_id (idempotent)', { reference, pagoId: existingPago.id });
          return Response.json({ success: true, message: 'Payment already processed (idempotent)' });
        }
      }

      // pago_id NOT set on asset → data corruption or incomplete fulfillment
      await logSystemEvent('ERROR', 'WOMPI_WEBHOOK', 'pagos row not pending but asset NOT fulfilled — data corruption', { reference, pagoId: existingPago.id });
      throw new Error(`Asset fulfillment incomplete for reference ${reference}`);
    }

    const pago = pendingPagos[0];
    await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Found pending payment. Starting fulfill-first flow...', {
      pagoId: pago.id, inmuebleId: pago.inmueble_id, reference
    });

    // ─────────────────────────────────────────────────────────────────────
    // REQUIRE EXPLICIT INMUEBLE_ID (Fail-Closed)
    // ─────────────────────────────────────────────────────────────────────
    if (!pago.inmueble_id) {
      await logSystemEvent('ERROR', 'WOMPI_WEBHOOK', 'Could not determine property from webhook (missing inmueble_id) - no action taken', { reference });
      return Response.json({ success: false, error: 'Property not determinable from webhook', reference });
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: FULFILL ASSET FIRST (with atomic concurrency guard)
    // ═══════════════════════════════════════════════════════════════════

    // 2a. Update inmueble → 'en_revision' (ONLY if pago_id is null = not yet fulfilled)
    let duracionDias = 30;
    const storedData = pago.datos_transaccion as any;
    const packageSlug = storedData?.package_slug;

    if (packageSlug) {
      const { data: pkg } = await supabase
        .from('packages')
        .select('duracion_anuncio_dias')
        .eq('slug', packageSlug)
        .single();
      if (pkg) duracionDias = pkg.duracion_anuncio_dias || 30;
    }

    const inmuebleFulfilled = await updateInmuebleAtomic(supabase, pago.inmueble_id, pago.id, duracionDias);

    // 2b. Wallet/credit minting bridge (existing pago_id guard)
    if (packageSlug && pago.usuario_id && pago.inmueble_id) {
      const { data: pkg } = await supabase
        .from('packages')
        .select('id, creditos, duracion_anuncio_dias, features')
        .eq('slug', packageSlug)
        .single();

      if (pkg) {
        const { data: existingWallet } = await supabase
          .from('user_wallets')
          .select('id')
          .eq('pago_id', pago.id)
          .maybeSingle();

        if (existingWallet) {
          await logSystemEvent('INFO', 'WOMPI_WEBHOOK', '[Bridge] Wallet already minted for pago_id — skipping', { pagoId: pago.id });
        } else {
          const { data: newWallet, error: walletErr } = await supabase
            .from('user_wallets')
            .insert({
              user_id: pago.usuario_id,
              package_id: pkg.id,
              pago_id: pago.id,
              creditos_total: pkg.creditos,
              creditos_usados: 0,
              expires_at: new Date(Date.now() + WALLET_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
            })
            .select('id')
            .single();

          if (walletErr || !newWallet) {
            await logSystemEvent('CRITICAL', 'WOMPI_WEBHOOK', '[Bridge] WALLET CREATION FAILED', { pagoId: pago.id, error: walletErr?.message });
            throw new Error(`Wallet creation failed: ${walletErr?.message}`);
          }

          await logSystemEvent('INFO', 'WOMPI_WEBHOOK', `[Bridge] Wallet minted: ${newWallet.id}`, { pagoId: pago.id });

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
            try { await supabase.from('user_wallets').delete().eq('id', newWallet.id); } catch (e: any) {
              console.error('[BRIDGE-CRITICAL] ORPHANED WALLET:', newWallet.id, e);
            }
            throw new Error(`Listing credits creation failed: ${lcError.message}`);
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: CLOSE PAYMENT SECOND (only after asset is fulfilled)
    // ═══════════════════════════════════════════════════════════════════
    const { error: closeError } = await supabase
      .from('pagos')
      .update({
        estado: 'aprobado',
        wompi_transaction_id: id,
        updated_at: new Date().toISOString()
      })
      .eq('referencia_pedido', reference)
      .eq('estado', 'pendiente');

    if (closeError) {
      throw new Error(`Failed to close payment: ${closeError.message}`);
    }

    await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Payment closed AFTER asset fulfillment', {
      pagoId: pago.id, inmuebleId: pago.inmueble_id, reference
    });

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: SEND ONE CONFIRMATION EMAIL (best-effort, never throws)
    // ═══════════════════════════════════════════════════════════════════
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
    // Return 500 to allow Wompi to retry the webhook
    return Response.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Update Inmueble with ATOMIC CONCURRENCY GUARD
// Uses .is('pago_id', null) so only the first thread can fulfill.
// Returns true if this call fulfilled it, false if already fulfilled (safe no-op).
// Throws on DB errors to trigger 500 → Wompi retries.
// ─────────────────────────────────────────────────────────────────────────────
async function updateInmuebleAtomic(supabase: any, inmuebleId: string, pagoId: string, duracionDias: number = 30): Promise<boolean> {
  const now = new Date();
  const expiration = new Date(now);
  expiration.setDate(expiration.getDate() + duracionDias);

  console.log('[WOMPI WEBHOOK] 📝 Fulfilling inmueble (atomic):', inmuebleId, '| Duration:', duracionDias, 'days');

  const { data: updatedRows, error: inmuebleError } = await supabase
    .from('inmuebles')
    .update({
      estado: 'en_revision',
      pago_id: pagoId,
      fecha_publicacion: now.toISOString(),
      fecha_expiracion: expiration.toISOString()
    })
    .eq('id', inmuebleId)
    .or(`pago_id.is.null,pago_id.neq.${pagoId}`)  // ← ATOMIC GUARD: allows renewals, blocks concurrent double-spend
    .select('id');

  if (inmuebleError) {
    throw new Error(`Failed to fulfill inmueble ${inmuebleId}: ${inmuebleError.message}`);
  }

  if (!updatedRows || updatedRows.length === 0) {
    console.log('[WOMPI WEBHOOK] ⚡ Inmueble already fulfilled by another thread (atomic no-op)');
    await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Inmueble already fulfilled (atomic guard)', { inmuebleId, pagoId });
    return false;
  }

  console.log('[WOMPI WEBHOOK] ✅ Inmueble fulfilled to en_revision | Expiration:', expiration.toISOString());
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
// Called when reference matches NIDO-PKG-{slug}-{userId_short}-{rand}
// Uses ADOPT PATTERN (unified with property flow) + ROLLOVER UPSERT
// ─────────────────────────────────────────────────────────────────────────────
async function handlePackagePurchase(
  supabase: any,
  reference: string,
  transactionId: string,
  amountInCents: number,
  transaction: any,
  evento: any
): Promise<Response> {
  // Parse: NIDO-PKG-{slug}-{userId_short}-{rand}
  const parts = reference.split('-');
  if (parts.length < 4) {
    await logSystemEvent('ERROR', 'WOMPI_WEBHOOK', 'Invalid package reference format', { reference });
    return Response.json({ success: false, error: 'Invalid package reference format' });
  }

  const packageSlug = parts[2];
  console.log('[WOMPI WEBHOOK] 📦 Package purchase detected:', { packageSlug, reference });

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
  // 2. READ PENDING PAGOS ROW (SELECT — do NOT update yet)
  // ─────────────────────────────────────────────────────────────────────
  console.log(`[WOMPI WEBHOOK] 🔍 Reference Searched: Looking for exactly ${reference}`);

  const { data: pendingPkgRows, error: readPkgError } = await supabase
    .from('pagos')
    .select('id, usuario_id')
    .eq('referencia_pedido', reference)
    .eq('estado', 'pendiente');

  if (readPkgError) {
    throw new Error(`Failed to read pagos for package: ${readPkgError.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // NO PENDING ROW: Verify asset before returning 200
  // Secondary SELECT to get pagoId (avoids undefined / infinite loop)
  // ─────────────────────────────────────────────────────────────────────
  if (!pendingPkgRows || pendingPkgRows.length === 0) {
    const { data: existingPkgPago } = await supabase
      .from('pagos')
      .select('id')
      .eq('referencia_pedido', reference)
      .maybeSingle();

    if (!existingPkgPago) {
      await logSystemEvent('ERROR', 'WOMPI_WEBHOOK', 'No pagos row found for package reference', { reference });
      return Response.json({ success: false, error: 'No payment record for package reference' });
    }

    // ASSET CHECK: Does a wallet exist for THIS EXACT pago_id?
    const { data: assetWallet } = await supabase
      .from('user_wallets')
      .select('id')
      .eq('pago_id', existingPkgPago.id)
      .maybeSingle();

    if (assetWallet) {
      await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Asset verified — wallet has this exact pago_id (idempotent)', { reference, pagoId: existingPkgPago.id });
      return Response.json({ success: true, message: 'Package already fulfilled (idempotent)' });
    }

    await logSystemEvent('ERROR', 'WOMPI_WEBHOOK', 'pagos not pending but wallet NOT fulfilled — data corruption', { reference, pagoId: existingPkgPago.id });
    throw new Error(`Package asset fulfillment incomplete for reference ${reference}`);
  }

  const pagoId = pendingPkgRows[0].id;
  const userId = pendingPkgRows[0].usuario_id;
  console.log(`[WOMPI WEBHOOK] ✅ Found pending pagos row ${pagoId} | userId: ${userId}`);

  // ─────────────────────────────────────────────────────────────────────
  // 3. ASSET IDEMPOTENCY CHECK: user_wallets WHERE pago_id = this pagoId
  // ─────────────────────────────────────────────────────────────────────
  const { data: existingWalletForPago } = await supabase
    .from('user_wallets')
    .select('id')
    .eq('pago_id', pagoId)
    .maybeSingle();

  if (existingWalletForPago) {
    await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Asset guard: wallet already exists for this exact pago_id — skipping to close', { pagoId });
  } else {
    // ─────────────────────────────────────────────────────────────────────
    // 4. FULFILL ASSET (with atomic concurrency guards)
    // ─────────────────────────────────────────────────────────────────────
    if (pkg.tipo === 'paquete') {
      const newExpiresAt = new Date(Date.now() + WALLET_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const { data: existingWallet } = await supabase
        .from('user_wallets')
        .select('id, creditos_total, expires_at')
        .eq('user_id', userId)
        .eq('package_id', pkg.id)
        .maybeSingle();

      if (existingWallet) {
        // ROLLOVER: Atomic RPC with IS DISTINCT FROM guard
        const { error: rpcError } = await supabase.rpc('increment_wallet_credits', {
          p_wallet_id: existingWallet.id,
          p_credits: pkg.creditos,
          p_expires_at: newExpiresAt,
          p_pago_id: pagoId
        });

        if (rpcError) {
          await logSystemEvent('CRITICAL', 'WOMPI_WEBHOOK', 'WALLET ROLLOVER RPC FAILED', { pagoId, userId, error: rpcError.message });
          throw new Error(`Wallet rollover RPC failed: ${rpcError.message}`);
        }
        console.log('[WOMPI WEBHOOK] 🔄 Wallet rolled over atomically via RPC');
      } else {
        // FIRST PURCHASE: Insert new wallet
        const { error: insertError } = await supabase
          .from('user_wallets')
          .insert({
            user_id: userId,
            package_id: pkg.id,
            creditos_total: pkg.creditos,
            creditos_usados: 0,
            pago_id: pagoId,
            expires_at: newExpiresAt
          });

        if (insertError) {
          await logSystemEvent('CRITICAL', 'WOMPI_WEBHOOK', 'WALLET CREATION FAILED', { pagoId, userId, error: insertError.message });
          throw new Error(`Wallet creation failed: ${insertError.message}`);
        }
        console.log(`[WOMPI WEBHOOK] ✅ New wallet: ${pkg.creditos} credits | Expires: ${newExpiresAt}`);
      }

      await logSystemEvent('INFO', 'WOMPI_WEBHOOK', `Package '${pkg.nombre}' fulfilled — ${pkg.creditos} credits`, { pagoId, userId, packageSlug });

    } else if (pkg.tipo === 'suscripcion') {
      const fechaInicio = new Date();
      const fechaFin = new Date();
      fechaFin.setDate(fechaFin.getDate() + 30);

      const { error: subError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          package_id: pkg.id,
          estado: 'activa',
          fecha_inicio: fechaInicio.toISOString(),
          fecha_fin: fechaFin.toISOString(),
          auto_renewal: true,
          pago_id: pagoId
        });

      if (subError) {
        await logSystemEvent('CRITICAL', 'WOMPI_WEBHOOK', 'SUBSCRIPTION CREATION FAILED', { pagoId, userId, error: subError.message });
        throw new Error(`Subscription creation failed: ${subError.message}`);
      }

      await logSystemEvent('INFO', 'WOMPI_WEBHOOK', `Subscription '${pkg.nombre}' activated`, { pagoId, userId, packageSlug });
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 5. CLOSE PAYMENT SECOND (only after asset is fulfilled)
  // ─────────────────────────────────────────────────────────────────────
  const { error: closePkgError } = await supabase
    .from('pagos')
    .update({
      estado: 'aprobado',
      wompi_transaction_id: transactionId,
      datos_transaccion: {
        ...(evento?.data?.transaction || {}),
        package_slug: packageSlug,
        package_name: pkg.nombre,
        package_type: pkg.tipo
      }
    })
    .eq('referencia_pedido', reference)
    .eq('estado', 'pendiente');

  if (closePkgError) {
    throw new Error(`Failed to close package payment: ${closePkgError.message}`);
  }

  await logSystemEvent('INFO', 'WOMPI_WEBHOOK', 'Package payment closed AFTER asset fulfillment', { pagoId, reference });

  // ─────────────────────────────────────────────────────────────────────
  // 6. Email (best-effort, never throws)
  // ─────────────────────────────────────────────────────────────────────
  const { data: emailUser } = await supabase
    .from('usuarios')
    .select('email, nombre')
    .eq('id', userId)
    .maybeSingle();

  await sendPackageConfirmationEmail(
    transaction.customer_email || emailUser?.email,
    emailUser?.nombre || transaction.customer_data?.full_name || 'Usuario',
    pkg.nombre,
    pkg.tipo,
    pkg.creditos
  );

  return Response.json({
    success: true,
    message: `Package '${pkg.nombre}' fulfilled successfully`,
    pagoId,
    userId
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