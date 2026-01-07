'use server';

/**
 * NIDO IO - Payment Server Action (Redirect Method)
 * Safe Architecture: Reads env vars at Runtime only.
 */

import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// ============================================
// CONSTANTS
// ============================================

const AMOUNT_IN_CENTS = 1000000; // $10,000 COP
const CURRENCY = 'COP';
const WOMPI_CHECKOUT_URL = 'https://checkout.wompi.co/p/';

// ============================================
// TYPES
// ============================================

export interface PaymentSessionResult {
    success: boolean;
    data?: {
        checkoutUrl: string;
        reference: string;
        amountInCents: number;
        currency: string;
    };
    error?: string;
}

// ============================================
// HELPER: Generate unique reference
// ============================================

function generateReference(propertyId: string): string {
    const timestamp = Date.now();
    const shortId = propertyId.substring(0, 8);
    return `NIDO-${shortId}-${timestamp}`;
}

// ============================================
// MAIN ACTION: initiatePaymentSession
// ============================================

export async function initiatePaymentSession(
    propertyId: string,
    userEmail: string,
    userId: string,
    redirectUrl?: string
): Promise<PaymentSessionResult> {
    console.log('🚀 [Payment] initiatePaymentSession CALLED');

    // 🛡️ RUNTIME ENV LOADING (Prevents Build Crash)
    // Lee las variables SOLO cuando se ejecuta la función, no al compilar
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('❌ Missing Supabase configuration');
        return { success: false, error: 'Error de configuración del servidor' };
    }

    try {
        // STEP 1: Validate inputs
        if (!propertyId || !userId) {
            return { success: false, error: 'Datos incompletos.' };
        }

        // STEP 1.5: Verify Documents
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const { data: userVerifications } = await supabase
            .from('user_verifications')
            .select('estado, tipo_documento, documento_url')
            .eq('user_id', userId);

        const isApproved = userVerifications?.some(v => v.estado === 'aprobado');
        const hasCedula = userVerifications?.some(v => v.tipo_documento === 'cedula' && v.documento_url);

        if (!isApproved && !hasCedula) {
             return { success: false, error: 'Debes subir tu documento de identidad (Cédula) antes de pagar.' };
        }

        // STEP 2: Credentials & Signature
        const integritySecret = 'test_integrity_MBRbt4yWMK00gTx1eDF3bu1KO3nZS8Wm';
        const publicKey = 'pub_test_lhJMu7yJM1goapO7gmaIP97Vw0XwMT4Y';
        
        const reference = generateReference(propertyId);
        const amountStr = String(AMOUNT_IN_CENTS);
        const signatureChain = reference + amountStr + CURRENCY + integritySecret;
        const signature = createHash('sha256').update(signatureChain).digest('hex');

        // STEP 3: Build URL
        const checkoutUrl = new URL(WOMPI_CHECKOUT_URL);
        checkoutUrl.searchParams.set('public-key', publicKey);
        checkoutUrl.searchParams.set('currency', CURRENCY);
        checkoutUrl.searchParams.set('amount-in-cents', amountStr);
        checkoutUrl.searchParams.set('reference', reference);
        checkoutUrl.searchParams.set('signature:integrity', signature);

        // STEP 4: Save Pending Payment
        await supabase.from('pagos').insert({
            inmueble_id: propertyId,
            referencia_pedido: reference,
            monto: AMOUNT_IN_CENTS / 100,
            estado: 'pendiente',
            metodo_pago: 'wompi_redirect',
            datos_transaccion: {
                user_id: userId,
                user_email: userEmail,
                signature: signature,
                checkout_url: checkoutUrl.toString()
            }
        });

        return {
            success: true,
            data: {
                checkoutUrl: checkoutUrl.toString(),
                reference,
                amountInCents: AMOUNT_IN_CENTS,
                currency: CURRENCY
            }
        };

    } catch (error: any) {
        console.error('💥 [Payment] Error:', error.message);
        return { success: false, error: 'Error al iniciar pago' };
    }
}

// Helper for status updates
export async function updatePaymentStatus(reference: string, status: string, txData?: any) {
    // 🛡️ También protegemos esta función auxiliar
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) return false;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error } = await supabase
        .from('pagos')
        .update({ estado: status, datos_transaccion: txData, updated_at: new Date().toISOString() })
        .eq('referencia_pedido', reference);

    return !error;
}