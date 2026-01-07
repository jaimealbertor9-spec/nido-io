'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import type { SaveFeaturesResult } from './action-types';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Re-export the type for consumers
export type { SaveFeaturesResult } from './action-types';

/**
 * Saves property features including rooms, baths, area, amenities, and services
 * @param propertyId - The property ID
 * @param habitaciones - Number of bedrooms
 * @param banos - Number of bathrooms
 * @param area_m2 - Area in square meters
 * @param estrato - Estrato (socioeconomic level)
 * @param amenities - Array of amenity names
 * @param servicios - Array of utility services
 * @param aiSummary - Optional AI-generated description summary
 */
export async function savePropertyFeatures(
    propertyId: string,
    habitaciones: number,
    banos: number,
    area_m2: number,
    estrato: number,
    amenities: string[],
    servicios: string[],
    aiSummary?: string
): Promise<SaveFeaturesResult> {
    try {
        // Validate inputs
        if (!propertyId) {
            return { success: false, error: 'Property ID is required' };
        }

        if (habitaciones < 0 || banos < 0) {
            return { success: false, error: 'Rooms and baths cannot be negative' };
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Build update object
        const updateData: Record<string, any> = {
            habitaciones,
            banos,
            area_m2: area_m2 || null,
            estrato: estrato || null,
            amenities: amenities || [],
            servicios: servicios || [],
            updated_at: new Date().toISOString(),
        };

        // Add AI summary to description if provided
        if (aiSummary) {
            updateData.descripcion = aiSummary;
        }

        // Update property
        const { error } = await supabase
            .from('inmuebles')
            .update(updateData)
            .eq('id', propertyId);

        if (error) {
            console.error('Error saving features:', error);
            return { success: false, error: `Database error: ${error.message}` };
        }

        // Revalidate wizard pages
        revalidatePath(`/publicar/crear/${propertyId}`);

        console.log('✅ Features saved for property:', propertyId);
        return { success: true };

    } catch (err: any) {
        console.error('Unexpected error saving features:', err);
        return { success: false, error: err.message || 'Unexpected error' };
    }
}

/**
 * Fetches current property features for editing
 */
export async function getPropertyFeatures(propertyId: string): Promise<{
    habitaciones: number;
    banos: number;
    area_m2: number;
    estrato: number;
    amenities: string[];
    servicios: string[];
} | null> {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase
            .from('inmuebles')
            .select('habitaciones, banos, area_m2, estrato, amenities, servicios')
            .eq('id', propertyId)
            .single();

        if (error || !data) {
            return null;
        }

        return {
            habitaciones: data.habitaciones || 0,
            banos: data.banos || 0,
            area_m2: data.area_m2 || 0,
            estrato: data.estrato || 0,
            amenities: data.amenities || [],
            servicios: data.servicios || [],
        };

    } catch (err) {
        console.error('Error fetching features:', err);
        return null;
    }
}
