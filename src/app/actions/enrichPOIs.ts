'use server';

import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// 8 POI categories for the AI Resident Brain
const POI_CATEGORIES: { key: string; label: string; types: string[] }[] = [
    { key: 'parques', label: 'Parques', types: ['park'] },
    { key: 'educacion', label: 'Educación', types: ['school', 'university'] },
    { key: 'salud', label: 'Salud', types: ['hospital'] },
    { key: 'transporte', label: 'Transporte', types: ['bus_station', 'transit_station'] },
    { key: 'bienestar', label: 'Bienestar', types: ['gym'] },
    { key: 'droguerias', label: 'Droguerías', types: ['pharmacy'] },
    { key: 'comercio', label: 'Comercio', types: ['supermarket'] },
    { key: 'centros_comerciales', label: 'Centros Comerciales', types: ['shopping_mall'] },
];

const SEARCH_RADIUS = 400; // meters
const MAX_RESULTS_PER_CATEGORY = 5;

interface POIResult {
    name: string;
    distance_m: number;
    rating: number | null;
    types: string[];
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

async function searchNearby(
    lat: number,
    lng: number,
    type: string
): Promise<POIResult[]> {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${SEARCH_RADIUS}&type=${type}&key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        console.warn(`[enrichPOIs] Google API error for type=${type}: ${response.status}`);
        return [];
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.warn(`[enrichPOIs] Google API status for type=${type}: ${data.status}`);
        return [];
    }

    const results: POIResult[] = (data.results || [])
        .slice(0, MAX_RESULTS_PER_CATEGORY)
        .map((place: any) => ({
            name: place.name || 'Sin nombre',
            distance_m: haversineDistance(
                lat, lng,
                place.geometry?.location?.lat || lat,
                place.geometry?.location?.lng || lng
            ),
            rating: place.rating ?? null,
            types: (place.types || []).slice(0, 5),
        }));

    // Sort by distance ascending
    results.sort((a, b) => a.distance_m - b.distance_m);
    return results;
}

/**
 * Enriches a property with nearby Points of Interest (POIs).
 * Searches 8 categories within 400m radius using Google Places Nearby Search.
 * Stores results in inmuebles.caracteristicas_externas as JSONB.
 */
export async function enrichPOIs(
    propertyId: string,
    lat: number,
    lng: number
): Promise<{ success: boolean; data?: Record<string, POIResult[]>; error?: string }> {
    console.log(`🧠 [enrichPOIs] Starting for property ${propertyId} at (${lat}, ${lng})`);

    // Auth check
    const supabaseAuth = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
        return { success: false, error: 'Unauthorized' };
    }

    if (!propertyId || !lat || !lng) {
        return { success: false, error: 'Missing propertyId, lat, or lng' };
    }

    if (!GOOGLE_API_KEY) {
        console.error('[enrichPOIs] No Google API key configured');
        return { success: false, error: 'Google API key not configured' };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Ownership check
    const { data: property, error: ownerError } = await supabase
        .from('inmuebles')
        .select('id')
        .eq('id', propertyId)
        .eq('propietario_id', user.id)
        .single();

    if (ownerError || !property) {
        return { success: false, error: 'Property not found or unauthorized' };
    }

    try {
        // Search all 8 categories in parallel
        const enrichmentResult: Record<string, POIResult[]> = {};

        const searches = POI_CATEGORIES.map(async (category) => {
            // Search each type within the category, merge + dedupe results
            const allResults: POIResult[] = [];

            for (const type of category.types) {
                const results = await searchNearby(lat, lng, type);
                allResults.push(...results);
            }

            // Dedupe by name and take top 5 closest
            const seen = new Set<string>();
            const deduped = allResults.filter(r => {
                if (seen.has(r.name)) return false;
                seen.add(r.name);
                return true;
            });

            deduped.sort((a, b) => a.distance_m - b.distance_m);
            enrichmentResult[category.key] = deduped.slice(0, MAX_RESULTS_PER_CATEGORY);
        });

        await Promise.all(searches);

        // Persist to DB
        const { error: updateError } = await supabase
            .from('inmuebles')
            .update({
                caracteristicas_externas: enrichmentResult,
                updated_at: new Date().toISOString(),
            })
            .eq('id', propertyId);

        if (updateError) {
            console.error('[enrichPOIs] DB update error:', updateError);
            return { success: false, error: `DB error: ${updateError.message}` };
        }

        // Count total POIs found
        const totalPOIs = Object.values(enrichmentResult).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`✅ [enrichPOIs] Saved ${totalPOIs} POIs across 8 categories for property ${propertyId}`);

        return { success: true, data: enrichmentResult };

    } catch (err: any) {
        console.error('[enrichPOIs] Unexpected error:', err);
        return { success: false, error: err.message || 'Enrichment failed' };
    }
}
