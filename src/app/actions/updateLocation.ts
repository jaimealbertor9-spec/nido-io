'use server';

import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import type { UpdateLocationResult } from './action-types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type { UpdateLocationResult } from './action-types';

export async function updatePropertyLocation(
    propertyId: string,
    address: string,
    neighborhood: string,
    subdivision: string | null = null,
    latitud: number | null = null,
    longitud: number | null = null,
    ciudad: string = 'Líbano',
    direccionFormateada: string | null = null
): Promise<UpdateLocationResult> {
    const supabaseAuth = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
        console.error('❌ [updateLocation] Unauthorized');
        return { success: false, error: 'Unauthorized' };
    }

    if (!propertyId) {
        return { success: false, error: 'Property ID is required' };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: property, error: ownerError } = await supabase
            .from('inmuebles')
            .select('id')
            .eq('id', propertyId)
            .eq('propietario_id', user.id)
            .single();

        if (ownerError || !property) {
            return { success: false, error: 'Unauthorized: You do not own this property' };
        }

        const updatePayload: Record<string, any> = {
            direccion: address?.trim() || null,
            barrio: neighborhood?.trim() || null,
            latitud,
            longitud,
            ciudad: ciudad?.trim() || 'Líbano',
            updated_at: new Date().toISOString(),
        };

        if (subdivision !== undefined) {
            updatePayload.subdivision = subdivision?.trim() || null;
        }
        if (direccionFormateada !== undefined) {
            updatePayload.direccion_formateada = direccionFormateada?.trim() || null;
        }

        const { error } = await supabase
            .from('inmuebles')
            .update(updatePayload)
            .eq('id', propertyId);

        if (error) {
            console.error('Error updating location:', error);
            return { success: false, error: `Database error: ${error.message}` };
        }

        revalidatePath(`/publicar/crear/${propertyId}`);
        console.log('✅ Location updated:', propertyId);
        return { success: true };

    } catch (err: any) {
        console.error('Unexpected error:', err);
        return { success: false, error: err.message || 'Unexpected error' };
    }
}