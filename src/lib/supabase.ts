import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Prevent build crash if vars are missing (Vercel build phase)
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase env vars missing. This is fine during build/lint, but app will fail at runtime.');
}

// Singleton pattern: global variable prevents multiple GoTrueClient instances
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
    if (!supabaseInstance) {
        // Use placeholders during build to prevent crash, real values at runtime
        const url = supabaseUrl || 'https://placeholder.supabase.co';
        const key = supabaseAnonKey || 'placeholder-key';

        supabaseInstance = createClient(url, key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
            }
        });
    }
    return supabaseInstance;
}

// Legacy export for backward compatibility
export const supabase = getSupabaseClient();

// Tipos para las tablas de Nido IO
export type TipoNegocio = 'venta' | 'arriendo' | 'dias';
export type EstadoInmueble = 'borrador' | 'pendiente_pago' | 'en_revision' | 'publicado' | 'pausado' | 'expirado' | 'rechazado';

export interface Inmueble {
    id: string;
    created_at: string;
    updated_at: string;
    titulo: string;
    precio: number;
    tipo_negocio: TipoNegocio;
    tipo_inmueble: string;
    barrio: string | null;
    vereda: string | null;
    direccion: string | null;
    habitaciones: number | null;
    banos: number | null;
    parqueaderos: number | null;
    area_m2: number | null;
    tiene_local: boolean;
    tiene_garaje: boolean;
    tiene_sala: boolean;
    tiene_comedor: boolean;
    tiene_cocina_integral: boolean;
    tiene_patio: boolean;
    tiene_terraza: boolean;
    amoblado: boolean;
    descripcion: string | null;  // Main description field
    estado: EstadoInmueble;
    propietario_id: string;
}

export interface InmuebleFormData {
    // Paso 1: Ubicación
    barrio: string;
    direccion: string;

    // Paso 2: Datos Básicos
    tipo_negocio: TipoNegocio;
    tipo_inmueble: string;
    precio: number;
    habitaciones: number;
    banos: number;
    area_m2: number;

    // Checkboxes
    tiene_garaje: boolean;
    tiene_local: boolean;
    tiene_sala: boolean;
    tiene_comedor: boolean;
    tiene_patio: boolean;

    // Paso 3: Fotos (URLs después de subir)
    imagenes: string[];

    // Generado
    titulo: string;
}

// Utilidad para formatear precios en COP
export const formatCOP = (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

