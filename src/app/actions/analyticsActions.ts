'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';

export interface AnalyticsData {
    totalViews: number;
    totalLeads: number;
    totalInteractions: number;
    totalSaves: number;
    chartData: {
        name: string;
        ShortName: string;
        Visualizaciones: number;
        Interacciones: number;
        Guardados: number;
    }[];
}

export async function getOwnerLeadsCount(): Promise<number> {
    const supabase = createServerSupabaseClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return 0;

    const { count } = await supabase
        .from('property_leads')
        .select('*', { count: 'exact', head: true })
        .eq('propietario_id', user.id);

    return count || 0;
}

export async function getOwnerAnalytics(): Promise<AnalyticsData | null> {
    const supabase = createServerSupabaseClient();
    
    // 1. Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return null;
    }

    // 2. Fetch all properties for this owner (published or not)
    const { data: properties, error: propError } = await supabase
        .from('inmuebles')
        .select('id, titulo')
        .eq('propietario_id', user.id);

    if (propError || !properties || properties.length === 0) {
        return {
            totalViews: 0,
            totalLeads: 0,
            totalInteractions: 0,
            totalSaves: 0,
            chartData: []
        };
    }

    const propertyIds = properties.map(p => p.id);

    // 3. Query property_analytics
    const { data: analytics, error: analyticsError } = await supabase
        .from('property_analytics')
        .select('inmueble_id, views, whatsapp_clicks, phone_clicks, message_clicks, saves, shares')
        .in('inmueble_id', propertyIds);

    // 4. Query total leads safely via the helper
    const totalLeads = await getOwnerLeadsCount();

    // 5. Aggregate the data
    let totalViews = 0;
    let totalInteractions = 0;
    let totalSaves = 0;

    const chartData = properties.map(prop => {
        const stat = analytics?.find(a => a.inmueble_id === prop.id);
        
        const views = stat?.views || 0;
        const interactions = (stat?.whatsapp_clicks || 0) + (stat?.phone_clicks || 0) + (stat?.message_clicks || 0);
        const saves = stat?.saves || 0;
        const shares = stat?.shares || 0;

        totalViews += views;
        totalInteractions += interactions + shares;
        totalSaves += saves;

        return {
            name: prop.titulo || 'Sin Título',
            ShortName: (prop.titulo?.length || 0) > 20 
                        ? prop.titulo?.substring(0, 18) + '...' 
                        : (prop.titulo || 'Inmueble'),
            Visualizaciones: views,
            Interacciones: interactions,
            Guardados: saves
        };
    });

    // Sort chart data primarily by views, then by interactions
    const sortedChartData = chartData
        .sort((a, b) => b.Visualizaciones - a.Visualizaciones)
        .slice(0, 7); // Only show top 7 properties to prevent chart clutter

    return {
        totalViews,
        totalLeads,
        totalInteractions,
        totalSaves,
        chartData: sortedChartData
    };
}
