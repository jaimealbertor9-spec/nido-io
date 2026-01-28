import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

// ==========================================
// DEFINICIONES DE TIPOS Y UTILIDADES (Agregado para PropertyCard)
// ==========================================

export type EstadoInmueble = 'borrador' | 'publicado' | 'vendido' | 'alquilado' | 'en_revision' | 'pausado' | 'pendiente_pago' | 'expirado' | 'rechazado';

export interface Inmueble {
    id: string;
    titulo: string;
    descripcion?: string;
    precio: number;
    ubicacion?: string;
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
    tour_virtual_url?: string;
    anio_construccion?: number;
    piso?: number;
    administracion?: number;
    created_at: string;
    updated_at: string;
    propietario_id: string;
    // Relación con imágenes
    inmueble_imagenes?: { url: string }[];
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