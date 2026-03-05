'use server';

/**
 * NIDO IO - Payment Verification Actions (BLINDADO)
 * Corrección de error 400 en actualización de pagos y manejo de JSON.
 */

import { revalidatePath } from 'next/cache';
import { getServiceRoleClient } from '@/lib/supabase-admin';
import type { VerifyPaymentResult } from './action-types';

// Wompi API config - Detect based on key prefix, NOT environment variables
// This prevents mismatch when using test keys in production environment
const getWompiApiUrl = () => {
    const privateKey = process.env.WOMPI_PRIVATE_KEY || '';
    const isTestKey = privateKey.startsWith('prv_test_');
    return isTestKey
        ? 'https://sandbox.wompi.co/v1'
        : 'https://production.wompi.co/v1';
};

export type { VerifyPaymentResult } from './action-types';

/**
 * Verifica transacción por ID (Widget/Webhook)
 * ENHANCED: Accepts draftId passthrough for Payment Links flow
 * @param transactionId - Wompi transaction ID (from ?id= param)
 * @param draftId - Property/Draft ID (from ?draftId= passthrough param)
 */
export async function verifyWompiTransaction(
    transactionId: string,
    draftId?: string
): Promise<VerifyPaymentResult> {
    try {
        console.log('🔍 [Verify] Starting verification - transactionId:', transactionId, 'draftId:', draftId);

        // If we have draftId but no transactionId, use direct property update flow
        if (!transactionId && draftId) {
            console.log('📋 [Verify] Using draftId passthrough flow for:', draftId);
            return await verifyByDraftId(draftId);
        }

        if (!transactionId) return { success: false, error: 'Transaction ID is required' };

        console.log('🔍 [Verify] Verifying Wompi transaction:', transactionId);

        const response = await fetch(`${getWompiApiUrl()}/transactions/${transactionId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store'
        });

        if (!response.ok) {
            console.error('❌ [Verify] Failed to fetch from Wompi:', response.status);
            return { success: false, error: 'Error connecting to Wompi' };
        }

        const data = await response.json();
        const transaction = data.data;
        const reference = transaction.reference;
        const wompiStatus = transaction.status;

        console.log('📦 [Verify] Wompi Response - Reference:', reference, 'Status:', wompiStatus);

        const supabase = getServiceRoleClient();

        // Try to find existing payment record
        const { data: pagoLocal, error: searchError } = await supabase
            .from('pagos')
            .select('inmueble_id')
            .eq('referencia_pedido', reference)
            .maybeSingle();

        let propertyId = pagoLocal?.inmueble_id;

        // ═══════════════════════════════════════════════════════════════
        // FIX: Use draftId (from URL passthrough) as PRIMARY source
        // Only fall back to parsing reference if draftId not available
        // ═══════════════════════════════════════════════════════════════
        if (!propertyId) {
            console.log('⚠️ [Verify] No local record found. Looking for property...');

            // PRIORITY 1: Use passed draftId from URL
            if (draftId) {
                console.log('📋 [Verify] Using draftId from URL passthrough:', draftId);

                // Verify the property exists
                const { data: propertyMatch, error: propError } = await supabase
                    .from('inmuebles')
                    .select('id, propietario_id')
                    .eq('id', draftId)
                    .single();

                if (propertyMatch) {
                    propertyId = propertyMatch.id;
                    console.log('✅ [Verify] Found property via draftId:', propertyId);

                    // Create the missing payment record
                    const { error: insertError } = await supabase
                        .from('pagos')
                        .insert({
                            usuario_id: propertyMatch.propietario_id,
                            inmueble_id: propertyId,
                            referencia_pedido: reference,
                            monto: (transaction.amount_in_cents || 1000000) / 100,
                            estado: 'pendiente',
                            metodo_pago: 'wompi_link',
                            wompi_transaction_id: transactionId,
                            datos_transaccion: {
                                created_from_wompi: true,
                                created_via: 'draftId_passthrough',
                                wompi_status: wompiStatus,
                                amount_in_cents: transaction.amount_in_cents
                            }
                        });

                    if (insertError) {
                        console.error('❌ [Verify] Failed to create payment record:', insertError);
                    } else {
                        console.log('✅ [Verify] Created missing payment record for property:', propertyId);
                    }
                } else {
                    console.error('❌ [Verify] Property not found for draftId:', draftId);
                }
            }

            // PRIORITY 2: Try parsing reference (legacy fallback)
            if (!propertyId && reference) {
                const refParts = reference.split('-');
                if (refParts.length >= 2 && refParts[0] === 'NIDO') {
                    const shortPropertyId = refParts[1];
                    console.log('🔍 [Verify] Trying to match property from reference:', shortPropertyId);

                    const { data: propertyMatch } = await supabase
                        .from('inmuebles')
                        .select('id, propietario_id')
                        .ilike('id', `${shortPropertyId}%`)
                        .limit(1)
                        .single();

                    if (propertyMatch) {
                        propertyId = propertyMatch.id;
                        console.log('✅ [Verify] Found property via reference parsing:', propertyId);
                    }
                }
            }
        }

        if (!propertyId) {
            console.error('❌ [Verify] Unable to determine property ID for reference:', reference);
            return {
                success: false,
                error: 'No se pudo vincular el pago con una propiedad. Contacta soporte con ref: ' + reference
            };
        }

        return await processTransactionStatus(
            wompiStatus,
            propertyId,
            reference,
            transactionId,
            transaction
        );

    } catch (error: any) {
        console.error('❌ [Verify] Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Verifica transacción por Referencia (Redirect)
 */
export async function verifyPaymentByReference(reference: string): Promise<VerifyPaymentResult> {
    try {
        if (!reference) return { success: false, error: 'Reference is required' };

        console.log('🔍 [Verify] Looking up payment by reference:', reference);
        const supabase = getServiceRoleClient();

        const { data: payment, error } = await supabase
            .from('pagos')
            .select('*')
            .eq('referencia_pedido', reference)
            .single();

        if (error || !payment) {
            console.error('❌ [Verify] Payment not found locally:', reference);
            return { success: false, error: 'Pago no encontrado' };
        }

        const propertyId = payment.inmueble_id;

        if (payment.estado === 'aprobado') {
            return { success: true, status: 'APPROVED', propertyId };
        }

        if (payment.estado === 'pendiente') {
            console.log('⏳ [Verify] Local is pending, asking Wompi...');
            const wompiResponse = await fetch(
                `${getWompiApiUrl()}/transactions?reference=${encodeURIComponent(reference)}`,
                { method: 'GET', headers: { 'Content-Type': 'application/json' }, cache: 'no-store' }
            );

            if (wompiResponse.ok) {
                const wompiData = await wompiResponse.json();
                const transactions = wompiData.data || [];
                if (transactions.length > 0) {
                    const transaction = transactions[0];
                    return await processTransactionStatus(
                        transaction.status,
                        propertyId,
                        reference,
                        transaction.id,
                        transaction
                    );
                }
            }
        }

        return { success: false, status: 'PENDING', propertyId, error: 'Pago en proceso...' };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * LÓGICA CENTRAL DE ACTUALIZACIÓN (BLINDADA)
 */
async function processTransactionStatus(
    status: string,
    propertyId: string,
    reference: string,
    transactionId: string,
    transactionData: any
): Promise<VerifyPaymentResult> {
    const supabase = getServiceRoleClient();

    if (status === 'APPROVED') {
        console.log('✅ [Update] Status APPROVED. Starting updates...');

        // 1. ACTUALIZAR TABLA PAGOS (Simplificado para evitar Error 400)
        // Solo guardamos datos esenciales en el JSON si es muy complejo
        const safeTransactionData = {
            id: transactionData.id,
            status: transactionData.status,
            amount_in_cents: transactionData.amount_in_cents,
            payment_method_type: transactionData.payment_method_type,
            created_at: transactionData.created_at
        };

        const { error: payError } = await supabase
            .from('pagos')
            .update({
                estado: 'aprobado',
                wompi_transaction_id: transactionId,
                datos_transaccion: safeTransactionData, // Guardamos versión limpia
                updated_at: new Date().toISOString()
            })
            .eq('referencia_pedido', reference);

        if (payError) {
            console.error('❌ Error updating pagos:', payError);
            // NO RETORNAMOS ERROR AQUÍ para intentar salvar el inmueble al menos
        } else {
            console.log('💳 [Update] Pagos table updated successfully');
        }

        // Recuperar el ID del pago (consulta separada para evitar conflictos de retorno)
        const { data: pagoExistente } = await supabase
            .from('pagos')
            .select('id')
            .eq('referencia_pedido', reference)
            .single();

        const finalPagoId = pagoExistente?.id;

        // 2. CALCULAR FECHAS
        const fechaPublicacion = new Date();
        const fechaExpiracion = new Date();
        fechaExpiracion.setDate(fechaExpiracion.getDate() + 30);

        // 3. ACTUALIZAR INMUEBLE
        const { error: propError } = await supabase
            .from('inmuebles')
            .update({
                estado: 'en_revision',
                pago_id: finalPagoId,
                fecha_publicacion: fechaPublicacion.toISOString(),
                fecha_expiracion: fechaExpiracion.toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', propertyId);

        if (propError) {
            console.error('❌ Error updating inmueble:', propError);
            return { success: false, error: 'Error actualizando propiedad' };
        }

        revalidatePath('/mis-inmuebles');

        return { success: true, status: 'APPROVED', propertyId };
    }

    // Manejo de rechazos
    if (status === 'DECLINED' || status === 'ERROR' || status === 'VOIDED') {
        await supabase.from('pagos').update({
            estado: 'rechazado',
            wompi_transaction_id: transactionId,
            updated_at: new Date().toISOString()
        }).eq('referencia_pedido', reference);
    }

    return { success: false, status, propertyId, error: 'Pago no aprobado: ' + status };
}

/**
 * Verify payment by Draft ID (Payment Links passthrough flow)
 * Used when Wompi redirects with ?draftId= and no transaction ID
 * 
 * SECURITY (C-1 FIX): Never auto-approve. Must verify via DB record or Wompi API.
 */
async function verifyByDraftId(draftId: string): Promise<VerifyPaymentResult> {
    console.log('📋 [VerifyByDraftId] Processing for property:', draftId);

    const supabase = getServiceRoleClient();

    // Check if property exists
    const { data: property, error: propError } = await supabase
        .from('inmuebles')
        .select('id, estado, propietario_id')
        .eq('id', draftId)
        .single();

    if (propError || !property) {
        console.error('❌ [VerifyByDraftId] Property not found:', draftId);
        return { success: false, error: 'Propiedad no encontrada' };
    }

    // Idempotency: if already processed, verify a real payment OR credit exists before confirming
    if (property.estado === 'en_revision' || property.estado === 'publicado') {
        console.log('🔍 [VerifyByDraftId] Property state is:', property.estado, '— verifying records...');

        // ═══════════════════════════════════════════════════════════════
        // PATH A: Wallet/Credit-based publication (PLG Freemium)
        // publishWithCredits creates listing_credits, NOT pagos
        // ═══════════════════════════════════════════════════════════════
        const { data: credit } = await supabase
            .from('listing_credits')
            .select('id')
            .eq('inmueble_id', draftId)
            .maybeSingle();

        if (credit) {
            console.log('✅ [VerifyByDraftId] Confirmed listing credit exists:', credit.id);
            return { success: true, status: 'APPROVED', propertyId: draftId };
        }

        // ═══════════════════════════════════════════════════════════════
        // PATH B: Wompi payment-based publication (legacy/paid plans)
        // ═══════════════════════════════════════════════════════════════
        const { data: confirmedPayment } = await supabase
            .from('pagos')
            .select('id')
            .eq('inmueble_id', draftId)
            .eq('estado', 'aprobado')
            .maybeSingle();

        if (confirmedPayment) {
            console.log('✅ [VerifyByDraftId] Confirmed payment exists:', confirmedPayment.id);
            return { success: true, status: 'APPROVED', propertyId: draftId };
        }

        // No credit or payment found — fall through to Wompi polling
        console.warn('⚠️ [VerifyByDraftId] Property in', property.estado, 'but NO credit or payment — continuing verification...');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Check for existing APPROVED payment in pagos table
    // ═══════════════════════════════════════════════════════════════
    const { data: approvedPayment } = await supabase
        .from('pagos')
        .select('id, referencia_pedido, wompi_transaction_id')
        .eq('inmueble_id', draftId)
        .eq('estado', 'aprobado')
        .maybeSingle();

    if (approvedPayment) {
        console.log('✅ [VerifyByDraftId] Found approved payment record:', approvedPayment.id);
        return await processTransactionStatus(
            'APPROVED',
            draftId,
            approvedPayment.referencia_pedido,
            approvedPayment.wompi_transaction_id || '',
            { status: 'APPROVED', verified_via: 'existing_record' }
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Check for PENDING payment — poll Wompi to confirm
    // ═══════════════════════════════════════════════════════════════
    const { data: pendingPayment } = await supabase
        .from('pagos')
        .select('id, referencia_pedido, wompi_transaction_id')
        .eq('inmueble_id', draftId)
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (pendingPayment?.wompi_transaction_id) {
        console.log('⏳ [VerifyByDraftId] Found pending payment, polling Wompi:', pendingPayment.wompi_transaction_id);

        const wompiResponse = await fetch(
            `${getWompiApiUrl()}/transactions/${pendingPayment.wompi_transaction_id}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' }, cache: 'no-store' }
        );

        if (wompiResponse.ok) {
            const wompiData = await wompiResponse.json();
            const transaction = wompiData.data;
            return await processTransactionStatus(
                transaction.status,
                draftId,
                pendingPayment.referencia_pedido,
                pendingPayment.wompi_transaction_id,
                transaction
            );
        } else {
            console.error('❌ [VerifyByDraftId] Wompi API error:', wompiResponse.status);
        }
    } else if (pendingPayment?.referencia_pedido) {
        // Has a reference but no transaction ID — try searching by reference
        console.log('⏳ [VerifyByDraftId] Pending payment without txn ID, searching by reference:', pendingPayment.referencia_pedido);

        const wompiResponse = await fetch(
            `${getWompiApiUrl()}/transactions?reference=${encodeURIComponent(pendingPayment.referencia_pedido)}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' }, cache: 'no-store' }
        );

        if (wompiResponse.ok) {
            const wompiData = await wompiResponse.json();
            const transactions = wompiData.data || [];
            if (transactions.length > 0) {
                const transaction = transactions[0];
                return await processTransactionStatus(
                    transaction.status,
                    draftId,
                    pendingPayment.referencia_pedido,
                    transaction.id,
                    transaction
                );
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: No payment found — refuse to approve
    // ═══════════════════════════════════════════════════════════════
    console.error('❌ [VerifyByDraftId] No approved or pending payment found for property:', draftId);
    return {
        success: false,
        status: 'PENDING',
        propertyId: draftId,
        error: 'No se encontró un pago válido para esta propiedad. Si ya pagaste, espera unos momentos y recarga la página.'
    };
}

// Helpers
export async function getPropertySummary(propertyId: string) {
    if (!propertyId) return null;
    const supabase = getServiceRoleClient();
    const { data } = await supabase.from('inmuebles').select('titulo, precio, barrio, ciudad').eq('id', propertyId).single();
    if (!data) return null;
    return {
        title: data.titulo,
        price: data.precio,
        offerType: 'venta',
        neighborhood: data.barrio,
        city: data.ciudad,
        coverImage: null
    };
}

export async function getPropertyStatus(propertyId: string) {
    if (!propertyId) return null;
    const supabase = getServiceRoleClient();
    const { data } = await supabase.from('inmuebles').select('estado').eq('id', propertyId).single();
    return data ? { estado: data.estado, isPendingVerification: data.estado === 'pendiente_verificacion' } : null;
}