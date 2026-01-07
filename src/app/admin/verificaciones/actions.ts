'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD SERVER ACTIONS
// Uses RPC functions for atomic approve/reject operations
// ═══════════════════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingInmueble {
    id: string;
    titulo: string | null;
    precio: number;
    tipo_negocio: string | null;
    ciudad: string | null;
    barrio: string | null;
    created_at: string;
    propietario_id: string;
    // Joined data
    propietario: {
        id: string;
        nombre: string | null;
        email: string;
    } | null;
    // Verification documents for this inmueble
    verificaciones: {
        id: string;
        tipo_documento: string;
        documento_url: string;
        estado: string;
    }[];
}

export interface ActionResult {
    success: boolean;
    error?: string;
    data?: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH PENDING INMUEBLES FOR VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchPendingInmuebles(): Promise<PendingInmueble[]> {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch inmuebles with estado = 'pendiente_verificacion'
        const { data: inmuebles, error: inmuebleError } = await supabase
            .from('inmuebles')
            .select(`
        id,
        titulo,
        precio,
        tipo_negocio,
        ciudad,
        barrio,
        created_at,
        propietario_id
      `)
            .eq('estado', 'pendiente_verificacion')
            .order('created_at', { ascending: true });

        if (inmuebleError) {
            console.error('[fetchPendingInmuebles] Error:', inmuebleError);
            return [];
        }

        if (!inmuebles || inmuebles.length === 0) {
            return [];
        }

        // For each inmueble, fetch propietario and verificaciones
        const enrichedInmuebles: PendingInmueble[] = await Promise.all(
            inmuebles.map(async (inmueble) => {
                // Fetch propietario
                const { data: propietario } = await supabase
                    .from('usuarios')
                    .select('id, nombre, email')
                    .eq('id', inmueble.propietario_id)
                    .single();

                // Fetch verification documents for this inmueble
                const { data: verificaciones } = await supabase
                    .from('user_verifications')
                    .select('id, tipo_documento, documento_url, estado')
                    .eq('inmueble_id', inmueble.id);

                return {
                    ...inmueble,
                    propietario: propietario || null,
                    verificaciones: verificaciones || [],
                };
            })
        );

        return enrichedInmuebles;
    } catch (err) {
        console.error('[fetchPendingInmuebles] Error:', err);
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
            .createSignedUrl(documentPath, 300); // 5 minutes

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
// APPROVE PUBLICATION (RPC)
// Calls admin_aprobar_publicacion RPC function
// ─────────────────────────────────────────────────────────────────────────────

export async function approvePublication(
    inmuebleId: string
): Promise<ActionResult> {
    if (!inmuebleId) {
        return { success: false, error: 'ID de inmueble requerido' };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase.rpc('admin_aprobar_publicacion', {
            p_inmueble_id: inmuebleId,
        });

        if (error) {
            console.error('[approvePublication] RPC Error:', error);
            return { success: false, error: error.message || 'Error al aprobar' };
        }

        revalidatePath('/admin/verificaciones');
        console.log(`✅ Inmueble ${inmuebleId} approved via RPC`);
        return { success: true, data };
    } catch (err: any) {
        console.error('[approvePublication] Error:', err);
        return { success: false, error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// REJECT PUBLICATION (RPC)
// Calls admin_rechazar_publicacion RPC function
// ─────────────────────────────────────────────────────────────────────────────

export async function rejectPublication(
    inmuebleId: string,
    motivo: string
): Promise<ActionResult> {
    if (!inmuebleId) {
        return { success: false, error: 'ID de inmueble requerido' };
    }

    if (!motivo || motivo.trim() === '') {
        return { success: false, error: 'Motivo de rechazo requerido' };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase.rpc('admin_rechazar_publicacion', {
            p_inmueble_id: inmuebleId,
            p_motivo: motivo.trim(),
        });

        if (error) {
            console.error('[rejectPublication] RPC Error:', error);
            return { success: false, error: error.message || 'Error al rechazar' };
        }

        revalidatePath('/admin/verificaciones');
        console.log(`❌ Inmueble ${inmuebleId} rejected via RPC`);
        return { success: true, data };
    } catch (err: any) {
        console.error('[rejectPublication] Error:', err);
        return { success: false, error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK IF USER IS ADMIN
// ─────────────────────────────────────────────────────────────────────────────

export async function checkIsAdmin(userId: string): Promise<boolean> {
    if (!userId) return false;

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Check usuarios.rol
        const { data: userData } = await supabase
            .from('usuarios')
            .select('rol')
            .eq('id', userId)
            .single();

        if (userData?.rol === 'admin') {
            return true;
        }

        // Fallback: Check auth.users app_metadata.role
        const { data: authData } = await supabase.auth.admin.getUserById(userId);
        if (authData?.user?.app_metadata?.role === 'admin') {
            return true;
        }

        return false;
    } catch (err) {
        console.error('[checkIsAdmin] Error:', err);
        return false;
    }
}
