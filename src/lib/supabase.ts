import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Prevent build crash if vars are missing (Vercel build phase)
if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ Supabase env vars missing. This is fine during build/lint.');
    }
}

// Singleton pattern
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
    if (!supabaseInstance) {
        // Fallback seguro para build time
        const url = supabaseUrl || 'https://placeholder.supabase.co';
        const key = supabaseAnonKey || 'placeholder-key';

        supabaseInstance = createClient(url, key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            }
        });
    }
    return supabaseInstance;
}

export const supabase = getSupabaseClient();

// ==========================================
// TIPOS BLINDADOS (Aceptan Inglés y Español)
// ==========================================

export type TipoNegocio = 'venta' | 'arriendo' | 'dias' | string;
export type EstadoInmueble = 'borrador' | 'pendiente_pago' | 'en_revision' | 'publicado' | 'pausado' | 'expirado' | 'rechazado' | string;

export interface Inmueble {
    id: string;
    created_at: string;
    updated_at: string;

    // CAMPOS ESPAÑOL (Nuevos)
    titulo: string;
    precio: number;
    tipo_negocio: TipoNegocio;
    tipo_inmueble: string;
    descripcion: string | null;
    estado: EstadoInmueble;

    // CAMPOS COMPATIBILIDAD (Inglés - Evitan error de build)
    description?: string | null;
    status?: string;
    listing_type?: string;

    // Ubicación
    barrio: string | null;
    vereda: string | null;
    direccion: string | null;

    // Detalles
    habitaciones: number | null;
    banos: number | null;
    parqueaderos: number | null;
    area_m2: number | null;

    // Comodidades (Booleanos)
    tiene_local: boolean;
    tiene_garaje: boolean;
    tiene_sala: boolean;
    tiene_comedor: boolean;
    tiene_cocina_integral: boolean;
    tiene_patio: boolean;
    tiene_terraza: boolean;
    amoblado: boolean;

    propietario_id: string;

    // Index signature para seguridad extra
    [key: string]: any;
}

export interface InmuebleFormData {
    barrio: string;
    direccion: string;
    tipo_negocio: TipoNegocio;
    tipo_inmueble: string;
    precio: number;
    habitaciones: number;
    banos: number;
    area_m2: number;
    tiene_garaje: boolean;
    tiene_local: boolean;
    tiene_sala: boolean;
    tiene_comedor: boolean;
    tiene_patio: boolean;
    imagenes: string[];
    titulo: string;
}

export const formatCOP = (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};