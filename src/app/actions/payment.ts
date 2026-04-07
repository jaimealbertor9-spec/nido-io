'use server';

import { createHash } from 'crypto';
import { getServiceRoleClient } from '@/lib/supabase-admin';

const CURRENCY = 'COP';

// Wompi API endpoints - Detect based on key prefix, NOT NODE_ENV
// This prevents mismatch when using test keys in production environment
const getWompiApiBase = () => {
    const privateKey = process.env.WOMPI_PRIVATE_KEY || '';
    const isTestKey = privateKey.startsWith('prv_test_');
    const apiBase = isTestKey
        ? 'https://sandbox.wompi.co/v1'
        : 'https://production.wompi.co/v1';

    console.log(`🔧 [Payment] Wompi Env: ${isTestKey ? 'SANDBOX' : 'PRODUCTION'} (Key: ${privateKey.substring(0, 12)}...)`);
    return apiBase;
};

// Dynamic base URL for redirects
const getBaseUrl = () => {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
};

function generateReference(propertyId: string): string {
    const timestamp = Date.now();
    const shortId = propertyId.substring(0, 8);
    return `NIDO-${shortId}-${timestamp}`;
}

function generateStandaloneReference(slug: string, userId: string): string {
    const shortUser = userId.substring(0, 8);
    const rand = Math.random().toString(36).substring(2, 8);
    return `NIDO-PKG-${slug}-${shortUser}-${rand}`;
}

