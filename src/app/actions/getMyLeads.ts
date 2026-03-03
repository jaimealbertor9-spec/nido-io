'use server';

import { getServiceRoleClient } from '@/lib/supabase-admin';

// ═══════════════════════════════════════════════════════════════════════════
// getMyLeads — Fetch all leads for the authenticated property owner
// Returns leads with masked phone for Free, full phone for Premium
// ═══════════════════════════════════════════════════════════════════════════

export interface LeadItem {
    id: string;
    inmueble_id: string;
    nombre: string;
    telefono: string;         // Full phone (only sent if premium)
    telefono_masked: string;  // Masked phone (always sent)
    email: string | null;
    mensaje: string | null;
    leido: boolean;
    desbloqueado: boolean;
    created_at: string;
    inmueble_titulo?: string; // Joined from inmuebles
}

export interface LeadsResult {
    leads: LeadItem[];
    totalCount: number;
    isPremium: boolean;
}

export async function getMyLeads(userId: string): Promise<LeadsResult> {
    const supabase = getServiceRoleClient();

    // ─────────────────────────────────────────────────────────────────────
    // 1. Check if user has premium access (any active wallet or subscription)
    // ─────────────────────────────────────────────────────────────────────
    let isPremium = false;

    // Check active subscription
    const { data: activeSub } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('estado', 'activa')
        .gt('fecha_fin', new Date().toISOString())
        .limit(1)
        .maybeSingle();

    if (activeSub) {
        isPremium = true;
    } else {
        // Check wallets with premium packages (non-free)
        const { data: wallets } = await supabase
            .from('user_wallets')
            .select('id, packages(slug)')
            .eq('user_id', userId);

        if (wallets) {
            isPremium = wallets.some((w: any) => w.packages?.slug !== 'free');
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2. Fetch leads for this owner
    // ─────────────────────────────────────────────────────────────────────
    const { data: leads, error, count } = await supabase
        .from('property_leads')
        .select(`
      id,
      inmueble_id,
      nombre,
      telefono,
      telefono_masked,
      email,
      mensaje,
      leido,
      desbloqueado,
      created_at,
      inmuebles (titulo)
    `, { count: 'exact' })
        .eq('propietario_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[getMyLeads] Error:', error.message);
        return { leads: [], totalCount: 0, isPremium };
    }

    const formattedLeads: LeadItem[] = (leads || []).map((lead: any) => ({
        id: lead.id,
        inmueble_id: lead.inmueble_id,
        nombre: lead.nombre,
        telefono: isPremium ? lead.telefono : '',  // Only expose full phone to premium
        telefono_masked: lead.telefono_masked,
        email: isPremium ? lead.email : null,
        mensaje: lead.mensaje,
        leido: lead.leido,
        desbloqueado: lead.desbloqueado || isPremium,
        created_at: lead.created_at,
        inmueble_titulo: lead.inmuebles?.titulo || 'Sin título',
    }));

    // ─────────────────────────────────────────────────────────────────────
    // 3. Mark unread leads as read
    // ─────────────────────────────────────────────────────────────────────
    const unreadIds = formattedLeads.filter(l => !l.leido).map(l => l.id);
    if (unreadIds.length > 0) {
        await supabase
            .from('property_leads')
            .update({ leido: true })
            .in('id', unreadIds);
    }

    return {
        leads: formattedLeads,
        totalCount: count || 0,
        isPremium,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// getPropertyPremiumStatus — Check if a specific property has premium features
// Used by the public property view to gate contact info
// ═══════════════════════════════════════════════════════════════════════════

export async function getPropertyPremiumStatus(inmuebleId: string): Promise<{
    isPremium: boolean;
    features: Record<string, boolean>;
}> {
    const supabase = getServiceRoleClient();

    const { data: listing } = await supabase
        .from('listing_credits')
        .select('features_snapshot, fecha_expiracion')
        .eq('inmueble_id', inmuebleId)
        .gt('fecha_expiracion', new Date().toISOString())
        .maybeSingle();

    if (!listing) {
        return { isPremium: false, features: {} };
    }

    const features = (listing.features_snapshot as Record<string, boolean>) || {};
    const isPremium = features.phone_visible === true;

    return { isPremium, features };
}
