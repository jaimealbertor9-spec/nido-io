'use server';

import { getServiceRoleClient } from '@/lib/supabase-admin';

// ═══════════════════════════════════════════════════════════════════════════
// getUserPublishContext — Smart Logic for Plan Selection Page
// Returns one of three states: HAS_CREDITS, FIRST_TIMER, FREE_EXHAUSTED
// ═══════════════════════════════════════════════════════════════════════════

export type PublishContext =
    | {
        type: 'HAS_CREDITS';
        credits: number;          // -1 for unlimited
        source: 'wallet' | 'subscription';
        walletId?: string;
        subscriptionId?: string;
        packageName: string;
        features: Record<string, boolean>;
        duracionDias: number;
    }
    | { type: 'FIRST_TIMER' }
    | { type: 'FREE_EXHAUSTED' };

export async function getUserPublishContext(userId: string): Promise<PublishContext> {
    const supabase = getServiceRoleClient();

    // ─────────────────────────────────────────────────────────────────────
    // Priority 1: Check active subscription (unlimited plan)
    // ─────────────────────────────────────────────────────────────────────
    const { data: activeSub } = await supabase
        .from('user_subscriptions')
        .select(`
      id,
      package_id,
      packages (
        nombre,
        features,
        duracion_anuncio_dias
      )
    `)
        .eq('user_id', userId)
        .eq('estado', 'activa')
        .gt('fecha_fin', new Date().toISOString())
        .limit(1)
        .maybeSingle();

    if (activeSub && activeSub.packages) {
        const pkg = activeSub.packages as any;
        return {
            type: 'HAS_CREDITS',
            credits: -1,
            source: 'subscription',
            subscriptionId: activeSub.id,
            packageName: pkg.nombre,
            features: pkg.features || {},
            duracionDias: pkg.duracion_anuncio_dias || 90,
        };
    }

    // ─────────────────────────────────────────────────────────────────────
    // Priority 2: Check wallets with remaining credits (non-free packages)
    // ─────────────────────────────────────────────────────────────────────
    const { data: wallets } = await supabase
        .from('user_wallets')
        .select(`
      id,
      creditos_total,
      creditos_usados,
      packages (
        slug,
        nombre,
        features,
        duracion_anuncio_dias
      )
    `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (wallets) {
        for (const wallet of wallets) {
            const pkg = wallet.packages as any;
            if (!pkg || pkg.slug === 'free') continue;
            const remaining = wallet.creditos_total - wallet.creditos_usados;
            if (remaining > 0) {
                return {
                    type: 'HAS_CREDITS',
                    credits: remaining,
                    source: 'wallet',
                    walletId: wallet.id,
                    packageName: pkg.nombre,
                    features: pkg.features || {},
                    duracionDias: pkg.duracion_anuncio_dias || 90,
                };
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Priority 3: Check if free tier was already used
    // ─────────────────────────────────────────────────────────────────────
    let freeUsed = false;
    if (wallets) {
        for (const wallet of wallets) {
            const pkg = wallet.packages as any;
            if (pkg && pkg.slug === 'free' && wallet.creditos_usados > 0) {
                freeUsed = true;
                break;
            }
        }
    }

    // Also check listing_credits directly for safety
    if (!freeUsed) {
        const { count } = await supabase
            .from('listing_credits')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (count && count > 0) {
            // User has published before, so free tier is used
            freeUsed = true;
        }
    }

    return freeUsed ? { type: 'FREE_EXHAUSTED' } : { type: 'FIRST_TIMER' };
}

// ═══════════════════════════════════════════════════════════════════════════
// getPackages — Fetch all active packages for the pricing table
// ═══════════════════════════════════════════════════════════════════════════

export interface PackageInfo {
    id: string;
    slug: string;
    nombre: string;
    tipo: string;
    precio_cop: number;
    creditos: number;
    duracion_anuncio_dias: number;
    features: Record<string, boolean>;
    wompi_payment_link_url: string | null;
}

export async function getPackages(): Promise<PackageInfo[]> {
    const supabase = getServiceRoleClient();

    const { data, error } = await supabase
        .from('packages')
        .select('id, slug, nombre, tipo, precio_cop, creditos, duracion_anuncio_dias, features, wompi_payment_link_url')
        .eq('activo', true)
        .order('precio_cop', { ascending: true });

    if (error || !data) {
        console.error('[publishContext] Error fetching packages:', error?.message);
        return [];
    }

    return data as PackageInfo[];
}
