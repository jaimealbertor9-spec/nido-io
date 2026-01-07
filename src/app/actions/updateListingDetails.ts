'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import type { UpdateListingResult } from './action-types';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG: Environment Variable Verification (Remove after debugging)
// ═══════════════════════════════════════════════════════════════════════════
const DEBUG_ENV = true; // Set to false to disable logging

if (DEBUG_ENV) {
    console.log('🔧 [DEBUG] Supabase Environment Check:');
    console.log('   - NEXT_PUBLIC_SUPABASE_URL defined:', !!supabaseUrl);
    console.log('   - URL starts with https:', supabaseUrl?.startsWith('https://'));
    console.log('   - SUPABASE_SERVICE_ROLE_KEY defined:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('   - NEXT_PUBLIC_SUPABASE_ANON_KEY defined:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    console.log('   - Using key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON');
    if (!supabaseUrl) {
        console.error('❌ [CRITICAL] NEXT_PUBLIC_SUPABASE_URL is undefined!');
    }
    if (!supabaseServiceKey) {
        console.error('❌ [CRITICAL] No Supabase key available!');
    }
}

// Re-export the type for consumers
export type { UpdateListingResult } from './action-types';

/**
 * Updates all final listing details including title, description, price, and offer type
 * @param propertyId - The property ID
 * @param title - The ad title (max 60 chars)
 * @param description - The detailed description
 * @param price - The price in COP (must be > 0)
 * @param offerType - 'venta', 'arriendo', or 'arriendo_dias' (short-term rental)
 * @param keywords - Optional SEO keywords array
 */
export async function updateListingDetails(
    propertyId: string,
    title: string,
    description: string,
    price: number,
    offerType: 'venta' | 'arriendo' | 'arriendo_dias',
    keywords?: string[]
): Promise<UpdateListingResult> {
    try {
        // Validate inputs
        if (!propertyId) {
            return { success: false, error: 'Property ID is required' };
        }

        if (!title?.trim()) {
            return { success: false, error: 'El título es obligatorio' };
        }

        if (title.length > 60) {
            return { success: false, error: 'El título no puede exceder 60 caracteres' };
        }

        if (!description?.trim()) {
            return { success: false, error: 'La descripción es obligatoria' };
        }

        if (!price || price <= 0) {
            return { success: false, error: 'El precio debe ser mayor a 0' };
        }

        if (!['venta', 'arriendo', 'arriendo_dias'].includes(offerType)) {
            return { success: false, error: 'Tipo de oferta inválido' };
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Update property with all details
        const { error } = await supabase
            .from('inmuebles')
            .update({
                titulo: title.trim(),
                descripcion: description.trim(),
                precio: price,
                tipo_negocio: offerType,
                keywords: keywords || [],
                estado: 'pendiente', // Ready for review/payment
                updated_at: new Date().toISOString(),
            })
            .eq('id', propertyId);

        if (error) {
            console.error('Error updating listing details:', error);
            return { success: false, error: `Error de base de datos: ${error.message}` };
        }

        // Revalidate pages
        revalidatePath(`/publicar/crear/${propertyId}`);
        revalidatePath(`/mis-inmuebles`);

        console.log('✅ Listing details updated for property:', propertyId);
        return { success: true };

    } catch (err: any) {
        console.error('Unexpected error updating listing:', err);
        return { success: false, error: err.message || 'Error inesperado' };
    }
}

/**
 * Fetches current listing details for editing
 */
export async function getListingDetails(propertyId: string): Promise<{
    title: string;
    description: string;
    price: number;
    offerType: 'venta' | 'arriendo' | 'arriendo_dias';
    keywords: string[];
    propertyType: string;
    neighborhood: string;
} | null> {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase
            .from('inmuebles')
            .select('titulo, descripcion, precio, tipo_negocio, keywords, tipo_inmueble, barrio')
            .eq('id', propertyId)
            .single();

        if (error || !data) {
            return null;
        }

        return {
            title: data.titulo || '',
            description: data.descripcion || '',
            price: data.precio || 0,
            offerType: data.tipo_negocio || 'venta',
            keywords: data.keywords || [],
            propertyType: data.tipo_inmueble || '',
            neighborhood: data.barrio || '',
        };

    } catch (err) {
        console.error('Error fetching listing details:', err);
        return null;
    }
}

/**
 * Fetches property features for AI description generation
 * Returns the structured data needed by generatePropertyDescription
 */
export async function getPropertyFeatures(propertyId: string): Promise<{
    habitaciones: number;
    banos: number;
    area: number;
    estrato: number;
    servicios: string[];
    amenities: string[];
    tipo_inmueble: string;
    barrio: string;
} | null> {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 [getPropertyFeatures] Starting for property:', propertyId);

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        console.log('🔍 [getPropertyFeatures] Querying database...');
        // Note: Using aliasing to map DB column 'amenities' → 'amenidades' for application layer
        const { data, error } = await supabase
            .from('inmuebles')
            .select('habitaciones, banos, area_m2, estrato, servicios, amenidades:amenities, tipo_inmueble, barrio')
            .eq('id', propertyId)
            .single();

        if (error) {
            console.error('❌ [getPropertyFeatures] Database error:', error);
            console.error('   Error code:', error.code);
            console.error('   Error message:', error.message);
            return null;
        }

        if (!data) {
            console.error('❌ [getPropertyFeatures] No data returned');
            return null;
        }

        console.log('✅ [getPropertyFeatures] Raw data from DB:', JSON.stringify(data, null, 2));

        const result = {
            habitaciones: data.habitaciones || 0,
            banos: data.banos || 0,
            area: data.area_m2 || 0,
            estrato: data.estrato || 0,
            servicios: data.servicios || [],
            amenities: data.amenidades || [],
            tipo_inmueble: data.tipo_inmueble || '',
            barrio: data.barrio || '',
        };

        console.log('📦 [getPropertyFeatures] Returning:', JSON.stringify(result, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return result;

    } catch (err) {
        console.error('❌ [getPropertyFeatures] Unexpected error:', err);
        return null;
    }
}
