import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 1. Extracción segura de variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 2. Validación en Build Time (Solo advertencia para no romper el build)
if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️ Build Warning: Supabase Keys missing. Client will use placeholders.');
    }
}

// 3. Cliente Singleton (Evita múltiples instancias)
const finalUrl = supabaseUrl || 'https://placeholder.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder-key';

export const supabase: SupabaseClient = createClient(finalUrl, finalKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

// ==========================================
// TIPOS REALES (Basados en tu DB Schema)
// ==========================================

export type TipoNegocio = 'venta' | 'arriendo' | 'dias' | string;

export interface Inmueble {
    // Identificadores y Auditoría
    id: string; // uuid
    created_at: string; // timestamp
    updated_at: string; // timestamp
    propietario_id: string; // uuid

    // Información Principal
    titulo: string;
    descripcion: string | null;
    precio: number; // numeric
    tipo_negocio: TipoNegocio;
    tipo_inmueble: string;
    estado: string | null; // character varying

    // Ubicación
    ciudad: string | null;
    barrio: string | null;
    direccion: string | null;
    punto_referencia: string | null;
    latitud: number | null; // double precision
    longitud: number | null; // double precision

    // Detalles Físicos
    area_m2: number | null; // integer
    habitaciones: number | null; // smallint
    banos: number | null; // smallint
    estrato: number | null; // smallint

    // Contacto y Gestión
    telefono_llamadas: string | null;
    whatsapp: string | null;
    pago_id: string | null; // uuid
    fecha_publicacion: string | null;
    fecha_expiracion: string | null;

    // Arrays y Listas (Postgres ARRAY)
    keywords: string[] | null;
    servicios: string[] | null;
    amenities: string[] | null;

    // Index signature para flexibilidad adicional si es necesario
    [key: string]: any;
}

// Interfaz para el formulario de publicación (Frontend)
export interface InmuebleFormData {
    titulo: string;
    tipo_negocio: TipoNegocio;
    tipo_inmueble: string;
    precio: number;
    area_m2: number;
    habitaciones: number;
    banos: number;
    estrato: number;
    direccion: string;
    barrio: string;
    ciudad: string;
    descripcion: string;
    imagenes: string[];
    amenities: string[];
    telefono_llamadas: string;
    whatsapp: string;
}

// Utilidad de formateo de moneda (COP)
export const formatCOP = (amount: number): string => {
    try {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    } catch (error) {
        return `$ ${amount}`;
    }
};