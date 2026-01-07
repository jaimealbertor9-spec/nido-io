'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN VERIFICATION ACTIONS
// Per-inmueble verification system with Spanish enums
// ═══════════════════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type TipoDocumento = 'cedula' | 'poder';
export type EstadoVerificacion = 'pendiente' | 'aprobado' | 'rechazado';
export type EstadoInmueble =
    | 'borrador'
    | 'listo_para_pago'
    | 'pendiente_verificacion'
    | 'activo'
    | 'rechazado'
    | 'pausado'
    | 'vendido';

export interface PendingVerification {
    id: string;
    user_id: string;
    inmueble_id: string;
    tipo_documento: TipoDocumento;
    documento_url: string;
    estado: EstadoVerificacion;
    observaciones_admin: string | null;
    created_at: string;
    // Joined data
    usuario: {
        id: string;
        nombre: string | null;
        email: string;
    } | null;
    inmueble: {
        id: string;
        titulo: string | null;
        ciudad: string | null;
    } | null;
}

export interface ActionResult {
    success: boolean;
    error?: string;
    data?: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH PENDING VERIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchPendingVerifications(): Promise<PendingVerification[]> {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase
            .from('user_verifications')
            .select(`
        *,
        usuario:usuarios!user_verifications_user_id_fkey(id, nombre, email),
        inmueble:inmuebles!user_verifications_inmueble_id_fkey(id, titulo, ciudad)
      `)
            .eq('estado', 'pendiente')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[fetchPendingVerifications] Error:', error);
            return [];
        }

        return (data || []) as PendingVerification[];
    } catch (err) {
        console.error('[fetchPendingVerifications] Error:', err);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET SIGNED URL FOR PRIVATE DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function getSignedDocumentUrl(
    documentPath: string
): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!documentPath) {
        return { success: false, error: 'Ruta de documento no proporcionada' };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase.storage
            .from('kyc-documents')
            .createSignedUrl(documentPath, 60); // 60 seconds

        if (error || !data?.signedUrl) {
            console.error('[getSignedDocumentUrl] Error:', error);
            return { success: false, error: 'Error al generar URL' };
        }

        return { success: true, url: data.signedUrl };
    } catch (err: any) {
        console.error('[getSignedDocumentUrl] Error:', err);
        return { success: false, error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE VERIFICATION
// Updates user_verifications.estado to 'aprobado'
// Updates inmuebles.estado to 'activo' if all docs for that inmueble are approved
// ─────────────────────────────────────────────────────────────────────────────

export async function approveVerification(
    verificationId: string
): Promise<ActionResult> {
    if (!verificationId) {
        return { success: false, error: 'ID de verificación requerido' };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Get the verification record
        const { data: verification, error: fetchError } = await supabase
            .from('user_verifications')
            .select('inmueble_id')
            .eq('id', verificationId)
            .single();

        if (fetchError || !verification) {
            return { success: false, error: 'Verificación no encontrada' };
        }

        // 2. Update verification to 'aprobado'
        const { error: updateError } = await supabase
            .from('user_verifications')
            .update({
                estado: 'aprobado',
                updated_at: new Date().toISOString(),
            })
            .eq('id', verificationId);

        if (updateError) {
            console.error('[approveVerification] Update error:', updateError);
            return { success: false, error: 'Error al aprobar' };
        }

        // 3. Check if all cedula docs for this inmueble are approved
        const { data: pendingDocs } = await supabase
            .from('user_verifications')
            .select('id')
            .eq('inmueble_id', verification.inmueble_id)
            .eq('tipo_documento', 'cedula')
            .eq('estado', 'pendiente');

        // 4. If no more pending cedula docs, update inmueble to 'activo'
        if (!pendingDocs || pendingDocs.length === 0) {
            const { error: inmuebleError } = await supabase
                .from('inmuebles')
                .update({
                    estado: 'activo',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', verification.inmueble_id)
                .eq('estado', 'pendiente_verificacion'); // Only update if in this state

            if (inmuebleError) {
                console.warn('[approveVerification] Inmueble update warning:', inmuebleError);
            }
        }

        revalidatePath('/admin/verification');
        console.log(`✅ Verification ${verificationId} approved`);
        return { success: true };
    } catch (err: any) {
        console.error('[approveVerification] Error:', err);
        return { success: false, error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// REJECT VERIFICATION
// Updates user_verifications.estado to 'rechazado'
// Updates inmuebles.estado to 'rechazado'
// ─────────────────────────────────────────────────────────────────────────────

export async function rejectVerification(
    verificationId: string,
    reason: string
): Promise<ActionResult> {
    if (!verificationId) {
        return { success: false, error: 'ID de verificación requerido' };
    }

    if (!reason || reason.trim() === '') {
        return { success: false, error: 'Motivo de rechazo requerido' };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Get the verification record
        const { data: verification, error: fetchError } = await supabase
            .from('user_verifications')
            .select('inmueble_id')
            .eq('id', verificationId)
            .single();

        if (fetchError || !verification) {
            return { success: false, error: 'Verificación no encontrada' };
        }

        // 2. Update verification to 'rechazado' with reason
        const { error: updateError } = await supabase
            .from('user_verifications')
            .update({
                estado: 'rechazado',
                observaciones_admin: reason,
                updated_at: new Date().toISOString(),
            })
            .eq('id', verificationId);

        if (updateError) {
            console.error('[rejectVerification] Update error:', updateError);
            return { success: false, error: 'Error al rechazar' };
        }

        // 3. Update inmueble to 'rechazado'
        const { error: inmuebleError } = await supabase
            .from('inmuebles')
            .update({
                estado: 'rechazado',
                updated_at: new Date().toISOString(),
            })
            .eq('id', verification.inmueble_id);

        if (inmuebleError) {
            console.warn('[rejectVerification] Inmueble update warning:', inmuebleError);
        }

        revalidatePath('/admin/verification');
        console.log(`❌ Verification ${verificationId} rejected`);
        return { success: true };
    } catch (err: any) {
        console.error('[rejectVerification] Error:', err);
        return { success: false, error: err.message };
    }
}
