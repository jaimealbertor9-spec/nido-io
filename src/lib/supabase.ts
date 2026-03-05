import { createBrowserClient } from '@supabase/ssr';
import { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser-side Supabase client using @supabase/ssr
 * 
 * CRITICAL: This uses cookies (not localStorage) for auth tokens.
 * This allows Server Components and middleware to read the session.
 */
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);

// ==========================================
// DEFINICIONES DE TIPOS Y UTILIDADES (Agregado para PropertyCard)
// ==========================================

// DB CHECK constraint: borrador | en_revision | pendiente_verificacion | publicado | rechazado | vendido | arrendado | inactivo
export type EstadoInmueble = 'borrador' | 'en_revision' | 'pendiente_verificacion' | 'publicado' | 'rechazado' | 'vendido' | 'arrendado' | 'inactivo';

export interface Inmueble {
    id: string;
    titulo: string;
    descripcion?: string;
    precio: number;
    ciudad?: string;
    estado: EstadoInmueble;
    tipo_negocio: string;
    tipo_inmueble: string;
    area_m2: number;
    habitaciones: number;
    banos: number;
    estrato: number;
    direccion?: string;
    barrio?: string;
    latitud?: number;
    longitud?: number;
    amenities?: string[];
    servicios?: string[];
    video_url?: string;
    video_file?: string;
    administracion?: number;
    fecha_publicacion?: string;
    fecha_expiracion?: string;
    es_propietario?: boolean;
    created_at: string;
    updated_at: string;
    propietario_id: string;
    pago_id?: string;
    // Relación con imágenes
    inmueble_imagenes?: { url: string }[];
}

export type TipoNegocio = 'venta' | 'arriendo';

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

// Utilidad para formatear pesos colombianos
export const formatCOP = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};