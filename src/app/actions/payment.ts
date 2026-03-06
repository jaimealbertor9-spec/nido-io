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

export async function initiatePaymentSession(
    propertyId: string,
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

        const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || process.env.NEXT_PUBLIC_WOMPI_INTEGRITY_SECRET;

        console.log('🚀 [Payment] Iniciando sesión para:', userId);
        console.log('🌐 [Payment] Base URL:', getBaseUrl());
        console.log('🔧 [Payment] NODE_ENV:', process.env.NODE_ENV);
        console.log('✅ [Payment] WOMPI_PRIVATE_KEY: PRESENT (starts with:', privateKey.substring(0, 12) + '...)');
        console.log('✅ [Payment] WOMPI_PUBLIC_KEY: PRESENT');

        const supabase = getServiceRoleClient();
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

        // 4. Wompi credentials are already validated at function entry
        // Using privateKey, publicKey, integritySecret from the top

        const reference = generateReference(propertyId);
        const finalAmountCents = amountCOP ? Math.round(amountCOP * 100) : 1000000; // default $10K COP

        // 5. Generate integrity signature
        const signatureChain = `${reference}${finalAmountCents}${CURRENCY}${integritySecret}`;
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
            name: `Nido ${packageSlug ? packageSlug.charAt(0).toUpperCase() + packageSlug.slice(1) : 'Publicación'} - ${propertyData?.titulo?.substring(0, 30) || propertyId.substring(0, 8)}`,
            description: `Publicación de inmueble en Nido.io${packageSlug ? ` (Plan ${packageSlug})` : ''}`,
            single_use: true,
            collect_shipping: false,
            currency: CURRENCY,
            amount_in_cents: finalAmountCents,
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
                monto: finalAmountCents / 100,
                estado: 'pendiente',
                metodo_pago: 'wompi_link',
                datos_transaccion: {
                    user_email: userEmail,
                    wompi_link_id: wompiData.data.id,
                    redirect_url: redirectUrl,
                    signature: signature,
                    package_slug: packageSlug || null
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
        console.error('💥 Server Action Failed:', error);
        console.error('💥 Error Name:', error?.name);
        console.error('💥 Error Message:', error?.message);
        console.error('💥 Error Stack:', error?.stack);
        // Return a structured error object that the client can read
        return { success: false, error: error.message || 'Error interno del servidor' };
    }
}