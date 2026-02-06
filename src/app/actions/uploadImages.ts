'use server'

import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { PropertyImageData } from './action-types'

// Inicializamos el cliente con permisos de administrador para poder subir archivos sin bloqueos
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Re-export the type for consumers (type-only exports are allowed)
export type { PropertyImageData } from './action-types';

/**
 * Uploads a property image
 * 
 * SECURITY: Session-based auth + ownership check prevents IDOR attacks
 */
export async function uploadPropertyImage(formData: FormData) {
    const file = formData.get('file') as File
    const inmuebleId = formData.get('inmuebleId') as string
    const category = formData.get('category') as string

    if (!file || !inmuebleId) {
        return { success: false, error: 'Faltan datos requeridos' }
    }

    try {
        // ═══════════════════════════════════════════════════════════════
        // STEP A: Auth Check (Session-Based)
        // ═══════════════════════════════════════════════════════════════
        const supabaseAuth = createServerSupabaseClient();
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

        if (authError || !user) {
            console.error('❌ [uploadImage] Unauthorized - no session');
            return { success: false, error: 'Unauthorized' };
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP B: Ownership Check (IDOR Protection)
        // ═══════════════════════════════════════════════════════════════
        const { data: property, error: ownerError } = await supabase
            .from('inmuebles')
            .select('id')
            .eq('id', inmuebleId)
            .eq('propietario_id', user.id)
            .single();

        if (ownerError || !property) {
            console.error('🚫 [uploadImage] IDOR blocked - user does not own property');
            return { success: false, error: 'Unauthorized: You do not own this property' };
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP C: Execute Upload (Ownership Verified)
        // ═══════════════════════════════════════════════════════════════
        // 1. Generar nombre único: ID_INMUEBLE/CATEGORIA-FECHA.jpg
        const fileExt = file.name.split('.').pop()
        const fileName = `${inmuebleId}/${category}-${Date.now()}.${fileExt}`

        // 2. Subir al Storage (Bucket 'inmueble-images')
        const { error: uploadError } = await supabase.storage
            .from('inmueble-images')
            .upload(fileName, file, {
                contentType: file.type,
                upsert: true
            })

        if (uploadError) throw uploadError

        // 3. Obtener la URL pública para mostrarla
        const { data: { publicUrl } } = supabase.storage
            .from('inmueble-images')
            .getPublicUrl(fileName)

        // 4. Guardar la referencia en la base de datos
        const { data: dbData, error: dbError } = await supabase
            .from('inmueble_imagenes')
            .insert({
                inmueble_id: inmuebleId,
                url: publicUrl,
                category: category  // DB column is 'category'
            })
            .select('id')
            .single()

        if (dbError) throw dbError

        return { success: true, url: publicUrl, imageId: dbData.id }

    } catch (error: any) {
        console.error('Error subiendo imagen:', error)
        return { success: false, error: error.message || 'Error al subir la imagen' }
    }
}

/**
 * Gets all images for a property
 */
export async function getPropertyImages(propertyId: string): Promise<PropertyImageData[]> {
    if (!propertyId?.trim()) {
        return [];
    }

    try {
        // DB column is 'category'
        const { data, error } = await supabase
            .from('inmueble_imagenes')
            .select('id, url, category, orden')
            .eq('inmueble_id', propertyId)
            .order('orden', { ascending: true });

        if (error) {
            console.error('[GetImages] Database error:', error);
            return [];
        }

        // Return with category field
        return (data || []).map(img => ({
            id: img.id,
            url: img.url,
            category: img.category,
            orden: img.orden ?? 0
        }));

    } catch (err) {
        console.error('[GetImages] Unexpected error:', err);
        return [];
    }
}

/**
 * Deletes a property image from storage and database
 */
export async function deletePropertyImage(imageId: string): Promise<{ success: boolean; error?: string }> {
    if (!imageId?.trim()) {
        return { success: false, error: 'ID de imagen es requerido' };
    }

    try {
        // Get the image URL first to extract storage path
        const { data: imageData, error: fetchError } = await supabase
            .from('inmueble_imagenes')
            .select('url')
            .eq('id', imageId)
            .single();

        if (fetchError) {
            console.error('[Delete] Fetch error:', fetchError);
            return { success: false, error: 'Imagen no encontrada' };
        }

        // Delete from database
        const { error: deleteError } = await supabase
            .from('inmueble_imagenes')
            .delete()
            .eq('id', imageId);

        if (deleteError) {
            console.error('[Delete] Database error:', deleteError);
            return { success: false, error: deleteError.message };
        }

        // Try to delete from storage (extract path from URL)
        try {
            const url = new URL(imageData.url);
            const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/inmueble-images\/(.+)/);
            if (pathMatch) {
                const storagePath = decodeURIComponent(pathMatch[1]);
                await supabase.storage.from('inmueble-images').remove([storagePath]);
            }
        } catch (storageErr) {
            // Log but don't fail - the DB record is already deleted
            console.warn('[Delete] Could not delete from storage:', storageErr);
        }

        return { success: true };

    } catch (err: any) {
        console.error('[Delete] Unexpected error:', err);
        return { success: false, error: err.message };
    }
}