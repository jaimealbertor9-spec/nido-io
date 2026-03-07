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
 * LÓGICA CENTRAL DE ACTUALIZACIÓN — BLINDADA v2
 * Single Source of Truth for payment approval.
 * Called by BOTH the browser redirect AND the Wompi Webhook.
 * Implements an atomic lock to prevent race condition duplicates.
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
        console.log('✅ [Update] Status APPROVED. Attempting atomic lock...');

        // Safe Wompi transaction data to merge (never overwrites original keys)
        const safeTransactionData = {
            id: transactionData.id,
            status: transactionData.status,
            amount_in_cents: transactionData.amount_in_cents,
            payment_method_type: transactionData.payment_method_type,
            created_at: transactionData.created_at
        };

        // Fetch the existing pagos row BEFORE updating so we can deep-merge datos_transaccion
        // This preserves package_slug and other keys we stored at payment initiation (#6 Fix)
        const { data: existingPago } = await supabase
            .from('pagos')
            .select('id, usuario_id, datos_transaccion')
            .eq('referencia_pedido', reference)
            .maybeSingle();

        // Spread-merge: existing keys take precedence, then Wompi data appended
        const mergedDatosTransaccion = {
            ...(existingPago?.datos_transaccion as any || {}),
            ...safeTransactionData
        };

        // ═══════════════════════════════════════════════════════════════
        // ATOMIC LOCK (#2 / #10 Fix): Race Condition Prevention
        //   .eq('estado', 'pendiente') ensures only ONE thread wins.
        //   If another thread already set it to 'aprobado', 0 rows returned.
        // ═══════════════════════════════════════════════════════════════
        const { data: lockedRows, error: lockError } = await supabase
            .from('pagos')
            .update({
                estado: 'aprobado',
                wompi_transaction_id: transactionId,
                datos_transaccion: mergedDatosTransaccion,
                updated_at: new Date().toISOString()
            })
            .eq('referencia_pedido', reference)
            .eq('estado', 'pendiente')   // ← THE ATOMIC LOCK
            .select('id, usuario_id, inmueble_id, datos_transaccion');

        if (lockError) {
            console.error('❌ [Update] Atomic lock update error:', lockError);
        }

        // ═══════════════════════════════════════════════════════════════
        // LOCK LOST: Another thread already set estado=aprobado.
        // Amendment #3: Safety-net — ensure THIS thread's wompi_transaction_id
        // is not lost if the winning thread failed to persist it.
        // ═══════════════════════════════════════════════════════════════
        if (!lockedRows || lockedRows.length === 0) {
            console.warn('⚠️ [Update] Lock lost — another thread already processed this payment. Applying wompi_transaction_id safety-net...');
            // Best-effort: only write if not already set (prevents overwriting valid data)
            await supabase
                .from('pagos')
                .update({ wompi_transaction_id: transactionId, updated_at: new Date().toISOString() })
                .eq('referencia_pedido', reference)
                .is('wompi_transaction_id', null);
            console.log('✅ [Update] Safety-net applied. Returning success to caller.');
            return { success: true, status: 'APPROVED', propertyId };
        }

        // This thread WON the lock. Extract authoritative data.
        console.log('🔒 [Update] Atomic lock acquired. Processing payment business logic...');
        const wonRow = lockedRows[0];
        const finalPagoId = wonRow.id;
        const payerUserId = wonRow.usuario_id;
        // package_slug is now in the merged datos_transaccion we just wrote
        const finalDatos = wonRow.datos_transaccion as any;
        const packageSlug = finalDatos?.package_slug;

        console.log('💳 [Update] pago_id:', finalPagoId, '| payerUserId:', payerUserId, '| package_slug:', packageSlug || 'none (legacy)');

        // ═══════════════════════════════════════════════════════════════
        // WALLET & CREDIT MINTING BRIDGE
        // Only executes if the payment had a package_slug (paid plans)
        // ═══════════════════════════════════════════════════════════════
        let duracionDias = 30; // default fallback for legacy payments

        if (packageSlug && payerUserId) {
            console.log('📦 [Bridge] Fetching package details for slug:', packageSlug);

            const { data: pkg } = await supabase
                .from('packages')
                .select('id, creditos, duracion_anuncio_dias, features')
                .eq('slug', packageSlug)
                .single();

            if (pkg) {
                duracionDias = pkg.duracion_anuncio_dias || 30;
                console.log('📦 [Bridge] Package resolved:', packageSlug, '| credits:', pkg.creditos, '| duration:', duracionDias, 'days');

                // ─── Idempotency Guard (#7 Fix) ───
                // Tied strictly to pago_id — NOT user_id+package_id.
                // Allows repeat purchases of the same plan.
                const { data: existingWallet } = await supabase
                    .from('user_wallets')
                    .select('id')
                    .eq('pago_id', finalPagoId)
                    .maybeSingle();

                if (existingWallet) {
                    console.log('⚠️ [Bridge] Wallet already minted for this pago_id, skipping:', existingWallet.id);
                } else {
                    // ─── Mint user_wallets ───
                    // creditos_usados starts at 0 (#9 Fix). listing_credits logs each use.
                    const { data: newWallet, error: walletErr } = await supabase
                        .from('user_wallets')
                        .insert({
                            user_id: payerUserId,
                            package_id: pkg.id,
                            pago_id: finalPagoId,           // #8 Fix: persist pago_id
                            creditos_total: pkg.creditos,
                            creditos_usados: 0,             // #9 Fix: start at 0
                        })
                        .select('id')
                        .single();

                    if (walletErr || !newWallet) {
                        console.error('❌ [Bridge] Failed to create wallet:', walletErr);
                    } else {
                        console.log('✅ [Bridge] Wallet minted:', newWallet.id, '| Total credits:', pkg.creditos);

                        // ─── Mint listing_credits ───
                        const now = new Date();
                        const expiration = new Date(now);
                        expiration.setDate(expiration.getDate() + duracionDias);

                        const { error: lcError } = await supabase
                            .from('listing_credits')
                            .insert({
                                user_id: payerUserId,
                                inmueble_id: propertyId,
                                wallet_id: newWallet.id,
                                features_snapshot: pkg.features || {},
                                fecha_publicacion: now.toISOString(),
                                fecha_expiracion: expiration.toISOString(),
                            });

                        if (lcError) {
                            // ─── Application-Level Rollback (Amendment #2) ───
                            console.error('❌ [Bridge] listing_credits insert failed:', lcError.message);
                            try {
                                await supabase.from('user_wallets').delete().eq('id', newWallet.id);
                                console.warn('🔄 [Bridge] Orphaned wallet deleted during rollback:', newWallet.id);
                            } catch (deleteError: any) {
                                // Amendment #2: DELETE also failed — emit critical alert for manual intervention
                                console.error('[BRIDGE-CRITICAL] ORPHANED WALLET DETECTED. Manual cleanup required for wallet ID:', newWallet.id, deleteError);
                            }
                        } else {
                            console.log('✅ [Bridge] Listing credit minted for property:', propertyId, '| Expires:', expiration.toISOString());
                        }
                    }
                }
            } else {
                console.warn('⚠️ [Bridge] Package not found for slug:', packageSlug, '— skipping wallet creation, using 30-day expiration');
            }
        } else {
            console.warn('⚠️ [Bridge] No package_slug in merged datos_transaccion — legacy/webhook flow, using 30-day expiration');
        }

        // ─── Dates using dynamic package duration (#5 Fix) ───
        const fechaPublicacion = new Date();
        const fechaExpiracion = new Date();
        fechaExpiracion.setDate(fechaExpiracion.getDate() + duracionDias);

        // ─── Update inmueble ───
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
 * Used when Wompi redirects with ?draftId= and no transaction ID.
 *
 * SECURITY (C-1 FIX): Never auto-approve. Must verify via DB record or Wompi API.
 * Amendment #1: Explicitly handles already-aprobado case (webhook beat the browser).
 * #11 Fix: Real implementation — queries pagos, polls Wompi, routes through processTransactionStatus.
 */
