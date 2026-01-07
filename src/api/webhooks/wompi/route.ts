/**
 * NIDO IO - Webhook Wompi Colombia v2.0
 * 
 * CRITICAL REWRITE: INSERT-based approach
 * 
 * When Wompi sends APPROVED event:
 * 1. INSERT new payment record into `pagos` table
 * 2. UPDATE `inmuebles` table with pago_id and set estado='en_revision'
 * 
 * Uses SERVICE_ROLE_KEY to bypass RLS.
 */

import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// ============================================
// TYPES
// ============================================

interface WompiTransaction {
  id: string;
  amount_in_cents: number;
  reference: string;
  customer_email: string;
  currency: string;
  payment_method_type: string;
  status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING';
}

interface WompiEvent {
  event: 'transaction.updated';
  data: {
    transaction: WompiTransaction;
  };
  environment: 'test' | 'prod';
  signature: {
    properties: string[];
    checksum: string;
  };
  timestamp: number;
  sent_at: string;
}

// ============================================
// CONFIGURATION - SERVICE ROLE KEY FOR RLS BYPASS
// ============================================

const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// MAIN WEBHOOK HANDLER
// ============================================

export async function POST(request: Request): Promise<Response> {
  console.log('[WOMPI v2] ========== NUEVO EVENTO ==========');

  try {
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Parse incoming event
    // ═══════════════════════════════════════════════════════════════
    const evento: WompiEvent = await request.json();
    const { transaction } = evento.data;

    console.log('[WOMPI v2] Evento recibido:', {
      event: evento.event,
      reference: transaction.reference,
      status: transaction.status,
      amount: transaction.amount_in_cents,
      email: transaction.customer_email,
      method: transaction.payment_method_type,
      wompiId: transaction.id,
      environment: evento.environment
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Validate signature (optional - skip in test mode)
    // ═══════════════════════════════════════════════════════════════
    if (WOMPI_EVENTS_SECRET) {
      const firmaValida = validarChecksum(evento);
      if (!firmaValida) {
        console.error('[WOMPI v2] ⚠️ FIRMA INVÁLIDA');
        return Response.json(
          { success: false, message: 'Firma inválida' },
          { status: 400 }
        );
      }
      console.log('[WOMPI v2] ✅ Firma validada');
    } else {
      console.log('[WOMPI v2] ⚠️ WOMPI_EVENTS_SECRET no configurado - saltando validación');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Only process APPROVED transactions
    // ═══════════════════════════════════════════════════════════════
    if (transaction.status !== 'APPROVED') {
      console.log(`[WOMPI v2] Ignorando transacción con estado: ${transaction.status}`);
      return Response.json({
        success: true,
        message: `Estado ${transaction.status} registrado (sin acción)`
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Initialize Supabase with SERVICE ROLE KEY
    // ═══════════════════════════════════════════════════════════════
    console.log('[WOMPI v2] Conectando a Supabase con Service Role Key...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: Extract inmueble_id from reference (format: NIDO-{uuid}-{timestamp})
    // ═══════════════════════════════════════════════════════════════
    const referencia = transaction.reference;
    const referenceParts = referencia.split('-');

    // Reference format: NIDO-{first8chars}-{timestamp}
    // We need to find the inmueble by matching the first 8 chars
    let inmuebleId: string | null = null;

    if (referenceParts.length >= 2) {
      const shortId = referenceParts[1]; // First 8 chars of UUID
      console.log(`[WOMPI v2] Buscando inmueble con ID que empiece con: ${shortId}`);

      // Find the inmueble by matching the beginning of its ID
      const { data: inmuebleData, error: inmuebleSearchError } = await supabase
        .from('inmuebles')
        .select('id, propietario_id')
        .ilike('id', `${shortId}%`)
        .limit(1)
        .single();

      if (inmuebleSearchError || !inmuebleData) {
        console.error('[WOMPI v2] ❌ No se encontró inmueble para referencia:', referencia);
        console.error('[WOMPI v2] Error:', inmuebleSearchError?.message);
        return Response.json({
          success: false,
          message: `Inmueble no encontrado para referencia: ${referencia}`
        }, { status: 404 });
      }

      inmuebleId = inmuebleData.id;
      console.log(`[WOMPI v2] ✅ Inmueble encontrado: ${inmuebleId}`);
    } else {
      console.error('[WOMPI v2] ❌ Formato de referencia inválido:', referencia);
      return Response.json({
        success: false,
        message: `Formato de referencia inválido: ${referencia}`
      }, { status: 400 });
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 6: Check if payment already exists (idempotency)
    // ═══════════════════════════════════════════════════════════════
    const { data: existingPayment } = await supabase
      .from('pagos')
      .select('id, estado')
      .eq('referencia_pedido', referencia)
      .single();

    if (existingPayment && existingPayment.estado === 'aprobado') {
      console.log('[WOMPI v2] ⚠️ Pago ya procesado anteriormente, ignorando duplicado');
      return Response.json({
        success: true,
        message: 'Pago ya procesado anteriormente'
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 7: INSERT payment record into pagos table
    // ═══════════════════════════════════════════════════════════════
    console.log('[WOMPI v2] 📝 Insertando registro de pago...');

    const { data: newPayment, error: insertError } = await supabase
      .from('pagos')
      .insert({
        referencia_pedido: referencia,
        wompi_transaction_id: transaction.id,
        monto: transaction.amount_in_cents / 100, // Convert cents to COP
        email: transaction.customer_email,
        estado: 'aprobado',
        metodo_pago: transaction.payment_method_type,
        inmueble_id: inmuebleId,
        respuesta_pasarela: evento
      })
      .select('id')
      .single();

    if (insertError || !newPayment) {
      console.error('[WOMPI v2] ❌ ERROR CRÍTICO insertando pago:', insertError?.message);
      console.error('[WOMPI v2] Detalles:', insertError);
      return Response.json({
        success: false,
        message: `Error insertando pago: ${insertError?.message}`
      }, { status: 500 });
    }

    const pagoId = newPayment.id;
    console.log(`[WOMPI v2] ✅ Pago insertado con ID: ${pagoId}`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 8: UPDATE inmuebles table with payment data
    // ═══════════════════════════════════════════════════════════════
    console.log('[WOMPI v2] 📝 Actualizando inmueble...');

    const fechaPublicacion = new Date();
    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + 30);

    const { error: updateError } = await supabase
      .from('inmuebles')
      .update({
        estado: 'en_revision', // HARDCODED: Always 'en_revision'
        pago_id: pagoId,
        fecha_publicacion: fechaPublicacion.toISOString(),
        fecha_expiracion: fechaExpiracion.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', inmuebleId);

    if (updateError) {
      console.error('[WOMPI v2] ⚠️ Error actualizando inmueble:', updateError.message);
      // Don't fail the webhook - payment was already recorded
    } else {
      console.log(`[WOMPI v2] ✅ Inmueble ${inmuebleId} actualizado:`);
      console.log(`        → estado: 'en_revision'`);
      console.log(`        → pago_id: ${pagoId}`);
      console.log(`        → fecha_publicacion: ${fechaPublicacion.toISOString()}`);
      console.log(`        → fecha_expiracion: ${fechaExpiracion.toISOString()}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 9: Return success response
    // ═══════════════════════════════════════════════════════════════
    console.log('[WOMPI v2] 🎉 Proceso completado exitosamente');

    return Response.json({
      success: true,
      message: 'Pago registrado. Inmueble en revisión.',
      reference: referencia,
      pagoId: pagoId,
      inmuebleId: inmuebleId
    });

  } catch (error: any) {
    console.error('[WOMPI v2] ❌ Error inesperado:', error?.message || error);
    console.error('[WOMPI v2] Stack:', error?.stack);
    return Response.json({
      success: false,
      message: `Error interno: ${error?.message || 'Unknown error'}`
    }, { status: 500 });
  }
}

// ============================================
// SIGNATURE VALIDATION
// ============================================

function validarChecksum(evento: WompiEvent): boolean {
  const { signature, timestamp, data } = evento;

  let cadena = '';
  for (const prop of signature.properties) {
    const keys = prop.split('.');
    let value: any = data;

    for (const key of keys) {
      if (value === undefined || value === null) break;
      value = value[key];
    }

    cadena += String(value ?? '');
  }

  cadena += timestamp;
  cadena += WOMPI_EVENTS_SECRET;

  const checksumCalculado = createHash('sha256')
    .update(cadena)
    .digest('hex')
    .toUpperCase();

  const checksumRecibido = signature.checksum.toUpperCase();

  console.log('[WOMPI v2] Validación firma:', {
    match: checksumCalculado === checksumRecibido
  });

  return checksumCalculado === checksumRecibido;
}

// ============================================
// GET endpoint for health check
// ============================================

export async function GET(): Promise<Response> {
  return Response.json({
    service: 'Nido IO - Wompi Webhook',
    status: 'active',
    version: '2.0.0'
  });
}
