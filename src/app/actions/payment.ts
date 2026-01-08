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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
        return { success: false, error: 'Error de configuración del servidor' };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Verificar Documentos (Usando nombres en ESPAÑOL: estado, documento_url)
        const { data: userVerifications } = await supabase
            .from('user_verifications')
            .select('estado, documento_url') // Solo pedimos lo que existe
            .eq('user_id', userId);

        const isApproved = userVerifications?.some(v => v.estado === 'aprobado');
        const hasDocuments = userVerifications?.some(v => v.documento_url !== null && v.documento_url !== '');

        if (!isApproved && !hasDocuments) {
            return { success: false, error: 'Debes subir tu documento de identidad antes de pagar.' };
        }

        // 2. Generar Firma Wompi
        const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || 'test_integrity_MBRbt4yWMK00gTx1eDF3bu1KO3nZS8Wm';
        const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || 'pub_test_lhJMu7yJM1goapO7gmaIP97Vw0XwMT4Y';

        const reference = generateReference(propertyId);
        const amountStr = String(AMOUNT_IN_CENTS);
        const signatureChain = reference + amountStr + CURRENCY + integritySecret;
        const signature = createHash('sha256').update(signatureChain).digest('hex');

        // 3. Guardar Pago en BD
        // IMPORTANTE: NO usamos 'user_id' ni 'usuario_id' como columnas sueltas porque NO existen en tu tabla 'pagos'.
        // El ID del usuario va DENTRO del JSON 'datos_transaccion'.
        const { error: insertError } = await supabase
            .from('pagos')
            .insert({
                inmueble_id: propertyId,
                referencia_pedido: reference,
                monto: AMOUNT_IN_CENTS / 100,
                estado: 'pendiente',
                metodo_pago: 'wompi_redirect',
                datos_transaccion: {
                    user_id: userId,
                    user_email: userEmail,
                    signature: signature
                }
            });

        if (insertError) {
            console.error('❌ Error insertando pago:', insertError);
            return { success: false, error: 'Error interno al registrar el pago.' };
        }

        // 4. Construir URL
        const checkoutUrl = new URL(WOMPI_CHECKOUT_URL);
        checkoutUrl.searchParams.set('public-key', publicKey);
        checkoutUrl.searchParams.set('currency', CURRENCY);
        checkoutUrl.searchParams.set('amount-in-cents', amountStr);
        checkoutUrl.searchParams.set('reference', reference);
        checkoutUrl.searchParams.set('signature:integrity', signature);
        if (redirectUrl) checkoutUrl.searchParams.set('redirect-url', redirectUrl);

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