// ═══════════════════════════════════════════════════════════════
// BUSCAR MODULE — Mock Data & Conversation Handler
// Phase A only: simulates AI responses with realistic property data.
// Phase B replaces this entire file with /api/search calls.
// ═══════════════════════════════════════════════════════════════

import { SearchResult, SearchIntent, ChatMessage, POIFilter } from './types';
import { v4 as uuidv4 } from 'uuid';

// ── 8 Fictional Properties ──────────────────────────────────────

const MOCK_PROPERTIES: SearchResult[] = [
    {
        id: '1a2b3c4d-0001-4000-a000-000000000001',
        titulo: 'Apartamento luminoso en Chapinero Alto',
        precio: 1800000,
        ciudad: 'Bogotá',
        barrio: 'Chapinero Alto',
        habitaciones: 2,
        banos: 2,
        area_m2: 65,
        tipo_inmueble: 'apartamento',
        tipo_negocio: 'arriendo',
        latitud: 4.6486,
        longitud: -74.0628,
        amenities: ['Parqueadero', 'Gimnasio', 'Vigilancia'],
        closest_poi_name: 'Parque de los Hippies',
        closest_poi_distance_m: 120,
    },
    {
        id: '1a2b3c4d-0002-4000-a000-000000000002',
        titulo: 'Casa familiar con patio en Suba',
        precio: 2500000,
        ciudad: 'Bogotá',
        barrio: 'Suba',
        habitaciones: 4,
        banos: 3,
        area_m2: 120,
        tipo_inmueble: 'casa',
        tipo_negocio: 'arriendo',
        latitud: 4.7400,
        longitud: -74.0836,
        amenities: ['Patio', 'Parqueadero', 'Zona BBQ'],
        closest_poi_name: 'Parque Mirador de los Nevados',
        closest_poi_distance_m: 250,
    },
    {
        id: '1a2b3c4d-0003-4000-a000-000000000003',
        titulo: 'Estudio moderno cerca a la 85',
        precio: 1200000,
        ciudad: 'Bogotá',
        barrio: 'El Chicó',
        habitaciones: 1,
        banos: 1,
        area_m2: 38,
        tipo_inmueble: 'apartamento',
        tipo_negocio: 'arriendo',
        latitud: 4.6733,
        longitud: -74.0527,
        amenities: ['Gimnasio', 'Ascensor', 'Vigilancia'],
        closest_poi_name: 'Parque de la 93',
        closest_poi_distance_m: 180,
    },
    {
        id: '1a2b3c4d-0004-4000-a000-000000000004',
        titulo: 'Apartamento con vista al parque Simón Bolívar',
        precio: 1500000,
        ciudad: 'Bogotá',
        barrio: 'Salitre',
        habitaciones: 3,
        banos: 2,
        area_m2: 78,
        tipo_inmueble: 'apartamento',
        tipo_negocio: 'arriendo',
        latitud: 4.6580,
        longitud: -74.0935,
        amenities: ['Balcón', 'Parqueadero', 'Salón Comunal'],
        closest_poi_name: 'Parque Simón Bolívar',
        closest_poi_distance_m: 45,
    },
    {
        id: '1a2b3c4d-0005-4000-a000-000000000005',
        titulo: 'Apartamento ejecutivo en Usaquén',
        precio: 3200000,
        ciudad: 'Bogotá',
        barrio: 'Usaquén',
        habitaciones: 2,
        banos: 2,
        area_m2: 85,
        tipo_inmueble: 'apartamento',
        tipo_negocio: 'arriendo',
        latitud: 4.6957,
        longitud: -74.0326,
        amenities: ['Terraza', 'Gimnasio', 'Cocina Integral', 'Vigilancia'],
        closest_poi_name: 'Hacienda Santa Bárbara',
        closest_poi_distance_m: 300,
    },
    {
        id: '1a2b3c4d-0006-4000-a000-000000000006',
        titulo: 'Casa con jardín en El Líbano centro',
        precio: 800000,
        ciudad: 'El Líbano',
        barrio: 'El Centro',
        habitaciones: 3,
        banos: 2,
        area_m2: 95,
        tipo_inmueble: 'casa',
        tipo_negocio: 'arriendo',
        latitud: 4.9213,
        longitud: -75.0665,
        amenities: ['Patio', 'Garaje'],
        closest_poi_name: 'Parque Principal',
        closest_poi_distance_m: 80,
    },
    {
        id: '1a2b3c4d-0007-4000-a000-000000000007',
        titulo: 'Finca turística con piscina',
        precio: 350000,
        ciudad: 'El Líbano',
        barrio: 'Convenio',
        habitaciones: 5,
        banos: 3,
        area_m2: 200,
        tipo_inmueble: 'finca',
        tipo_negocio: 'dias',
        latitud: 4.9350,
        longitud: -75.0850,
        amenities: ['Piscina', 'Zona BBQ', 'Parqueadero'],
    },
    {
        id: '1a2b3c4d-0008-4000-a000-000000000008',
        titulo: 'Local comercial en zona céntrica',
        precio: 1100000,
        ciudad: 'Bogotá',
        barrio: 'Teusaquillo',
        habitaciones: 0,
        banos: 1,
        area_m2: 45,
        tipo_inmueble: 'local',
        tipo_negocio: 'arriendo',
        latitud: 4.6352,
        longitud: -74.0723,
        amenities: ['Vigilancia'],
    },
];

