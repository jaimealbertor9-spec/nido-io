'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';

// ═══════════════════════════════════════════════════════════════════════════
// Per-Property Analytics Data Model
// Each property returns its own KPIs + expiration state for paywall gating
// ═══════════════════════════════════════════════════════════════════════════

export interface PropertyAnalyticsItem {
    id: string;
    titulo: string;
    fecha_expiracion: string | null;
    views: number;
    leads: number;
    interactions: number;
    saves: number;
}

export interface OwnerAnalyticsPayload {
    properties: PropertyAnalyticsItem[];
}

/**
 * getOwnerAnalytics — Returns per-property analytics for the authenticated owner.
 *
 * Each item includes: id, titulo, fecha_expiracion, views, leads, interactions, saves.
 * The frontend uses fecha_expiracion to gate the per-property paywall.
 */
export async function getOwnerAnalytics(): Promise<OwnerAnalyticsPayload | null> {
    const supabase = createServerSupabaseClient();

    // 1. Authenticate
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return null;

    // 2. Fetch all properties for this owner
    const { data: properties, error: propError } = await supabase
        .from('inmuebles')
        .select('id, titulo, fecha_expiracion')
        .eq('propietario_id', user.id)
        .order('created_at', { ascending: false });

    if (propError || !properties || properties.length === 0) {
        return { properties: [] };
    }

    const propertyIds = properties.map(p => p.id);

    // 3. Batch-fetch property_analytics for all owned properties
    const { data: analytics } = await supabase
        .from('property_analytics')
        .select('inmueble_id, views, whatsapp_clicks, phone_clicks, message_clicks, saves')
        .in('inmueble_id', propertyIds);

    // 4. Batch-fetch lead counts grouped by inmueble_id
    //    We use a raw count approach per property
    const { data: leadRows } = await supabase
        .from('property_leads')
        .select('inmueble_id')
        .in('inmueble_id', propertyIds);

    // Count leads per property in memory
    const leadCountMap: Record<string, number> = {};
    if (leadRows) {
        for (const row of leadRows) {
            leadCountMap[row.inmueble_id] = (leadCountMap[row.inmueble_id] || 0) + 1;
        }
    }

    // 5. Build the per-property payload
    const result: PropertyAnalyticsItem[] = properties.map(prop => {
        const stat = analytics?.find(a => a.inmueble_id === prop.id);
        const views = stat?.views || 0;
        const interactions =
            (stat?.whatsapp_clicks || 0) +
            (stat?.phone_clicks || 0) +
            (stat?.message_clicks || 0);
        const saves = stat?.saves || 0;
        const leads = leadCountMap[prop.id] || 0;

        return {
            id: prop.id,
            titulo: prop.titulo || 'Sin Título',
            fecha_expiracion: prop.fecha_expiracion,
            views,
            leads,
            interactions,
            saves,
        };
    });

    return { properties: result };
}
