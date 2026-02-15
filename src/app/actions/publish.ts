'use server';

import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function createPropertyDraft(type: string): Promise<string> {
    console.log(`🚀 [createPropertyDraft] ALWAYS NEW DRAFT — Type: ${type}`);

    const supabaseAuth = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
        console.error('❌ Unauthorized:', authError?.message);
        throw new Error('Unauthorized');
    }

    const userId = user.id;

    if (!type) throw new Error('Property type is required');

    const validTypes = [
        'apartamento', 'casa', 'habitacion', 'local', 'lote',
        'oficina', 'apartaestudio', 'bodega', 'edificio', 'casa_lote'
    ];
    if (!validTypes.includes(type)) throw new Error(`Invalid type: ${type}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // ALWAYS INSERT — No search, no reuse, no loop
        const { data: newDraft, error: insertError } = await supabase
            .from('inmuebles')
            .insert({
                propietario_id: userId,
                tipo_inmueble: type,
                estado: 'borrador',
                titulo: `Nuevo ${type} (Borrador)`,
                precio: 0,
                tipo_negocio: 'venta',
            })
            .select('id')
            .single();

        if (insertError) throw new Error(`DB Insert Failed: ${insertError.message}`);
        if (!newDraft) throw new Error('Draft created but no ID returned');

        console.log(`✅ NEW draft: ${newDraft.id}`);
        return newDraft.id;

    } catch (err: any) {
        console.error('💥 Critical Failure:', err);
        throw new Error(err.message || 'Server Action Failed');
    }
}

export async function deletePropertyDraft(
    propertyId: string
): Promise<{ success: boolean; error?: string }> {
    if (!propertyId) return { success: false, error: 'Property ID is required' };

    const supabaseAuth = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) return { success: false, error: 'User not authenticated' };

    const userId = user.id;

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: property, error: fetchError } = await supabase
            .from('inmuebles')
            .select('id, propietario_id, estado')
            .eq('id', propertyId)
            .single();

        if (fetchError || !property) return { success: false, error: 'Inmueble no encontrado' };
        if (property.propietario_id !== userId) return { success: false, error: 'No tienes permiso' };
        if (property.estado !== 'borrador') return { success: false, error: 'Solo puedes eliminar borradores' };

        const { data: images } = await supabase
            .from('inmueble_imagenes')
            .select('url')
            .eq('inmueble_id', propertyId);

        if (images && images.length > 0) {
            for (const image of images) {
                try {
                    const url = new URL(image.url);
                    const pathMatch = url.pathname.match(/inmueble-images\/(.+)/);
                    if (pathMatch) {
                        await supabase.storage.from('inmueble-images').remove([pathMatch[1]]);
                    }
                } catch (e) { /* continue */ }
            }
        }

        await supabase.from('inmueble_imagenes').delete().eq('inmueble_id', propertyId);

        const { error: deleteError } = await supabase
            .from('inmuebles')
            .delete()
            .eq('id', propertyId);

        if (deleteError) return { success: false, error: `Error: ${deleteError.message}` };

        console.log('✅ Draft deleted:', propertyId);
        return { success: true };

    } catch (err: any) {
        return { success: false, error: err.message || 'Error inesperado' };
    }
}