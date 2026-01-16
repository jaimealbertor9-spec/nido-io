'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import type { VerifyPaymentResult } from './action-types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const WOMPI_API_URL = process.env.WOMPI_ENV === 'production'
    ? 'https://production.wompi.co/v1'
    : 'https://sandbox.wompi.co/v1';

export type { VerifyPaymentResult } from './action-types';

// ==============================================================================
// 1. VERIFICAR POR ID DE TRANSACCIÓN (Webhook / Widget)
// ==============================================================================
export async function verifyWompiTransaction(transactionId: string): Promise<VerifyPaymentResult> {
    try {
        if (!transactionId) return { success: false, error: 'Transaction ID is required' };

        console.log('🔍 Verifying Wompi transaction:', transactionId);

        // 1. Consultar a Wompi
        const response = await fetch(`${WOMPI_API_URL}/transactions/${transactionId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store'
        });

        if (!response.ok) return { success: false, error: 'Error al verificar el pago con Wompi' };

        const data = await response.json();
        const transaction = data.data;
        const reference = transaction.reference;

        console.log('📦 Wompi Reference:', reference);

        // 2. BUSCAR EL ID REAL EN NUESTRA BD (¡CORRECCIÓN CRÍTICA!)
        // No confiamos en el ID cortado de la referencia string.
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: pago, error: pagoError } = await supabase
            .from('pagos')
            .select('inmueble_id, estado')
            .eq('referencia_pedido', reference)
            .single();

        if (pagoError || !pago?.inmueble_id) {
            console.error('❌ Pago no encontrado en BD local:', reference);
            return { success: false, error: 'Pago no encontrado en el sistema' };
        }

        const propertyId = pago.inmueble_id; // ESTE ES EL ID COMPLETO (UUID)
        console.log('✅ ID Real recuperado:', propertyId);

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

// ==============================================================================
// 2. VERIFICAR POR REFERENCIA (Redirección)
// ==============================================================================
export async function verifyPaymentByReference(reference: string): Promise<VerifyPaymentResult> {
    try {
        if (!reference) return { success: false, error: 'Reference is required' };

        console.log('🔍 Looking up payment by reference:', reference);
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Buscar pago localmente
        const { data: payment, error: fetchError } = await supabase
            .from('pagos')
            .select('*')
            .eq('referencia_pedido', reference)
            .single();

        if (fetchError || !payment) return { success: false, error: 'Pago no encontrado' };

        // ¡CORRECCIÓN CRÍTICA! Usar siempre el ID de la base de datos, nunca el string cortado
        const propertyId = payment.inmueble_id;

        // Si ya está aprobado en nuestra BD, retornar éxito directo
        if (payment.estado === 'aprobado') {
            return { success: true, status: 'APPROVED', propertyId };
        }

        // Si está pendiente, preguntar a Wompi
        if (payment.estado === 'pendiente') {
            console.log('⏳ Payment is pending, querying Wompi...');
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

        return { success: false, status: 'PENDING', propertyId, error: 'Procesando pago...' };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ==============================================================================
// 3. LÓGICA DE ACTUALIZACIÓN (El Cerebro)
// ==============================================================================
async function processTransactionStatus(
    status: string,
    propertyId: string,
    reference: string,
    transactionId: string,
    transactionData: any
): Promise<VerifyPaymentResult> {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (status === 'APPROVED') {
        // A. Actualizar Tabla Pagos
        await supabase.from('pagos').update({
            estado: 'aprobado',
            wompi_transaction_id: transactionId,
            datos_transaccion: transactionData,
            updated_at: new Date().toISOString()
        }).eq('referencia_pedido', reference);

        // B. Actualizar Inmueble (AQUÍ FALLABA ANTES POR EL ID CORTO)
        // 1. Verificar documentos del usuario
        const { data: inmueble } = await supabase
            .from('inmuebles')
            .select('propietario_id')
            .eq('id', propertyId)
            .single();

        let newEstado = 'pendiente_verificacion';

        if (inmueble?.propietario_id) {
            const { data: verif } = await supabase
                .from('user_verifications')
                .select('estado')
                .eq('user_id', inmueble.propietario_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (verif?.estado === 'aprobado') newEstado = 'activo'; // Si ya verificado -> Publicar de una
            if (verif?.estado === 'pendiente') {
                // Si pagó, movemos su verificación a revisión manual
                await supabase.from('user_verifications')
                    .update({ estado: 'pendiente_revision' })
                    .eq('user_id', inmueble.propietario_id);
            }
        }

        // 2. Ejecutar Update del Inmueble
        const { error: updateError } = await supabase
            .from('inmuebles')
            .update({
                estado: 'en_revision', // Forzamos este estado para ver el cambio YA
                fecha_publicacion: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', propertyId); // AHORA SÍ ES UN UUID VÁLIDO

        if (updateError) {
            console.error('💥 Error updating property:', updateError);
            return { success: false, error: 'Error al actualizar propiedad: ' + updateError.message };
        }

        revalidatePath('/mis-inmuebles');
        return { success: true, status: 'APPROVED', propertyId };
    }

    return { success: false, status, propertyId, error: 'Pago no aprobado' };
}

// Helpers para la vista (se mantienen igual o simples)
export async function getPropertyStatus(propertyId: string) {
    if (!propertyId) return null;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data } = await supabase.from('inmuebles').select('estado').eq('id', propertyId).single();
    return data ? { estado: data.estado, isPendingVerification: data.estado === 'pendiente_verificacion' } : null;
}