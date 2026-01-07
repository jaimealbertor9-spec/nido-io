'use server';

/**
 * NIDO IO - Payment Verification Actions
 * 
 * Handles verifying Wompi transactions and updating property/payment status.
 * Supports both transaction ID and reference lookups.
 */

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import type { VerifyPaymentResult } from './action-types';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Wompi API config
const WOMPI_API_URL = process.env.WOMPI_ENV === 'production'
    ? 'https://production.wompi.co/v1'
    : 'https://sandbox.wompi.co/v1';

// Re-export the type for consumers
export type { VerifyPaymentResult } from './action-types';

/**
 * Verifies a Wompi transaction by transaction ID and updates the property status
 * @param transactionId - The Wompi transaction ID
 * @returns Verification result
 */
export async function verifyWompiTransaction(transactionId: string): Promise<VerifyPaymentResult> {
    try {
        if (!transactionId) {
            return { success: false, error: 'Transaction ID is required' };
        }

        console.log('🔍 Verifying Wompi transaction:', transactionId);

        // Fetch transaction from Wompi API
        const response = await fetch(`${WOMPI_API_URL}/transactions/${transactionId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.error('Wompi API error:', response.status);
            return { success: false, error: 'Error al verificar el pago' };
        }

        const data = await response.json();
        const transaction = data.data;

        console.log('📦 Wompi transaction data:', transaction);

        // Extract property ID from reference (format: NIDO-{propertyId}-{timestamp})
        const reference = transaction.reference || '';
        const referenceParts = reference.split('-');
        const propertyId = referenceParts.length >= 2 ? referenceParts[1] : null;

        if (!propertyId) {
            return { success: false, error: 'No se pudo identificar la propiedad' };
        }

        // Process based on status
        return await processTransactionStatus(
            transaction.status,
            propertyId,
            reference,
            transactionId,
            transaction
        );

    } catch (error: any) {
        console.error('❌ Error verifying payment:', error);
        return { success: false, error: error.message || 'Error inesperado' };
    }
}

/**
 * Verifies a payment by reference (used when returning from redirect)
 * @param reference - The payment reference (e.g., NIDO-abc12345-1234567890)
 * @returns Verification result
 */
export async function verifyPaymentByReference(reference: string): Promise<VerifyPaymentResult> {
    try {
        if (!reference) {
            return { success: false, error: 'Reference is required' };
        }

        console.log('🔍 Looking up payment by reference:', reference);

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Find payment in our database
        const { data: payment, error: fetchError } = await supabase
            .from('pagos')
            .select('*')
            .eq('referencia_pedido', reference)
            .single();

        if (fetchError || !payment) {
            console.error('Payment not found:', fetchError?.message);
            return { success: false, error: 'Pago no encontrado' };
        }

        console.log('📦 Found payment record:', payment);

        // Extract property ID from reference
        const referenceParts = reference.split('-');
        const propertyId = referenceParts.length >= 2 ? referenceParts[1] : payment.inmueble_id;

        // If payment is already approved, return success
        if (payment.estado === 'aprobado') {
            return { success: true, status: 'APPROVED', propertyId };
        }

        // If pending, try to verify with Wompi API using the reference
        if (payment.estado === 'pendiente') {
            console.log('⏳ Payment is pending, checking with Wompi API...');

            // Query Wompi API by reference
            const wompiResponse = await fetch(
                `${WOMPI_API_URL}/transactions?reference=${encodeURIComponent(reference)}`,
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            if (wompiResponse.ok) {
                const wompiData = await wompiResponse.json();
                const transactions = wompiData.data || [];

                if (transactions.length > 0) {
                    const transaction = transactions[0];
                    console.log('📦 Wompi transaction found:', transaction.status);

                    return await processTransactionStatus(
                        transaction.status,
                        propertyId,
                        reference,
                        transaction.id,
                        transaction
                    );
                }
            }

            // No transaction found yet - still pending
            return {
                success: false,
                status: 'PENDING',
                propertyId,
                error: 'El pago aún está siendo procesado'
            };
        }

        // Payment was rejected
        return {
            success: false,
            status: payment.estado?.toUpperCase(),
            propertyId,
            error: 'El pago fue rechazado'
        };

    } catch (error: any) {
        console.error('❌ Error verifying by reference:', error);
        return { success: false, error: error.message || 'Error inesperado' };
    }
}

/**
 * Process transaction status and update database
 */
async function processTransactionStatus(
    status: string,
    propertyId: string,
    reference: string,
    transactionId: string,
    transactionData: any
): Promise<VerifyPaymentResult> {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (status === 'APPROVED') {
        // Update payment record
        const { error: paymentError } = await supabase
            .from('pagos')
            .update({
                estado: 'aprobado',
                wompi_transaction_id: transactionId,
                datos_transaccion: transactionData,
                updated_at: new Date().toISOString()
            })
            .eq('referencia_pedido', reference);

        if (paymentError) {
            console.error('Error updating payment:', paymentError);
        }

        // ═══════════════════════════════════════════════════════════════
        // DETERMINE INMUEBLE ESTADO BASED ON DOCUMENT VERIFICATION STATUS
        // If user documents are approved -> 'activo' (visible)
        // If user documents are pending -> 'pendiente_verificacion' (not visible)
        // ═══════════════════════════════════════════════════════════════

        // Get the inmueble owner ID
        const { data: inmuebleData } = await supabase
            .from('inmuebles')
            .select('propietario_id')
            .eq('id', propertyId)
            .single();

        let newEstado = 'pendiente_verificacion'; // Default: pending until docs approved

        if (inmuebleData?.propietario_id) {
            // Check if user has any approved verification document
            const { data: verificationData } = await supabase
                .from('user_verifications')
                .select('id, estado')
                .eq('user_id', inmuebleData.propietario_id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (verificationData && verificationData.length > 0) {
                const currentStatus = verificationData[0].estado;

                if (currentStatus === 'aprobado') {
                    // User is already verified -> property can be active (visible)
                    newEstado = 'activo';
                    console.log('✅ User is verified, setting inmueble to ACTIVO');
                } else if (currentStatus === 'pendiente') {
                    // ═══════════════════════════════════════════════════════════════
                    // TRANSITION TO REVIEW QUEUE
                    // User has paid -> move from 'pendiente' to 'pendiente_revision'
                    // This places them in the admin review queue
                    // ═══════════════════════════════════════════════════════════════
                    const { error: transitionError } = await supabase
                        .from('user_verifications')
                        .update({
                            estado: 'pendiente_revision',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', verificationData[0].id);

                    if (transitionError) {
                        console.error('Error transitioning to pendiente_revision:', transitionError);
                    } else {
                        console.log('📋 User transitioned to PENDIENTE_REVISION (admin review queue)');
                    }

                    console.log('⏳ User documents in review, setting inmueble to PENDIENTE_VERIFICACION');
                } else {
                    // pendiente_revision or other status
                    console.log(`⏳ User status is ${currentStatus}, setting inmueble to PENDIENTE_VERIFICACION`);
                }
            } else {
                console.log('⚠️ No verification record found for user');
            }
        }

        // Update property status based on verification
        const { error: updateError } = await supabase
            .from('inmuebles')
            .update({
                estado: newEstado,
                fecha_publicacion: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', propertyId);

        if (updateError) {
            console.error('Error updating property:', updateError);
            return { success: false, error: 'Error al actualizar la propiedad' };
        }

        revalidatePath('/mis-inmuebles');
        revalidatePath(`/inmueble/${propertyId}`);

        console.log(`✅ Payment verified. Property ${propertyId} set to: ${newEstado}`);
        return { success: true, status: 'APPROVED', propertyId };
    }

    if (status === 'PENDING') {
        return {
            success: false,
            status: 'PENDING',
            propertyId,
            error: 'Pago pendiente de confirmación'
        };
    }

    if (status === 'DECLINED' || status === 'ERROR' || status === 'VOIDED') {
        // Update payment as rejected
        await supabase
            .from('pagos')
            .update({
                estado: 'rechazado',
                wompi_transaction_id: transactionId,
                datos_transaccion: transactionData,
                updated_at: new Date().toISOString()
            })
            .eq('referencia_pedido', reference);

        return { success: false, status, propertyId, error: 'El pago fue rechazado' };
    }

    return { success: false, status, propertyId, error: 'Estado de pago desconocido' };
}

/**
 * Gets property summary for payment page
 */
export async function getPropertySummary(propertyId: string): Promise<{
    title: string;
    price: number;
    offerType: string;
    neighborhood: string;
    city: string;
    coverImage: string | null;
} | null> {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get property data
        const { data: property, error } = await supabase
            .from('inmuebles')
            .select('titulo, precio, tipo_negocio, barrio, ciudad')
            .eq('id', propertyId)
            .single();

        if (error || !property) {
            return null;
        }

        // Get first image for cover
        const { data: images } = await supabase
            .from('inmueble_imagenes')
            .select('url')
            .eq('inmueble_id', propertyId)
            .eq('category', 'fachada')
            .limit(1);

        return {
            title: property.titulo || 'Sin título',
            price: property.precio || 0,
            offerType: property.tipo_negocio || 'venta',
            neighborhood: property.barrio || '',
            city: property.ciudad || 'Líbano, Tolima',
            coverImage: images?.[0]?.url || null,
        };

    } catch (err) {
        console.error('Error fetching property summary:', err);
        return null;
    }
}

/**
 * Gets the current estado of a property
 */
export async function getPropertyStatus(propertyId: string): Promise<{
    estado: string;
    isPendingVerification: boolean;
} | null> {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase
            .from('inmuebles')
            .select('estado')
            .eq('id', propertyId)
            .single();

        if (error || !data) {
            return null;
        }

        return {
            estado: data.estado || 'borrador',
            isPendingVerification: data.estado === 'pendiente_verificacion',
        };
    } catch (err) {
        console.error('Error fetching property status:', err);
        return null;
    }
}
