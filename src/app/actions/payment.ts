'use server';

import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const AMOUNT_IN_CENTS = 1000000; // $10,000 COP
const CURRENCY = 'COP';
const WOMPI_CHECKOUT_URL = 'https://checkout.wompi.co/p/';

function generateReference(propertyId: string): string {
    const timestamp = Date.now();
    const shortId = propertyId.substring(0, 8);
    return `NIDO-${shortId}-${timestamp}`;
}

export async function initiatePaymentSession(
    propertyId: string,
    userEmail: string,
    userId: string,
    redirectUrl?: string
) {
    console.log('🚀 [Payment] Iniciando sesión para:', userId);

    // 1. MOVER VARIABLES DENTRO DE LA FUNCIÓN (Fix Build Error)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // DEBUG: Log key status (NOT the key itself)
    console.log('🔑 [Payment] SUPABASE_SERVICE_ROLE_KEY defined:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('🔑 [Payment] Using service role key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
        return { success: false, error: 'Error de configuración del servidor' };
    }

    // Usamos el cliente genérico para evitar errores de tipos estrictos
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 2. Verificar Documentos (Usando nombres en ESPAÑOL)
        // Usamos <any> para que TypeScript no bloquee el build si espera 'status' en inglés
        const { data: userVerifications } = await supabase
            .from('user_verifications')
            .select('estado, documento_url')
            .eq('user_id', userId) as { data: any[], error: any };

        const isApproved = userVerifications?.some((v: any) => v.estado === 'aprobado');
        const hasDocuments = userVerifications?.some((v: any) => v.documento_url !== null && v.documento_url !== '');

        if (!isApproved && !hasDocuments) {
            return { success: false, error: 'Debes subir tu documento de identidad antes de pagar.' };
        }

        // 3. Generar Firma Wompi
        // Priority: Secure server-side env var → Legacy public env var → Error
        const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || process.env.NEXT_PUBLIC_WOMPI_INTEGRITY_SECRET;
        const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || process.env.WOMPI_PUBLIC_KEY;

        // Validate required Wompi configuration
        if (!integritySecret) {
            console.error('❌ [Payment] Configuration Error: WOMPI_INTEGRITY_SECRET is missing');
            throw new Error('Configuration Error: WOMPI_INTEGRITY_SECRET is missing');
        }
        if (!publicKey) {
            console.error('❌ [Payment] Configuration Error: Public Key is undefined');
            throw new Error('SERVER ERROR: Public Key is undefined. Check Vercel Env Vars.');
        }
        console.log('✅ [Payment] Wompi configuration validated, publicKey:', publicKey.substring(0, 8) + '...');

        const reference = generateReference(propertyId);

        // CRITICAL: Wompi requires amount as a clean integer string (no decimals)
        const amountInCentsInt = Math.round(Number(AMOUNT_IN_CENTS));
        const amountStr = amountInCentsInt.toString();

        // SHA-256 Signature: reference + amountInCents + currency + integritySecret
        const signatureChain = `${reference}${amountInCentsInt}${CURRENCY}${integritySecret}`;
        console.log('🔍 [Payment Debug] Pre-Hash String:', signatureChain);
        console.log('🔍 [Payment Debug] Amount as integer:', amountInCentsInt, 'type:', typeof amountInCentsInt);

        const signature = createHash('sha256').update(signatureChain).digest('hex');
        console.log('🔐 [Payment] Integrity signature generated for reference:', reference);
        console.log('🔐 [Payment] Signature hash:', signature);

        // 4. Guardar Pago en BD
        const { error: insertError } = await supabase
            .from('pagos')
            .insert({
                usuario_id: userId,  // FK to usuarios table
                inmueble_id: propertyId,
                referencia_pedido: reference,
                monto: amountInCentsInt / 100,  // Convert cents to currency units
                estado: 'pendiente',
                metodo_pago: 'wompi_redirect',
                datos_transaccion: {
                    user_email: userEmail,
                    signature: signature
                }
            });

        if (insertError) {
            console.error('❌ Error insertando pago:', insertError);
            console.error('❌ [Payment] Insert error details:', JSON.stringify(insertError, null, 2));
            return { success: false, error: `DB Error: ${insertError.message}` };
        }

        // 5. Construir URL
        const checkoutUrl = new URL(WOMPI_CHECKOUT_URL);
        checkoutUrl.searchParams.set('public-key', publicKey);
        checkoutUrl.searchParams.set('currency', CURRENCY);
        checkoutUrl.searchParams.set('amount-in-cents', amountStr);
        checkoutUrl.searchParams.set('reference', reference);
        checkoutUrl.searchParams.set('signature:integrity', signature);
        if (redirectUrl) checkoutUrl.searchParams.set('redirect-url', redirectUrl);

        console.log('🔗 [Payment] Generated Wompi URL:', checkoutUrl.toString());

        return {
            success: true,
            data: {
                checkoutUrl: checkoutUrl.toString(),
                reference
            }
        };

    } catch (error: any) {
        console.error('💥 Error:', error.message);
        return { success: false, error: 'Error inesperado al procesar pago' };
    }
}