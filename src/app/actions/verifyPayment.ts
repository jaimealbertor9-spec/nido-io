'use server';

/**
 * NIDO IO - Payment Verification Actions (CORREGIDO)
 * Soluciona el problema de campos NULL en BD y actualización de estados.
 */

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import type { VerifyPaymentResult } from './action-types';

// Initialize Supabase with Service Role to bypass RLS policies
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Wompi API config
const WOMPI_API_URL = process.env.WOMPI_ENV === 'production'
    ? 'https://production.wompi.co/v1'
    : 'https://sandbox.wompi.co/v1';

export type { VerifyPaymentResult } from './action-types';

/**
 * Verifica transacción por ID (Widget/Webhook)
 */
export async function verifyWompiTransaction(transactionId: string): Promise<VerifyPaymentResult> {
    try {
        if (!transactionId) return { success: false, error: 'Transaction ID is required' };

        console.log('🔍 [Verify] Verifying Wompi transaction:', transactionId);

        const response = await fetch(`${WOMPI_API_URL}/transactions/${transactionId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store'
        });

        if (!response.ok) return { success: false, error: 'Error connecting to Wompi' };

        const data = await response.json();
        const transaction = data.data;
        const reference = transaction.reference;

        console.log('📦 [Verify] Wompi Reference:', reference);

        // Recuperar ID real desde la base de datos usando la referencia
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: pagoLocal } = await supabase
            .from('pagos')
            .select('inmueble_id')
            .eq('referencia_pedido', reference)
            .single();

        // Si no encontramos el pago por referencia, intentamos extraer del string (fallback)
        let propertyId = pagoLocal?.inmueble_id;

        if (!propertyId) {
            const referenceParts = reference.split('-');
            // NIDO-{UUID}-{TIMESTAMP} -> UUID está en índice 1? No, el UUID se corta. 
            // Mejor confiamos en que el pago YA existe en BD.
            console.error('❌ [Verify] Pago no encontrado en BD para referencia:', reference);
            // Intentamos buscar el inmueble asociado a esta referencia si el pago falló al crearse
            return { success: false, error: 'Pago no encontrado en sistema local' };
        }

        return await processTransactionStatus(
            transaction.status,
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
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Buscar el pago en BD
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

        // Si ya está aprobado, retornamos éxito de una
        if (payment.estado === 'aprobado') {
            return { success: true, status: 'APPROVED', propertyId };
        }

        // Si está pendiente, consultamos a Wompi
        if (payment.estado === 'pendiente') {
            console.log('⏳ [Verify] Local is pending, asking Wompi...');
            const wompiResponse = await fetch(
                `${WOMPI_API_URL}/transactions?reference=${encodeURIComponent(reference)}`,
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
 * LÓGICA CENTRAL DE ACTUALIZACIÓN (CEREBRO ARREGLADO)
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
        console.log('✅ [Update] Status APPROVED. Starting updates...');

        // 1. ACTUALIZAR TABLA PAGOS
        // Usamos select() para confirmar que devuelve datos y asegurar que el ID existe
        const { data: updatedPayment, error: payError } = await supabase
            .from('pagos')
            .update({
                estado: 'aprobado',
                wompi_transaction_id: transactionId,
                datos_transaccion: transactionData,
                updated_at: new Date().toISOString()
            })
            .eq('referencia_pedido', reference)
            .select('id') // Importante: Retornar ID para usarlo abajo
            .single();

        if (payError) console.error('❌ Error updating pagos:', payError);

        // Si no se actualizó el pago (ej: no encontrado), intentamos recuperar su ID igual
        let finalPagoId = updatedPayment?.id;
        if (!finalPagoId) {
            const { data: existing } = await supabase.from('pagos').select('id').eq('referencia_pedido', reference).single();
            finalPagoId = existing?.id;
        }

        console.log('💳 [Update] Pago ID linked:', finalPagoId);

        // 2. CALCULAR FECHAS
        const fechaPublicacion = new Date();
        const fechaExpiracion = new Date();
        fechaExpiracion.setDate(fechaExpiracion.getDate() + 30); // 30 días

        // 3. ACTUALIZAR INMUEBLE (CON TODOS LOS CAMPOS QUE FALTABAN)
        const { error: propError } = await supabase
            .from('inmuebles')
            .update({
                estado: 'en_revision', // Forzamos estado activo/revisión
                pago_id: finalPagoId,   // <--- AQUI ESTABA EL ERROR (FALTABA ESTO)
                fecha_publicacion: fechaPublicacion.toISOString(),
                fecha_expiracion: fechaExpiracion.toISOString(), // <--- Y ESTO
                updated_at: new Date().toISOString(),
            })
            .eq('id', propertyId);

        if (propError) {
            console.error('❌ Error updating inmueble:', propError);
            return { success: false, error: 'Error actualizando propiedad' };
        }

        // 4. Revalidar Caché
        revalidatePath('/mis-inmuebles');
        revalidatePath(`/inmueble/${propertyId}`);

        console.log('🎉 [Update] Full success. DB updated correctly.');
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

// Helpers visuales
export async function getPropertySummary(propertyId: string) {
    if (!propertyId) return null;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data } = await supabase.from('inmuebles').select('titulo, precio, barrio, ciudad').eq('id', propertyId).single();
    if (!data) return null;
    return {
        title: data.titulo,
        price: data.precio,
        offerType: 'venta',
        neighborhood: data.barrio,
        city: data.ciudad,
        coverImage: null // Opcional
    };
}

export async function getPropertyStatus(propertyId: string) {
    if (!propertyId) return null;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data } = await supabase.from('inmuebles').select('estado').eq('id', propertyId).single();
    return data ? { estado: data.estado, isPendingVerification: data.estado === 'pendiente_verificacion' } : null;
}