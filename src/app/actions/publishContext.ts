'use server';

import { getServiceRoleClient } from '../../lib/supabase-admin';
import { 
    WalletSummary, 
    PackageData, 
    PublishContext, 
    UserWalletsResult, 
    PackageInfo 
} from './action-types';

// ═══════════════════════════════════════════════════════════════════════════
// getUserPublishContext — Smart Logic for Plan Selection Page
// Returns one of three states: HAS_CREDITS, FIRST_TIMER, FREE_EXHAUSTED
// ═══════════════════════════════════════════════════════════════════════════

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
        const pkg = activeSub.packages as unknown as PackageData;
        return {
            type: 'HAS_CREDITS',
            credits: -1,
            source: 'subscription',
            subscriptionId: activeSub.id,
            packageName: pkg.nombre,
            features: {
                showPhone: Boolean(pkg.features?.showPhone),
                showWhatsApp: Boolean(pkg.features?.showWhatsApp),
                highlighted: Boolean(pkg.features?.highlighted),
                statistics: Boolean(pkg.features?.statistics),
                ...(typeof pkg.features === 'object' ? pkg.features : {})
            },
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
        .order('created_at', { ascending: true });

    if (wallets) {
        for (const wallet of wallets) {
            const pkg = wallet.packages as unknown as PackageData;
            if (!pkg || pkg.slug === 'free') continue;
            const remaining = wallet.creditos_total - wallet.creditos_usados;
            if (remaining > 0) {
                return {
                    type: 'HAS_CREDITS',
                    credits: remaining,
                    source: 'wallet',
                    walletId: wallet.id,
                    packageName: pkg.nombre,
                    features: {
                        showPhone: Boolean(pkg.features?.showPhone),
                        showWhatsApp: Boolean(pkg.features?.showWhatsApp),
                        highlighted: Boolean(pkg.features?.highlighted),
                        statistics: Boolean(pkg.features?.statistics),
                        ...(typeof pkg.features === 'object' ? pkg.features : {})
                    },
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
            const pkg = wallet.packages as unknown as PackageData;
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
// getUserWallets — Fetch ALL active wallets for multi-wallet UI
// Returns detailed breakdown for dashboard and wallet selector modal
// ═══════════════════════════════════════════════════════════════════════════

export async function getUserWallets(userId: string): Promise<UserWalletsResult> {
    const supabase = getServiceRoleClient();
    const now = new Date();

    // ─────────────────────────────────────────────────────────────────────
    // 1. Fetch ALL wallets (including free) with package details
    // ─────────────────────────────────────────────────────────────────────
    const { data: wallets, error } = await supabase
        .from('user_wallets')
        .select(`
            id,
            package_id,
            creditos_total,
            creditos_usados,
            expires_at,
            created_at,
            packages (
                id,
                slug,
                nombre,
                features,
                duracion_anuncio_dias
            )
        `)
        .eq('user_id', userId);

    if (error) {
        console.error('[getUserWallets] Error fetching wallets:', error.message);
        return {
            wallets: [],
            hasMultipleWallets: false,
            totalCredits: 0,
            hasUnlimited: false,
            firstTimer: false,
            freeExhausted: true
        };
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2. Check for active subscription (unlimited plan)
    // ─────────────────────────────────────────────────────────────────────
    const { data: activeSub } = await supabase
        .from('user_subscriptions')
        .select(`
            id,
            package_id,
            packages (
                id,
                slug,
                nombre,
                features,
                duracion_anuncio_dias
            )
        `)
        .eq('user_id', userId)
        .eq('estado', 'activa')
        .gt('fecha_fin', now.toISOString())
        .maybeSingle();

    const walletSummaries: WalletSummary[] = [];

    // ─────────────────────────────────────────────────────────────────────
    // 3. Add subscription as an "unlimited wallet" if active
    // ─────────────────────────────────────────────────────────────────────
    if (activeSub && activeSub.packages) {
        const pkg = activeSub.packages as unknown as PackageData;
        walletSummaries.push({
            walletId: `sub_${activeSub.id}`,
            packageId: pkg.id,
            packageName: pkg.nombre || 'Ilimitado',
            packageSlug: pkg.slug || 'unlimited',
            creditsTotal: -1,
            creditsUsed: 0,
            creditsRemaining: -1,
            isUnlimited: true,
            expiresAt: null, // Subscriptions have their own expiry logic
            features: {
                showPhone: Boolean(pkg.features?.showPhone),
                showWhatsApp: Boolean(pkg.features?.showWhatsApp),
                highlighted: Boolean(pkg.features?.highlighted),
                statistics: Boolean(pkg.features?.statistics),
                ...(typeof pkg.features === 'object' ? pkg.features : {})
            } as WalletSummary['features'],
            duracionDias: pkg.duracion_anuncio_dias || 90,
            priority: 0 // Unlimited always highest priority
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. Process each wallet - filter non-expired and calculate remaining
    // ─────────────────────────────────────────────────────────────────────
    let freeUsed = false;

    if (wallets && wallets.length > 0) {
        // Sort by expires_at ASC (expire soonest first) for priority
        const sortedWallets = [...wallets].sort((a, b) => {
            if (!a.expires_at && !b.expires_at) return 0;
            if (!a.expires_at) return 1;
            if (!b.expires_at) return -1;
            return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
        });

        for (let i = 0; i < sortedWallets.length; i++) {
            const wallet = sortedWallets[i];
            const pkg = wallet.packages as unknown as PackageData;

            // Skip if no package data
            if (!pkg) continue;

            const isUnlimited = wallet.creditos_total === -1;
            const creditsRemaining = isUnlimited ? -1 : Math.max(0, wallet.creditos_total - wallet.creditos_usados);
            const isExpired = wallet.expires_at && new Date(wallet.expires_at) < now;

            // Track free tier usage
            if (pkg.slug === 'free' && wallet.creditos_usados > 0) {
                freeUsed = true;
            }

            // Skip expired wallets (unless unlimited, which doesn't expire this way)
            if (isExpired && !isUnlimited) continue;

            // Skip wallets with no credits remaining (except unlimited)
            if (!isUnlimited && creditsRemaining <= 0) continue;

            // Determine priority based on plan tier
            let priority = 10; // Default
            if (pkg.slug === 'free') priority = 50; // Free is lowest priority
            else if (pkg.slug === 'plata' || pkg.slug === 'silver') priority = 30;
            else if (pkg.slug === 'oro' || pkg.slug === 'gold') priority = 20;
            else if (pkg.slug === 'unlimited' || isUnlimited) priority = 0;

            // Add expires_at proximity bonus (sooner expiry = lower priority number)
            if (wallet.expires_at) {
                const daysUntilExpiry = Math.ceil((new Date(wallet.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntilExpiry < 7) priority -= 5; // Expiring soon, suggest using it
            }

            walletSummaries.push({
                walletId: wallet.id,
                packageId: pkg.id,
                packageName: pkg.nombre || 'Plan',
                packageSlug: pkg.slug || 'unknown',
                creditsTotal: wallet.creditos_total,
                creditsUsed: wallet.creditos_usados,
                creditsRemaining,
                isUnlimited,
                expiresAt: wallet.expires_at,
                features: {
                    showPhone: Boolean(pkg.features?.showPhone),
                    showWhatsApp: Boolean(pkg.features?.showWhatsApp),
                    highlighted: Boolean(pkg.features?.highlighted),
                    statistics: Boolean(pkg.features?.statistics),
                    ...(typeof pkg.features === 'object' ? pkg.features : {})
                } as WalletSummary['features'],
                duracionDias: pkg.duracion_anuncio_dias || 30,
                priority
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 5. Check if free tier was used (for first-timer detection)
    // ─────────────────────────────────────────────────────────────────────
    if (!freeUsed) {
        const { count } = await supabase
            .from('listing_credits')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (count && count > 0) {
            freeUsed = true;
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 6. Calculate totals and flags
    // ─────────────────────────────────────────────────────────────────────
    const hasUnlimited = walletSummaries.some(w => w.isUnlimited);
    const totalCredits = hasUnlimited
        ? -1
        : walletSummaries.reduce((sum, w) => sum + (w.isUnlimited ? 0 : w.creditsRemaining), 0);

    // Sort final array by priority
    walletSummaries.sort((a, b) => a.priority - b.priority);

    return {
        wallets: walletSummaries,
        hasMultipleWallets: walletSummaries.length > 1,
        totalCredits,
        hasUnlimited,
        firstTimer: !freeUsed && walletSummaries.length === 0,
        freeExhausted: freeUsed && walletSummaries.length === 0
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// getPackages — Fetch all active packages for the pricing table
// ═══════════════════════════════════════════════════════════════════════════

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
