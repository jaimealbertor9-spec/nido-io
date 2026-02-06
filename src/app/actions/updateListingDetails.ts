'use server';

import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import type { UpdateListingResult } from './action-types';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Re-export the type for consumers
export type { UpdateListingResult } from './action-types';

/**
 * Updates all final listing details including title, description, price, and offer type
 * 
 * SECURITY: Session-based auth + ownership check prevents IDOR attacks
 * 
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
        // ═══════════════════════════════════════════════════════════════
        // STEP A: Auth Check (Session-Based)
        // ═══════════════════════════════════════════════════════════════
        const supabaseAuth = createServerSupabaseClient();
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

        if (authError || !user) {
            console.error('❌ [updateListingDetails] Unauthorized - no session');
            return { success: false, error: 'Unauthorized' };
        }

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

        // ═══════════════════════════════════════════════════════════════
        // STEP B: Ownership Check (IDOR Protection)
        // ═══════════════════════════════════════════════════════════════
        const { data: property, error: ownerError } = await supabase
            .from('inmuebles')
            .select('id')
            .eq('id', propertyId)
            .eq('propietario_id', user.id)
            .single();

        if (ownerError || !property) {
            console.error('🚫 [updateListingDetails] IDOR blocked - user does not own property');
            return { success: false, error: 'Unauthorized: You do not own this property' };
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP C: Execute Update (Ownership Verified)
        // ═══════════════════════════════════════════════════════════════
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
