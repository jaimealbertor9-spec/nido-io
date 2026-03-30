'use server';

import { createServerSupabaseClient } from '../../lib/supabase-server';
import { getServiceRoleClient } from '../../lib/supabase-admin';
import { revalidatePath } from 'next/cache';

export async function getPendingRevision(inmuebleId: string) {
    if (!inmuebleId) return null;

    try {
        const supabase = createServerSupabaseClient();
        
        // Verify user owns the property
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: property, error: propError } = await supabase
            .from('inmuebles')
            .select('propietario_id')
            .eq('id', inmuebleId)
            .single();
            
        if (propError || property?.propietario_id !== user.id) {
            return null; // Not authorized
        }

        const adminSupabase = getServiceRoleClient();

        const { data: revision, error: revError } = await adminSupabase
            .from('revisiones_inmueble')
            .select('*')
            .eq('inmueble_id', inmuebleId)
            .eq('estado_revision', 'pendiente_de_correccion')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (revError || !revision) return null;

        let imageUrls: string[] = [];
        if (revision.imagenes_adjuntas && revision.imagenes_adjuntas.length > 0) {
            const { data: signedUrls, error: urlError } = await adminSupabase.storage
                .from('admin-revision-assets')
                .createSignedUrls(revision.imagenes_adjuntas, 60 * 60 * 24); // 24 hours

            if (!urlError && signedUrls) {
                imageUrls = signedUrls.map(u => u.signedUrl).filter(Boolean) as string[];
            } else {
                console.error('[RevisionActions] Error generating signed URLs:', urlError);
            }
        }

        return {
            ...revision,
            imageUrls
        };
    } catch (error) {
        console.error('[RevisionActions] Error fetching pending revision:', error);
        return null;
    }
}

export async function markRevisionAsCorrected(inmuebleId: string) {
    if (!inmuebleId) return { success: false, error: 'inmuebleId is required' };

    try {
        const supabase = createServerSupabaseClient();
        
        // Verify user owns the property
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Unauthorized' };

        const { data: property, error: propError } = await supabase
            .from('inmuebles')
            .select('propietario_id')
            .eq('id', inmuebleId)
            .single();
            
        if (propError || property?.propietario_id !== user.id) {
            return { success: false, error: 'Unauthorized to modify this property' };
        }

        const adminSupabase = getServiceRoleClient();

        const { error } = await adminSupabase
            .from('revisiones_inmueble')
            .update({ estado_revision: 'corregido' })
            .eq('inmueble_id', inmuebleId)
            .eq('estado_revision', 'pendiente_de_correccion');

        if (error) throw error;

        revalidatePath(`/publicar/crear/${inmuebleId}/paso-1`);
        revalidatePath(`/publicar/crear/${inmuebleId}/paso-2`);
        revalidatePath(`/mis-inmuebles/${inmuebleId}`);
        revalidatePath(`/mis-inmuebles/${inmuebleId}/edit`);

        return { success: true };
    } catch (error: any) {
        console.error('[RevisionActions] Error marking as corrected:', error);
        return { success: false, error: error.message || 'Error updating revision' };
    }
}
