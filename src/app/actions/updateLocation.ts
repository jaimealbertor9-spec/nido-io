'use server';

import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import type { UpdateLocationResult } from './action-types';

// Initialize Supabase with service role for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Re-export the type for consumers
export type { UpdateLocationResult } from './action-types';

/**
 * Updates the location details of a property draft
 * 
 * SECURITY: Session-based auth + ownership check prevents IDOR attacks
 * 
 * @param propertyId - The property ID to update
 * @param address - The exact address
 * @param neighborhood - The neighborhood (barrio)
 * @param puntoReferencia - Reference point for AI semantic search (e.g., "Cerca al Hospital")
 * @param latitud - GPS latitude from map pin
 * @param longitud - GPS longitude from map pin
 * @param ciudad - City detected from reverse geocoding (defaults to 'Líbano')
 * @returns Success status and optional error message
 */
export async function updatePropertyLocation(
    propertyId: string,
    address: string,
    neighborhood: string,
    puntoReferencia: string = '',
    latitud: number | null = null,
    longitud: number | null = null,
    ciudad: string = 'Líbano'
): Promise<UpdateLocationResult> {
    // ═══════════════════════════════════════════════════════════════
    // STEP A: Auth Check (Session-Based)
    // ═══════════════════════════════════════════════════════════════
    const supabaseAuth = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
        console.error('❌ [updateLocation] Unauthorized - no session');
        return { success: false, error: 'Unauthorized' };
    }

    // Validate inputs
    if (!propertyId) {
        return { success: false, error: 'Property ID is required' };
    }

    if (!address?.trim()) {
        return { success: false, error: 'Address is required' };
    }

    if (!neighborhood?.trim()) {
        return { success: false, error: 'Neighborhood is required' };
    }

    try {
        // Create Supabase client for server
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // ═══════════════════════════════════════════════════════════════
        // STEP B: Ownership Check (IDOR Protection)
        // ═══════════════════════════════════════════════════════════════
        const { data: property, error: ownerError } = await supabase
            .from('inmuebles')
            .select('id')
            .eq('id', propertyId)
            .eq('propietario_id', user.id)
            .single();

        if (ownerError || !property) {
            console.error('🚫 [updateLocation] IDOR blocked - user does not own property');
            return { success: false, error: 'Unauthorized: You do not own this property' };
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP C: Execute Update (Ownership Verified)
        // ═══════════════════════════════════════════════════════════════
        const { error } = await supabase
            .from('inmuebles')
            .update({
                direccion: address.trim(),
                barrio: neighborhood.trim(),
                punto_referencia: puntoReferencia.trim() || null,
                latitud: latitud,
                longitud: longitud,
                ciudad: ciudad.trim() || 'Líbano', // From geocoding or default
                updated_at: new Date().toISOString(),
            })
            .eq('id', propertyId);

        if (error) {
            console.error('Error updating property location:', error);
            return { success: false, error: `Database error: ${error.message}` };
        }

        // Revalidate the wizard pages to reflect new data
        revalidatePath(`/publicar/crear/${propertyId}`);

        console.log('✅ Location updated for property:', propertyId, { latitud, longitud, ciudad });
        return { success: true };

    } catch (err: any) {
        console.error('Unexpected error updating location:', err);
        return { success: false, error: err.message || 'Unexpected error occurred' };
    }
}

