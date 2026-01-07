import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Safe Runtime Handler
export async function POST(request: Request): Promise<Response> {
  console.log('[WOMPI WEBHOOK] Received event');

  // 🛡️ RUNTIME ENV LOADING (Lee variables solo al recibir la petición)
  const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET || '';
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  try {
    const evento = await request.json();
    const { transaction } = evento.data;

    // 1. Validate Signature (Optional check)
    if (WOMPI_EVENTS_SECRET) {
      // Aquí iría la lógica de firma si la usas estricta
    }

    // 2. Only process APPROVED
    if (transaction.status !== 'APPROVED') {
      return Response.json({ success: true, message: 'Not approved, skipped' });
    }

    // 3. Connect DB (Si fallan las llaves, falla aquí, NO en el build)
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('❌ Missing DB Config');
      return Response.json({ success: false }, { status: 500 });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

    // 4. Process Payment
    const referencia = transaction.reference;
    // Extraer ID corto de NIDO-XXXXX-TIMESTAMP
    const shortId = referencia.split('-')[1];

    // Find Inmueble
    const { data: inmueble } = await supabase
      .from('inmuebles')
      .select('id, propietario_id')
      .ilike('id', `${shortId}%`)
      .single();

    if (!inmueble) return Response.json({ success: false, message: 'Inmueble not found' }, { status: 404 });

    // Insert Payment
    const { data: pago } = await supabase.from('pagos').insert({
      referencia_pedido: referencia,
      wompi_transaction_id: transaction.id,
      monto: transaction.amount_in_cents / 100,
      estado: 'aprobado',
      inmueble_id: inmueble.id,
      usuario_id: inmueble.propietario_id,
      respuesta_pasarela: evento
    }).select().single();

    // Check User Verification
    const { data: verif } = await supabase
      .from('user_verifications')
      .select('estado')
      .eq('user_id', inmueble.propietario_id)
      .single();

    // Update Inmueble Status
    const nuevoEstado = (verif?.estado === 'aprobado') ? 'publicado' : 'en_revision';

    await supabase.from('inmuebles').update({
      estado: nuevoEstado,
      pago_id: pago?.id,
      fecha_publicacion: new Date().toISOString()
    }).eq('id', inmueble.id);

    return Response.json({ success: true, nuevoEstado });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ status: 'active', version: '3.1.0' });
}