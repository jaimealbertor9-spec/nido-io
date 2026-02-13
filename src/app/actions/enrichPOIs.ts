'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Google Places types to search for POIs within 200m radius.
 * Using the Places API (New) "Nearby Search" endpoint.
 * 
 * Docs: https://developers.google.com/maps/documentation/places/web-service/nearby-search
 */
const INCLUDED_TYPES = [
    'park',
    'school',
    'hospital',
    'gym',
    'bus_station',
    'transit_station',
    'pharmacy',
    'supermarket',
    'university',
];

interface POIResult {
    nombre: string;
    tipo: string;
    distancia_m: number;
    lat: number;
    lng: number;
}

/**
 * Enriches a property with nearby Points of Interest using Google Places API.
 * Called asynchronously (fire-and-forget) after saving Step 1 location.
 * 
 * SECURITY: Uses server-side env var `GOOGLE_PLACES_API_KEY` 
 * (falls back to `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` if the dedicated key isn't set).
 * 
 * @param propertyId - The property to enrich
 * @param lat - Latitude of the property
 * @param lng - Longitude of the property
 */
export async function enrichPropertyPOIs(
    propertyId: string,
    lat: number,
    lng: number
): Promise<{ success: boolean; count?: number; error?: string }> {
    console.log(`[enrichPOIs] Starting Google Places enrichment for property ${propertyId} at (${lat}, ${lng})`);

    // Server-side API key (prefer dedicated server key, fallback to public key)
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        console.error('[enrichPOIs] No Google API key available');
        return { success: false, error: 'Missing Google API key (GOOGLE_PLACES_API_KEY)' };
    }

    try {
        const allPois: POIResult[] = [];

        // Google Places Nearby Search (legacy endpoint — universally supported)
        // We batch requests by type groups to stay within API limits
        const typeGroups = [
            ['park', 'school', 'university'],
            ['hospital', 'pharmacy'],
            ['gym'],
            ['bus_station', 'transit_station'],
            ['supermarket'],
        ];

        for (const types of typeGroups) {
            for (const type of types) {
                try {
                    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
                    url.searchParams.set('location', `${lat},${lng}`);
                    url.searchParams.set('radius', '200');
                    url.searchParams.set('type', type);
                    url.searchParams.set('key', apiKey);
                    url.searchParams.set('language', 'es');

                    const response = await fetch(url.toString(), {
                        signal: AbortSignal.timeout(10000), // 10s timeout per request
                    });

                    if (!response.ok) {
                        console.warn(`[enrichPOIs] Google API returned ${response.status} for type "${type}"`);
                        continue;
                    }

                    const data = await response.json();

                    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                        console.warn(`[enrichPOIs] Google Places status: ${data.status} for type "${type}"`);
                        continue;
                    }

                    const results = data.results || [];
                    console.log(`[enrichPOIs] Found ${results.length} results for type "${type}"`);

                    for (const place of results) {
                        const placeLat = place.geometry?.location?.lat;
                        const placeLng = place.geometry?.location?.lng;

                        if (!placeLat || !placeLng) continue;

                        const distancia_m = Math.round(haversineDistance(lat, lng, placeLat, placeLng));

                        // Only include POIs actually within 200m (Google can return slightly outside)
                        if (distancia_m > 250) continue;

                        allPois.push({
                            nombre: place.name || 'Sin nombre',
                            tipo: mapPoiType(type),
                            distancia_m,
                            lat: placeLat,
                            lng: placeLng,
                        });
                    }
                } catch (fetchErr: any) {
                    console.warn(`[enrichPOIs] Fetch error for type "${type}":`, fetchErr.message);
                    continue;
                }
            }
        }

        // Deduplicate by name+type
        const seenKeys = new Set<string>();
        const uniquePois = allPois.filter(poi => {
            const key = `${poi.nombre}-${poi.tipo}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
        });

        // Sort by distance and limit to top 20
        uniquePois.sort((a, b) => a.distancia_m - b.distancia_m);
        const topPois = uniquePois.slice(0, 20);

        console.log(`[enrichPOIs] Saving ${topPois.length} POIs for property ${propertyId}`);

        // Save to database
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { error } = await supabase
            .from('inmuebles')
            .update({
                caracteristicas_externas: topPois,
                updated_at: new Date().toISOString(),
            })
            .eq('id', propertyId);

        if (error) {
            console.error('[enrichPOIs] DB save error:', error);
            return { success: false, error: error.message };
        }

        console.log(`✅ [enrichPOIs] Successfully enriched property ${propertyId} with ${topPois.length} Google Places POIs`);
        return { success: true, count: topPois.length };

    } catch (err: any) {
        console.error('[enrichPOIs] Unexpected error:', err);
        return { success: false, error: err.message || 'POI enrichment failed' };
    }
}

/**
 * Haversine formula to calculate distance between two lat/lng pairs in meters
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

/**
 * Maps Google Places types to user-friendly Spanish POI categories
 */
function mapPoiType(raw: string): string {
    const typeMap: Record<string, string> = {
        'school': 'colegio',
        'university': 'universidad',
        'hospital': 'hospital',
        'pharmacy': 'farmacia',
        'park': 'parque',
        'gym': 'gimnasio',
        'bus_station': 'estación_bus',
        'transit_station': 'estación_transporte',
        'supermarket': 'supermercado',
    };
    return typeMap[raw] || raw;
}
