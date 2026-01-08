import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 1. Safe extraction of Environment Variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 2. Debugging Log (Visible in Vercel Build Logs)
if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️ Supabase environment variables are missing! Check Vercel Settings.');
    }
}

// 3. Client Creation Strategy (Prevents build crash)
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
// TYPES (Español/English Compatibility)
// ==========================================

export type TipoNegocio = 'venta' | 'arriendo' | 'dias' | string;
export type EstadoInmueble =
    | 'borrador'
    | 'pendiente_pago'
    | 'en_revision'
    | 'publicado'
    | 'pausado'
    | 'expirado'
    | 'rechazado'
    | string;

export interface Inmueble {
    id: string;
    created_at: string;
    updated_at: string;

    // CAMPOS ESPAÑOL (Principales)
    titulo: string;
    precio: number;
    tipo_negocio: TipoNegocio;
    tipo_inmueble: string;
    descripcion: string | null;
    estado: EstadoInmueble;

    // COMPATIBILIDAD INGLÉS (Evita errores de tipos viejos)
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

    // Comodidades
    tiene_local: boolean;
    tiene_garaje: boolean;
    tiene_sala: boolean;
    tiene_comedor: boolean;
    tiene_cocina_integral: boolean;
    tiene_patio: boolean;
    tiene_terraza: boolean;
    amoblado: boolean;

    propietario_id: string;

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