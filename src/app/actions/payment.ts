'use server';

import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const AMOUNT_IN_CENTS = 1000000; // $10,000 COP
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

export async function initiatePaymentSession(
    propertyId: string,
    userEmail: string,
    userId: string,
    customRedirectUrl?: string
) {
    console.log('🚀 [Payment] Iniciando sesión para:', userId);
    console.log('🌐 [Payment] Base URL:', getBaseUrl());
    console.log('🔧 [Payment] NODE_ENV:', process.env.NODE_ENV);
    console.log('📡 [Payment] Using Wompi API:', WOMPI_API_BASE);

    // 1. Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    console.log('🔑 [Payment] SUPABASE_SERVICE_ROLE_KEY defined:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!supabaseUrl || !supabaseServiceKey) {
        return { success: false, error: 'Error de configuración del servidor' };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 2. Fetch property and user data for customer info
        console.log('📋 [Payment] Fetching property data...');
        const { data: propertyData, error: propertyError } = await supabase
            .from('inmuebles')
            .select('titulo, telefono_llamadas, whatsapp')
            .eq('id', propertyId)
            .single();

        if (propertyError) {
            console.warn('⚠️ [Payment] Could not fetch property data:', propertyError.message);
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
        const customerPhone = userData?.telefono
            || propertyData?.whatsapp
            || propertyData?.telefono_llamadas
            || '';
        const customerName = userData?.nombre || userEmail.split('@')[0];

        console.log('👤 [Payment] Customer:', customerName, customerPhone ? '(phone found)' : '(no phone)');

        // 3. Verify user documents
        const { data: userVerifications } = await supabase
            .from('user_verifications')
            .select('estado, documento_url')
            .eq('user_id', userId) as { data: any[], error: any };

        const isApproved = userVerifications?.some((v: any) => v.estado === 'aprobado');
        const hasDocuments = userVerifications?.some((v: any) => v.documento_url !== null && v.documento_url !== '');

        if (!isApproved && !hasDocuments) {
            return { success: false, error: 'Debes subir tu documento de identidad antes de pagar.' };
        }

        // 4. Get Wompi credentials
        const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || process.env.WOMPI_PUBLIC_KEY;
        const privateKey = process.env.WOMPI_PRIVATE_KEY;
        const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || process.env.NEXT_PUBLIC_WOMPI_INTEGRITY_SECRET;

        if (!publicKey) {
            console.error('❌ [Payment] Missing WOMPI_PUBLIC_KEY');
            throw new Error('Configuration Error: WOMPI_PUBLIC_KEY is missing');
        }
        if (!privateKey) {
            console.error('❌ [Payment] Missing WOMPI_PRIVATE_KEY');
            throw new Error('Configuration Error: WOMPI_PRIVATE_KEY is missing');
        }

        console.log('✅ [Payment] Wompi configuration validated');

        const reference = generateReference(propertyId);
        const amountInCentsInt = Math.round(Number(AMOUNT_IN_CENTS));

        // 5. Generate integrity signature
        const signatureChain = `${reference}${amountInCentsInt}${CURRENCY}${integritySecret}`;
        const signature = createHash('sha256').update(signatureChain).digest('hex');
        console.log('🔐 [Payment] Signature generated for reference:', reference);

        // 6. Build dynamic redirect URL with draftId passthrough
        // IMPORTANT: Wompi Payment Links use opaque references, so we pass draftId via URL
        const baseUrl = getBaseUrl();
        const redirectUrl = customRedirectUrl || `${baseUrl}/publicar/exito?draftId=${propertyId}`;
        console.log('🔗 [Payment] Redirect URL:', redirectUrl);

        // 7. Create Payment Link via Wompi API
        console.log('📡 [Payment] Calling Wompi Payment Links API...');

        const paymentLinkPayload: any = {
            name: `Publicación - ${propertyData?.titulo?.substring(0, 30) || propertyId.substring(0, 8)}`,
            description: 'Publicación de inmueble en Nido.io',
            single_use: true,
            collect_shipping: false,
            currency: CURRENCY,
            amount_in_cents: amountInCentsInt,
            redirect_url: redirectUrl
        };

        // NOTE: customer_data is OPTIONAL for payment_links
        // We skip it to avoid 422 validation errors with customer_references format
        // The reference is stored in our DB and passed via redirect_url query params

        console.log('📦 [Payment] Payload:', JSON.stringify(paymentLinkPayload, null, 2));

        const wompiResponse = await fetch(`${getWompiApiBase()}/payment_links`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${privateKey}`
            },
            body: JSON.stringify(paymentLinkPayload)
        });

        const responseText = await wompiResponse.text();

        if (!wompiResponse.ok) {
            console.error('❌ [Payment] Wompi API Error:', wompiResponse.status, responseText);
            throw new Error(`Wompi API Error ${wompiResponse.status}: ${responseText}`);
        }

        const wompiData = JSON.parse(responseText);
        console.log('✅ [Payment] Wompi Payment Link created:', wompiData.data?.id);

        // The checkout URL from Payment Links API
        const checkoutUrl = `https://checkout.wompi.co/l/${wompiData.data.id}`;

        // 8. Save payment record to DB
        const { error: insertError } = await supabase
            .from('pagos')
            .insert({
                usuario_id: userId,
                inmueble_id: propertyId,
                referencia_pedido: reference,
                monto: amountInCentsInt / 100,
                estado: 'pendiente',
                metodo_pago: 'wompi_link',
                datos_transaccion: {
                    user_email: userEmail,
                    wompi_link_id: wompiData.data.id,
                    redirect_url: redirectUrl,
                    signature: signature
                }
            });

        if (insertError) {
            console.error('❌ [Payment] DB Insert error:', insertError);
            return { success: false, error: `DB Error: ${insertError.message}` };
        }

        console.log('🔗 [Payment] Generated Wompi Checkout URL:', checkoutUrl);

        return {
            success: true,
            data: {
                checkoutUrl,
                reference,
                wompiLinkId: wompiData.data.id
            }
        };

    } catch (error: any) {
        console.error('💥 [Payment] Error:', error.message);
        return { success: false, error: error.message || 'Error inesperado al procesar pago' };
    }
}