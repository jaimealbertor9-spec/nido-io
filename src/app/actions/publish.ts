'use server';

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Creates a property draft in the database
 * @param type - The type of property (apartamento, casa, habitacion, local, lote)
 * @param userId - The authenticated user's ID
 * @returns The new property draft ID
 */
export async function createPropertyDraft(type: string, userId: string): Promise<string> {
    // Validate inputs
    if (!userId) {
        throw new Error('User not authenticated');
    }

    if (!type) {
        throw new Error('Property type is required');
    }

    // Valid property types - must match PROPERTY_TYPES in /publicar/tipo/page.tsx
    const validTypes = [
        'apartamento',
        'casa',
        'habitacion',
        'local',
        'lote',
        'oficina',
        'apartaestudio',
        'bodega',
        'edificio',
        'casa_lote'
    ];
    if (!validTypes.includes(type)) {
        throw new Error(`Invalid property type: ${type}`);
    }

    // Create Supabase client for server
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ═══════════════════════════════════════════════════════════════
    // DEFENSIVE UPSERT: Ensure public.usuarios exists before FK insert
    // This prevents race conditions with the auth.users -> usuarios trigger
    // ═══════════════════════════════════════════════════════════════

    // First, get user details from auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);

    if (authError || !authUser?.user) {
        console.error('Error fetching auth user:', authError);
        throw new Error('Usuario no encontrado');
    }

    const user = authUser.user;

    // Upsert into public.usuarios to ensure FK constraint is satisfied
    // NOTE: We OMIT 'rol' from this upsert intentionally:
    //   - For NEW users: The DB DEFAULT 'propietario' will be set
    //   - For EXISTING users: Their current 'rol' is preserved (not overwritten)
    // This prevents accidentally resetting a user's role during property creation.
    const { error: userError } = await supabase.from('usuarios').upsert({
        id: user.id,
        email: user.email,
        nombre: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
        // Map Google/OAuth avatar_url from user_metadata to our standardized column
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
    }, {
        onConflict: 'id',
        ignoreDuplicates: false  // We want to update email/nombre/avatar if user exists
    });

    if (userError) {
        // NON-BLOCKING: Log warning but continue - trigger may handle it, or FK might already exist
        console.warn('⚠️ User sync warning (continuing anyway):', userError.message);
    } else {
        console.log('✅ User synced to public.usuarios:', user.id);
    }

    // ═══════════════════════════════════════════════════════════════

    // Check if user already has a draft for this type (avoid duplicates)
    const { data: existingDraft } = await supabase
        .from('inmuebles')
        .select('id')
        .eq('propietario_id', userId)
        .eq('tipo_inmueble', type)
        .eq('estado', 'borrador')
        .maybeSingle();

    // If a draft already exists, return its ID
    if (existingDraft?.id) {
        console.log('📝 Found existing draft:', existingDraft.id);
        return existingDraft.id;
    }

    // Create new draft
    const { data, error } = await supabase
        .from('inmuebles')
        .insert({
            propietario_id: userId,
            tipo_inmueble: type,
            estado: 'borrador',
            titulo: `Nuevo ${type}`, // Placeholder title
            precio: 0, // Placeholder price
            tipo_negocio: 'arriendo', // Default, will be updated in wizard
        })
        .select('id')
        .single();

    if (error) {
        console.error('Error creating property draft:', error);
        // Check if it's an FK constraint error (user not in usuarios table yet)
        if (error.message?.includes('foreign key') || error.code === '23503') {
            throw new Error('Tu perfil aún se está sincronizando. Por favor recarga la página e intenta de nuevo.');
        }
        throw new Error(`Error al crear el borrador: ${error.message}`);
    }

    if (!data?.id) {
        throw new Error('Failed to create property draft: No ID returned');
    }

    console.log('✅ Created new draft:', data.id);
    return data.id;
}

/**
 * Deletes a property draft from the database
 * Used for error recovery when a draft becomes corrupted or unloadable
 * 
 * @param propertyId - The ID of the property draft to delete
 * @param userId - The authenticated user's ID (for ownership verification)
 * @returns Success status and optional error message
 */
export async function deletePropertyDraft(
    propertyId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    // Validate inputs
    if (!propertyId) {
        return { success: false, error: 'Property ID is required' };
    }

    if (!userId) {
        return { success: false, error: 'User not authenticated' };
    }

    try {
        // Create Supabase client for server
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // First verify ownership - only allow deleting own drafts
        const { data: property, error: fetchError } = await supabase
            .from('inmuebles')
            .select('id, propietario_id, estado')
            .eq('id', propertyId)
            .single();

        if (fetchError || !property) {
            console.error('[deletePropertyDraft] Property not found:', fetchError);
            return { success: false, error: 'Inmueble no encontrado' };
        }

        // Ownership check
        if (property.propietario_id !== userId) {
            console.error('[deletePropertyDraft] Ownership mismatch');
            return { success: false, error: 'No tienes permiso para eliminar este inmueble' };
        }

        // Only allow deleting drafts (not published or in_review properties)
        if (property.estado !== 'borrador') {
            console.error('[deletePropertyDraft] Cannot delete non-draft:', property.estado);
            return { success: false, error: 'Solo puedes eliminar borradores. Este inmueble ya está en proceso.' };
        }

        // Delete associated images from storage first
        const { data: images } = await supabase
            .from('inmueble_imagenes')
            .select('url')
            .eq('inmueble_id', propertyId);

        if (images && images.length > 0) {
            // Extract file paths from URLs and delete from storage
            for (const image of images) {
                try {
                    const url = new URL(image.url);
                    const pathMatch = url.pathname.match(/inmueble-images\/(.+)/);
                    if (pathMatch) {
                        await supabase.storage.from('inmueble-images').remove([pathMatch[1]]);
                    }
                } catch (e) {
                    console.warn('[deletePropertyDraft] Error deleting image:', e);
                    // Continue even if image deletion fails
                }
            }
        }

        // Delete image records from database
        await supabase
            .from('inmueble_imagenes')
            .delete()
            .eq('inmueble_id', propertyId);

        // Delete the property draft
        const { error: deleteError } = await supabase
            .from('inmuebles')
            .delete()
            .eq('id', propertyId);

        if (deleteError) {
            console.error('[deletePropertyDraft] Delete error:', deleteError);
            return { success: false, error: `Error al eliminar: ${deleteError.message}` };
        }

        console.log('✅ [deletePropertyDraft] Draft deleted successfully:', propertyId);
        return { success: true };

    } catch (err: any) {
        console.error('[deletePropertyDraft] Unexpected error:', err);
        return { success: false, error: err.message || 'Error inesperado' };
    }
}
