'use server';

import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// ═══════════════════════════════════════════════════════════════
// SMART RADIUS — City Classification
// ═══════════════════════════════════════════════════════════════
const CAPITAL_CITIES = [
    'bogotá', 'medellín', 'cali', 'barranquilla', 'bucaramanga',
    'pereira', 'manizales', 'armenia', 'ibagué', 'santa marta',
    'cartagena', 'villavicencio', 'tunja',
];

const CAPITAL_RADIUS = 400;   // dense urban — 400m
const DEFAULT_RADIUS = 250;   // smaller municipalities — 250m
const FALLBACK_RADIUS = 450;  // retry if results < 3
const MIN_POI_THRESHOLD = 3;  // minimum POIs before triggering fallback

function getSmartRadius(city: string): number {
    const normalized = city
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const isCapital = CAPITAL_CITIES.some(c => {
        const norm = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return normalized.includes(norm) || norm.includes(normalized);
    });

    const radius = isCapital ? CAPITAL_RADIUS : DEFAULT_RADIUS;
    console.log(`[enrichPOIs] City: "${city}" → Normalized: "${normalized}" → Capital: ${isCapital} → Radius: ${radius}m`);
    return radius;
}

// ═══════════════════════════════════════════════════════════════
// 8 POI categories for the AI Resident Brain
// ═══════════════════════════════════════════════════════════════
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
    type: string,
    radius: number
): Promise<POIResult[]> {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${GOOGLE_API_KEY}`;

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
 * Runs all 8 POI category searches at the given radius.
 */
async function runAllSearches(
    lat: number,
    lng: number,
    radius: number
): Promise<Record<string, POIResult[]>> {
    const enrichmentResult: Record<string, POIResult[]> = {};

    const searches = POI_CATEGORIES.map(async (category) => {
        const allResults: POIResult[] = [];

        for (const type of category.types) {
            const results = await searchNearby(lat, lng, type, radius);
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
    return enrichmentResult;
}

function countTotalPOIs(result: Record<string, POIResult[]>): number {
    return Object.values(result).reduce((sum, arr) => sum + arr.length, 0);
}

/**
 * Enriches a property with nearby Points of Interest (POIs).
 * Searches 8 categories using Google Places Nearby Search.
 *
 * Smart Radius:
 *   - Capital Cities (13): 400m
 *   - Other Municipalities: 250m
 *   - Fallback: if < 3 POIs, retry at 450m
 *
 * Stores results in inmuebles.caracteristicas_externas as JSONB.
 */
export async function enrichPOIs(
    propertyId: string,
    lat: number,
    lng: number,
    city?: string
): Promise<{ success: boolean; data?: Record<string, POIResult[]>; error?: string }> {
    console.log(`🧠 [enrichPOIs] Starting for property ${propertyId} at (${lat}, ${lng}), city="${city || 'unknown'}"`);

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
        // ── SMART RADIUS: determine initial search radius ──
        const initialRadius = getSmartRadius(city || '');
        console.log(`[enrichPOIs] Using radius: ${initialRadius}m`);

        let enrichmentResult = await runAllSearches(lat, lng, initialRadius);
        let totalPOIs = countTotalPOIs(enrichmentResult);

        console.log(`[enrichPOIs] First pass: ${totalPOIs} POIs found at ${initialRadius}m`);

        // ── FALLBACK: retry at 450m if too few results ──
        if (totalPOIs < MIN_POI_THRESHOLD && initialRadius < FALLBACK_RADIUS) {
            console.log(`[enrichPOIs] Only ${totalPOIs} POIs — retrying at ${FALLBACK_RADIUS}m`);
            enrichmentResult = await runAllSearches(lat, lng, FALLBACK_RADIUS);
            totalPOIs = countTotalPOIs(enrichmentResult);
            console.log(`[enrichPOIs] Fallback pass: ${totalPOIs} POIs found at ${FALLBACK_RADIUS}m`);
        }

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

        console.log(`✅ [enrichPOIs] Saved ${totalPOIs} POIs across 8 categories for property ${propertyId} (radius: ${totalPOIs < MIN_POI_THRESHOLD ? FALLBACK_RADIUS : initialRadius}m)`);

        return { success: true, data: enrichmentResult };

    } catch (err: any) {
        console.error('[enrichPOIs] Unexpected error:', err);
        return { success: false, error: err.message || 'Enrichment failed' };
    }
}