// ── Keyword Detection ───────────────────────────────────────────

const KEYWORD_MAP: { pattern: RegExp; intent: Partial<SearchIntent> }[] = [
    { pattern: /apartamento|apto/i, intent: { tipo_inmueble: 'apartamento' } },
    { pattern: /casa/i, intent: { tipo_inmueble: 'casa' } },
    { pattern: /finca/i, intent: { tipo_inmueble: 'finca' } },
    { pattern: /local/i, intent: { tipo_inmueble: 'local' } },
    { pattern: /arriendo|arrendar|alquiler/i, intent: { tipo_negocio: 'arriendo' } },
    { pattern: /venta|comprar/i, intent: { tipo_negocio: 'venta' } },
    { pattern: /días|dia|temporal/i, intent: { tipo_negocio: 'dias' } },
    { pattern: /bogot[aá]/i, intent: { ciudad: 'Bogotá' } },
    { pattern: /l[ií]bano/i, intent: { ciudad: 'El Líbano' } },
    { pattern: /chapinero/i, intent: { barrio: 'Chapinero' } },
    { pattern: /suba/i, intent: { barrio: 'Suba' } },
    { pattern: /usaqu[eé]n/i, intent: { barrio: 'Usaquén' } },
    { pattern: /barato|econ[oó]mico|menos de 1/i, intent: { precio_max: 1000000 } },
    { pattern: /2 millones|2M/i, intent: { precio_max: 2000000 } },
    { pattern: /3 habitaciones|3 cuartos/i, intent: { habitaciones_min: 3 } },
    { pattern: /2 habitaciones|2 cuartos/i, intent: { habitaciones_min: 2 } },
];

const POI_KEYWORD_MAP: { pattern: RegExp; filter: POIFilter }[] = [
    { pattern: /parque|park/i, filter: { category: 'parques', max_distance_m: 300 } },
    { pattern: /colegio|escuela|universidad|educaci[oó]n/i, filter: { category: 'educacion', max_distance_m: 500 } },
    { pattern: /hospital|cl[ií]nica|salud/i, filter: { category: 'salud', max_distance_m: 500 } },
    { pattern: /transporte|transmilenio|bus|estaci[oó]n/i, filter: { category: 'transporte', max_distance_m: 400 } },
    { pattern: /gimnasio|gym/i, filter: { category: 'bienestar', max_distance_m: 500 } },
    { pattern: /farmacia|droguer[ií]a/i, filter: { category: 'droguerias', max_distance_m: 300 } },
    { pattern: /supermercado|tienda/i, filter: { category: 'comercio', max_distance_m: 400 } },
    { pattern: /centro comercial|mall/i, filter: { category: 'centros_comerciales', max_distance_m: 800 } },
];

// Handle distance mentions like "a 200 metros del parque"
function extractDistanceOverride(text: string): number | null {
    const match = text.match(/(\d+)\s*(?:metros?|m)\b/i);
    return match ? parseInt(match[1], 10) : null;
}

// ── Mock Response Generator ─────────────────────────────────────

