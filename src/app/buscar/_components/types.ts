// ═══════════════════════════════════════════════════════════════
// BUSCAR MODULE — Type Definitions
// Phase A: Frontend-only types. Phase B will extend these.
// ═══════════════════════════════════════════════════════════════

export type MessageRole = 'user' | 'assistant' | 'system';

export type ChatMessage = {
    id: string;
    role: MessageRole;
    content: string;
    timestamp: Date;
    results?: SearchResult[];
    appliedFilters?: SearchIntent;
    suggestions?: string[];
    isNew?: boolean; // For entrance animations
};

export type SearchResult = {
    id: string;
    titulo: string;
    precio: number;
    ciudad: string;
    barrio: string;
    habitaciones: number;
    banos: number;
    area_m2: number;
    tipo_inmueble: string;
    tipo_negocio: string;
    latitud: number;
    longitud: number;
    amenities: string[];
    closest_poi_name?: string;
    closest_poi_distance_m?: number;
    image_url?: string;
    exact_match_level?: number;
};

export type SearchIntent = {
    tipo_inmueble?: string;
    tipo_negocio?: string;
    precio_min?: number;
    precio_max?: number;
    habitaciones_min?: number;
    banos_min?: number;
    ciudad?: string;
    barrio?: string;
    amenities?: string[];
    poi_filters?: POIFilter[];
    sort_by?: string;
};

export type POIFilter = {
    category: string;
    max_distance_m: number;
};

// Maps JSONB category keys to UI display
export const POI_CATEGORY_META: Record<string, { icon: string; label: string }> = {
    parques: { icon: '🌳', label: 'Parque' },
    educacion: { icon: '🎓', label: 'Educación' },
    salud: { icon: '🏥', label: 'Hospital' },
    transporte: { icon: '🚌', label: 'Transporte' },
    bienestar: { icon: '💪', label: 'Gimnasio' },
    droguerias: { icon: '💊', label: 'Droguería' },
    comercio: { icon: '🛒', label: 'Supermercado' },
    centros_comerciales: { icon: '🏬', label: 'C. Comercial' },
};

export const FILTER_ICONS: Record<string, string> = {
    tipo_inmueble: '🏠',
    tipo_negocio: '📋',
    precio_max: '💰',
    precio_min: '💰',
    habitaciones_min: '🛏️',
    banos_min: '🚿',
    ciudad: '📍',
    barrio: '📍',
    amenities: '✨',
    sort_by: '↕️',
};