async function verifyByDraftId(draftId: string): Promise<VerifyPaymentResult> {
    console.log('📋 [VerifyByDraftId] Processing for property:', draftId);

    const supabase = getServiceRoleClient();

    // ═══════════════════════════════════════════════════════════════
    // PATH A: Wallet/Credit-based publication (PLG Freemium)
    // publishWithCredits creates listing_credits — no pagos row needed
    // ═══════════════════════════════════════════════════════════════
    const { data: credit } = await supabase
        .from('listing_credits')
        .select('id')
        .eq('inmueble_id', draftId)
        .maybeSingle();

    if (credit) {
        console.log('✅ [VerifyByDraftId] PLG credit confirmed:', credit.id);
        return { success: true, status: 'APPROVED', propertyId: draftId };
    }

    // ═══════════════════════════════════════════════════════════════
    // Amendment #1: Check for ALREADY-APPROVED pagos row first.
    // If the webhook beat the browser, the row is already aprobado.
    // Return success immediately — DO NOT reprocess into processTransactionStatus.
    // ═══════════════════════════════════════════════════════════════
    const { data: approvedPago } = await supabase
        .from('pagos')
        .select('id')
        .eq('inmueble_id', draftId)
        .eq('estado', 'aprobado')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (approvedPago) {
        console.log('✅ [VerifyByDraftId] Payment already aprobado (webhook won race):', approvedPago.id, '— returning success without reprocessing.');
        return { success: true, status: 'APPROVED', propertyId: draftId };
    }

    // ═══════════════════════════════════════════════════════════════
    // PATH C: Pending payment — poll Wompi to get live status
    // Route result through processTransactionStatus (single source of truth)
    // ═══════════════════════════════════════════════════════════════
    const { data: pendingPago } = await supabase
        .from('pagos')
        .select('id, referencia_pedido, wompi_transaction_id')
        .eq('inmueble_id', draftId)
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (pendingPago?.wompi_transaction_id) {
        console.log('⏳ [VerifyByDraftId] Found pending payment, polling Wompi by txn ID:', pendingPago.wompi_transaction_id);

        const wompiResponse = await fetch(
            `${getWompiApiUrl()}/transactions/${pendingPago.wompi_transaction_id}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' }, cache: 'no-store' }
        );

        if (wompiResponse.ok) {
            const wompiData = await wompiResponse.json();
            const transaction = wompiData.data;
            return await processTransactionStatus(
                transaction.status,
                draftId,
                pendingPago.referencia_pedido,
                pendingPago.wompi_transaction_id,
                transaction
            );
        }
        console.error('❌ [VerifyByDraftId] Wompi API error polling by txn ID:', wompiResponse.status);

    } else if (pendingPago?.referencia_pedido) {
        // Has reference but no transaction ID yet — poll by reference
        console.log('⏳ [VerifyByDraftId] Pending payment without txn ID, searching Wompi by reference:', pendingPago.referencia_pedido);

        const wompiResponse = await fetch(
            `${getWompiApiUrl()}/transactions?reference=${encodeURIComponent(pendingPago.referencia_pedido)}`,
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
                    pendingPago.referencia_pedido,
                    transaction.id,
                    transaction
                );
            }
        }
    }

    // No valid payment found — refuse to approve
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