export async function initiatePaymentSession(
    propertyId: string | null,
    userEmail: string,
    userId: string,
    customRedirectUrl?: string,
    amountCOP?: number,
    packageSlug?: string
) {
    try {
        // ========================================
        // CRITICAL: Validate environment variables FIRST
        // ========================================
        const privateKey = process.env.WOMPI_PRIVATE_KEY;
        if (!privateKey) {
            console.error("❌ CRITICAL: WOMPI_PRIVATE_KEY is missing in server environment.");
            console.error("❌ Check Vercel Environment Variables configuration.");
            throw new Error("La configuración del servidor está incompleta (Falta Llave Wompi).");
        }

        const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || process.env.WOMPI_PUBLIC_KEY;
        if (!publicKey) {
            console.error("❌ CRITICAL: WOMPI_PUBLIC_KEY is missing in server environment.");
            throw new Error("La configuración del servidor está incompleta (Falta Llave Pública Wompi).");
        }

        const integritySecret = (process.env.WOMPI_INTEGRITY_SECRET || process.env.NEXT_PUBLIC_WOMPI_INTEGRITY_SECRET || '').trim();

        console.log('🚀 [Payment] Iniciando sesión para:', userId);
        console.log('🌐 [Payment] Base URL:', getBaseUrl());
        console.log('🔧 [Payment] NODE_ENV:', process.env.NODE_ENV);
        console.log('✅ [Payment] WOMPI_PRIVATE_KEY: PRESENT (starts with:', privateKey.substring(0, 12) + '...)');
        console.log('✅ [Payment] WOMPI_PUBLIC_KEY: PRESENT');

        const supabase = getServiceRoleClient();

        // ========================================
        // CONDITIONAL: Property & User data fetches
        // Skipped for standalone wallet purchases (propertyId = null)
        // ========================================
        let propertyTitle = 'Créditos Nido';
        let customerPhone = '';
        let customerName = userEmail.split('@')[0];

        if (propertyId) {
            console.log('📋 [Payment] Fetching property data...');
            const { data: propertyData, error: propertyError } = await supabase
                .from('inmuebles')
                .select('titulo, telefono_llamadas, whatsapp')
                .eq('id', propertyId)
                .single();

            if (propertyError) {
                console.warn('⚠️ [Payment] Could not fetch property data:', propertyError.message);
            } else {
                propertyTitle = propertyData?.titulo?.substring(0, 30) || propertyId.substring(0, 8);
            }

            // Get user phone from usuarios table
            const { data: userData, error: userError } = await supabase
                .from('usuarios')
                .select('telefono, nombre')
                .eq('id', userId)
                .single();

            if (userError) {
                console.warn('⚠️ [Payment] Could not fetch user data:', userError.message);
            }

            // Extract phone (priority: user phone > property whatsapp > property phone)
            customerPhone = userData?.telefono
                || propertyData?.whatsapp
                || propertyData?.telefono_llamadas
                || '';
            customerName = userData?.nombre || userEmail.split('@')[0];

            console.log('👤 [Payment] Customer:', customerName, customerPhone ? '(phone found)' : '(no phone)');
        }

        // ========================================
        // REFERENCE GENERATION
        // ========================================
        const isStandalone = !propertyId;
        const reference = isStandalone
            ? generateStandaloneReference(packageSlug || 'unknown', userId)
            : generateReference(propertyId);

        const finalAmountCents = amountCOP ? Math.round(amountCOP * 100) : 1000000;

        // Build dynamic redirect URL
        const baseUrl = getBaseUrl();
        const redirectUrl = isStandalone
            ? customRedirectUrl || `${baseUrl}/mis-inmuebles/planes?success=true`
            : customRedirectUrl || `${baseUrl}/publicar/exito?draftId=${propertyId}`;
        console.log('🔗 [Payment] Redirect URL:', redirectUrl);

        // ─────────────────────────────────────────────────────────────────────
        // DIRECT WEB CHECKOUT URL (no API call)
        // Wompi's /p/ endpoint returns our exact reference unchanged in the webhook.
        // Integrity signature: SHA256(reference + amount_in_cents + "COP" + secret)
        // ─────────────────────────────────────────────────────────────────────
        if (!integritySecret) {
            throw new Error('La configuración del servidor está incompleta (Falta WOMPI_INTEGRITY_SECRET).');
        }

        const signatureChain = `${reference}${finalAmountCents}${CURRENCY}${integritySecret}`;
        const integrityHash = createHash('sha256').update(signatureChain).digest('hex');
        console.log('🔐 [Payment] Integrity hash computed for reference:', reference);

        const baseParams = new URLSearchParams({
            'public-key': publicKey,
            'currency': CURRENCY,
            'amount-in-cents': String(finalAmountCents),
            'reference': reference,
        });

        // Always append redirect-url so user returns to our app after payment.
        // Note: Wompi may reject localhost URLs with a 403 during local dev.
        baseParams.append('redirect-url', redirectUrl);

        // Append signature:integrity manually — URLSearchParams encodes ':' to '%3A' which Wompi's WAF rejects with 403
        const checkoutUrl = `https://checkout.wompi.co/p/?${baseParams.toString()}&signature:integrity=${integrityHash}`;
        console.log('🔗 [Payment] Direct Web Checkout URL built (no API call)');

        // ─────────────────────────────────────────────────────────────────────
        // INSERT pagos row BEFORE redirecting the user
        // throwOnError() → any DB failure throws into the outer catch block
        // ─────────────────────────────────────────────────────────────────────
        const { data: insertedPago } = await supabase
            .from('pagos')
            .insert({
                usuario_id: userId,
                inmueble_id: propertyId,
                referencia_pedido: reference,
                monto: finalAmountCents / 100,
                estado: 'pendiente',
                metodo_pago: 'wompi_checkout',
                datos_transaccion: {
                    user_email: userEmail,
                    package_slug: packageSlug || null,
                    user_id: userId,
                    redirect_url: redirectUrl
                }
            })
            .select('id, referencia_pedido')
            .single()
            .throwOnError();

        console.log('✅ [Payment] VERIFIED: pagos row exists in DB | ID:', insertedPago?.id, '| Reference:', insertedPago?.referencia_pedido);

        return {
            success: true,
            data: { checkoutUrl, reference }
        };

    } catch (error: any) {
        console.error('💥 Server Action Failed:', error);
        console.error('💥 Error Name:', error?.name);
        console.error('💥 Error Message:', error?.message);
        console.error('💥 Error Stack:', error?.stack);
        // Return a structured error object that the client can read
        return { success: false, error: error.message || 'Error interno del servidor' };
    }
}