export function generateMockResponse(
    userMessage: string,
    previousIntent: SearchIntent
): { message: ChatMessage; intent: SearchIntent; results: SearchResult[] } {
    const distanceOverride = extractDistanceOverride(userMessage);

    // Detect intent from keywords
    let newIntent: SearchIntent = {};
    for (const { pattern, intent } of KEYWORD_MAP) {
        if (pattern.test(userMessage)) {
            newIntent = { ...newIntent, ...intent };
        }
    }

    // Detect POI filters
    const detectedPOIs: POIFilter[] = [];
    for (const { pattern, filter } of POI_KEYWORD_MAP) {
        if (pattern.test(userMessage)) {
            detectedPOIs.push({
                ...filter,
                max_distance_m: distanceOverride ?? filter.max_distance_m,
            });
        }
    }

    // Merge with previous intent
    const mergedIntent: SearchIntent = {
        ...previousIntent,
        ...newIntent,
        poi_filters: [
            ...(previousIntent.poi_filters || []).filter(
                pf => !detectedPOIs.some(dp => dp.category === pf.category)
            ),
            ...detectedPOIs,
        ],
    };

    // Filter mock properties
    let filtered = [...MOCK_PROPERTIES];

    if (mergedIntent.tipo_inmueble) {
        filtered = filtered.filter(p => p.tipo_inmueble === mergedIntent.tipo_inmueble);
    }
    if (mergedIntent.tipo_negocio) {
        filtered = filtered.filter(p => p.tipo_negocio === mergedIntent.tipo_negocio);
    }
    if (mergedIntent.ciudad) {
        filtered = filtered.filter(p =>
            p.ciudad.toLowerCase().includes(mergedIntent.ciudad!.toLowerCase())
        );
    }
    if (mergedIntent.barrio) {
        filtered = filtered.filter(p =>
            p.barrio.toLowerCase().includes(mergedIntent.barrio!.toLowerCase())
        );
    }
    if (mergedIntent.precio_max) {
        filtered = filtered.filter(p => p.precio <= mergedIntent.precio_max!);
    }
    if (mergedIntent.habitaciones_min) {
        filtered = filtered.filter(p => p.habitaciones >= mergedIntent.habitaciones_min!);
    }

    // If no filters matched anything, return all
    if (filtered.length === 0 && Object.keys(newIntent).length === 0 && detectedPOIs.length === 0) {
        filtered = MOCK_PROPERTIES.slice(0, 5);
    }

    // Generate response text
    const count = filtered.length;
    const tipoLabel = mergedIntent.tipo_inmueble
        ? `${mergedIntent.tipo_inmueble}${count !== 1 ? 's' : ''}`
        : 'propiedades';
    const locationLabel = mergedIntent.barrio || mergedIntent.ciudad || '';

    let responseText = `Encontré **${count} ${tipoLabel}**`;
    if (locationLabel) responseText += ` en ${locationLabel}`;
    responseText += '.';

    if (count > 0) {
        const cheapest = Math.min(...filtered.map(p => p.precio));
        const mostExpensive = Math.max(...filtered.map(p => p.precio));
        responseText += ` Los precios van desde **$${cheapest.toLocaleString('es-CO')}** hasta **$${mostExpensive.toLocaleString('es-CO')}**/mes.`;
    }

    if (mergedIntent.poi_filters && mergedIntent.poi_filters.length > 0) {
        const poiLabels = mergedIntent.poi_filters.map(pf => {
            const closest = filtered[0]?.closest_poi_name;
            return closest
                ? `cerca de ${closest}`
                : `cerca de un ${pf.category}`;
        });
        responseText += ` Filtrado por cercanía a: ${poiLabels.join(', ')}.`;
    }

    responseText += ' ¿Quieres refinar la búsqueda?';

    // Suggestions
    const suggestions: string[] = [];
    if (!mergedIntent.habitaciones_min) suggestions.push('Solo de 2 habitaciones');
    if (!mergedIntent.precio_max) suggestions.push('Menos de $1.5M');
    if (!mergedIntent.poi_filters?.length) suggestions.push('Cerca de un parque');
    if (mergedIntent.poi_filters && !mergedIntent.poi_filters.some(p => p.category === 'transporte')) {
        suggestions.push('Cerca de TransMilenio');
    }
    suggestions.push('Ordenar por precio');

    const message: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        results: filtered,
        appliedFilters: mergedIntent,
        suggestions: suggestions.slice(0, 4),
        isNew: true,
    };

    return { message, intent: mergedIntent, results: filtered };
}
