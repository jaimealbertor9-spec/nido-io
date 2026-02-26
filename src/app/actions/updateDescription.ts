'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getServiceRoleClient } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import type { UpdateDescriptionResult } from './action-types';

// Re-export the type for consumers
export type { UpdateDescriptionResult } from './action-types';

/**
 * Updates the title, description, and keywords for a property
 * 
 * SECURITY: Session-based auth + ownership check prevents IDOR attacks
 * 
 * @param propertyId - The property ID
 * @param title - The ad title (max 60 chars)
 * @param description - The detailed description
 * @param keywords - Optional SEO keywords array
 */
export async function updatePropertyDescription(
    propertyId: string,
    title: string,
    description: string,
    keywords?: string[]
): Promise<UpdateDescriptionResult> {
    try {
        // ═══════════════════════════════════════════════════════════════
        // STEP A: Auth Check (Session-Based)
        // ═══════════════════════════════════════════════════════════════
        const supabaseAuth = createServerSupabaseClient();
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

        if (authError || !user) {
            console.error('❌ [updateDescription] Unauthorized - no session');
            return { success: false, error: 'Unauthorized' };
        }

        // Validate inputs
        if (!propertyId) {
            return { success: false, error: 'Property ID is required' };
        }

        if (!title?.trim()) {
            return { success: false, error: 'Title is required' };
        }

        if (!description?.trim()) {
            return { success: false, error: 'Description is required' };
        }

        if (title.length > 60) {
            return { success: false, error: 'Title cannot exceed 60 characters' };
        }

        const supabase = getServiceRoleClient();

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
            console.error('🚫 [updateDescription] IDOR blocked - user does not own property');
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
                keywords: keywords || [],
                updated_at: new Date().toISOString(),
            })
            .eq('id', propertyId);

        if (error) {
            console.error('Error updating description:', error);
            return { success: false, error: `Database error: ${error.message}` };
        }

        // Revalidate wizard pages
        revalidatePath(`/publicar/crear/${propertyId}`);

        console.log('✅ Description updated for property:', propertyId);
        return { success: true };

    } catch (err: any) {
        console.error('Unexpected error updating description:', err);
        return { success: false, error: err.message || 'Unexpected error' };
    }
}

/**
 * Fetches the current title and description for a property
 */
export async function getPropertyDescription(propertyId: string): Promise<{
    title: string;
    description: string;
    keywords: string[];
} | null> {
    try {
        const supabase = getServiceRoleClient();

        const { data, error } = await supabase
            .from('inmuebles')
            .select('titulo, descripcion, keywords')
            .eq('id', propertyId)
            .single();

        if (error || !data) {
            return null;
        }

        return {
            title: data.titulo || '',
            description: data.descripcion || '',
            keywords: data.keywords || [],
        };

    } catch (err) {
        console.error('Error fetching description:', err);
        return null;
    }
}
