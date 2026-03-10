'use server';

import { getServiceRoleClient } from '@/lib/supabase-admin';

// ⚠️ ARCHITECTURAL MANDATE: Any public property listing page (e.g., /buscar)
// MUST use this action to ensure expired properties are filtered out. 
// Do NOT query the 'inmuebles' table directly for public feeds.

/**
 * getPublicListings — Server Action for public-facing property feed.
 * 
 * CRITICAL: This is the ONLY function that should power public property queries.
 * It enforces the expiration filter: only properties with
 * fecha_expiracion > now() OR fecha_expiracion IS NULL are returned.
 * 
 * This ensures expired properties NEVER appear in the public feed.
 */
export async function getPublicListings(options?: {
    limit?: number;
    offset?: number;
    tipoNegocio?: string;
    ciudad?: string;
}) {
    const supabase = getServiceRoleClient();
    const { limit = 20, offset = 0, tipoNegocio, ciudad } = options || {};

    let query = supabase
        .from('inmuebles')
        .select('*, inmueble_imagenes(*)', { count: 'exact' })
        .eq('estado', 'publicado')
        .or('fecha_expiracion.gt.now(),fecha_expiracion.is.null')  // ← EXPIRATION FILTER
        .order('fecha_publicacion', { ascending: false })
        .range(offset, offset + limit - 1);

    if (tipoNegocio) {
        query = query.eq('tipo_negocio', tipoNegocio);
    }

    if (ciudad) {
        query = query.ilike('ciudad', `%${ciudad}%`);
    }

    const { data, count, error } = await query;

    if (error) {
        console.error('❌ [PublicFeed] Error fetching listings:', error.message);
        return { success: false, data: [], count: 0, error: error.message };
    }

    return { success: true, data: data || [], count: count || 0 };
}

/**
 * getPublicProperty — Fetch a single property for public detail view.
 * Also enforces expiration check.
 */
export async function getPublicProperty(propertyId: string) {
    const supabase = getServiceRoleClient();

    const { data, error } = await supabase
        .from('inmuebles')
        .select('*, inmueble_imagenes(*)')
        .eq('id', propertyId)
        .eq('estado', 'publicado')
        .or('fecha_expiracion.gt.now(),fecha_expiracion.is.null')  // ← EXPIRATION FILTER
        .single();

    if (error) {
        console.error('❌ [PublicFeed] Property not found or expired:', propertyId);
        return { success: false, data: null };
    }

    return { success: true, data };
}
