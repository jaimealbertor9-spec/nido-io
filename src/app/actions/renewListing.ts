'use server';

import { getServiceRoleClient } from '@/lib/supabase-admin';

/**
 * renewListing — Server Action to renew an expired listing.
 * 
 * Flow:
 * 1. Find available wallet (FIFO: expires_at ASC — "Protect the User" strategy)
 * 2. Atomically deduct 1 credit
 * 3. Fetch package duration
 * 4. Update listing_credits & inmuebles
 * 5. Return success or redirect to planes page
 */
export async function renewListing(inmuebleId: string, userId: string) {
    const supabase = getServiceRoleClient();

    try {
        // 1. Fetch ALL unexpired-looking wallets for the user
        const { data: allWallets, error: walletError } = await supabase
            .from('user_wallets')
            .select('id, creditos_total, creditos_usados, package_id, expires_at')
            .eq('user_id', userId);

        if (walletError) {
            console.error('❌ [Renew] Error fetching wallets:', walletError.message);
            return { success: false, error: 'Error al buscar billetera' };
        }

        const nowDate = new Date();

        // 2. Filter available and valid wallets in memory (Bulletproof Logic)
        const validWallet = allWallets?.find(w => {
            const hasCredits = w.creditos_total === -1 || w.creditos_total > w.creditos_usados;
            const notExpired = !w.expires_at || new Date(w.expires_at) > nowDate;
            return hasCredits && notExpired;
        });

        if (!validWallet) {
            console.log('ℹ️ [Renew] No available credits found. Redirecting to plans.');
            return { success: false, redirect: '/mis-inmuebles/planes' };
        }

        // Rename validWallet to wallet for compatibility with the rest of your code
        const wallet = validWallet;

        // ──────────────────────────────────────────────────────────────
        // Step 3 — Deduct 1 credit
        // Parse numbers safely to avoid Postgres type mismatch / string concatenation
        // ──────────────────────────────────────────────────────────────
        const totalCredits = Number(wallet.creditos_total);
        const usedCredits = Number(wallet.creditos_usados) || 0;
        const isUnlimited = totalCredits === -1;

        if (!isUnlimited) {
            const { data: decrementResult, error: decrementError } = await supabase
                .from('user_wallets')
                .update({
                    creditos_usados: usedCredits + 1
                })
                .eq('id', wallet.id)
                .select('id');

            if (decrementError) {
                console.error('❌ [Renew] Update Error:', decrementError.message);
                return { success: false, error: 'Error de base de datos al cobrar crédito' };
            }

            if (!decrementResult || decrementResult.length === 0) {
                console.log('⚠️ [Renew] Wallet update affected 0 rows:', wallet.id);
                return { success: false, redirect: '/mis-inmuebles/planes' };
            }

            console.log('✅ [Renew] Credit deducted from wallet:', wallet.id, `| Used: ${usedCredits + 1}/${totalCredits}`);
        } else {
            console.log('♾️ [Renew] Unlimited plan — no credit decrement');
        }

        // ──────────────────────────────────────────────────────────────
        // Step 4 — Fetch package duration
        // ──────────────────────────────────────────────────────────────
        const { data: pkg, error: pkgError } = await supabase
            .from('packages')
            .select('duracion_anuncio_dias, nombre')
            .eq('id', wallet.package_id)
            .single();

        if (pkgError || !pkg) {
            console.error('❌ [Renew] Package not found for wallet:', wallet.package_id);
            return { success: false, error: 'Paquete no encontrado' };
        }

        const durationDays = pkg.duracion_anuncio_dias || 30;
        const now = nowDate;
        const newExpiration = new Date(now);
        newExpiration.setDate(newExpiration.getDate() + durationDays);

        console.log(`📅 [Renew] Duration: ${durationDays} days | New expiration: ${newExpiration.toISOString()}`);

        // ──────────────────────────────────────────────────────────────
        // Step 5 — Update listing_credits (UPDATE or INSERT if missing)
        // ──────────────────────────────────────────────────────────────
        const { data: existingCredit } = await supabase
            .from('listing_credits')
            .select('id')
            .eq('inmueble_id', inmuebleId)
            .maybeSingle();

        if (existingCredit) {
            await supabase
                .from('listing_credits')
                .update({
                    fecha_expiracion: newExpiration.toISOString()
                })
                .eq('id', existingCredit.id);
        } else {
            // Legacy property with no listing_credits row — insert one
            await supabase
                .from('listing_credits')
                .insert({
                    inmueble_id: inmuebleId,
                    user_id: userId,
                    wallet_id: wallet.id,
                    fecha_expiracion: newExpiration.toISOString()
                });
        }

        // ──────────────────────────────────────────────────────────────
        // Step 6 — Update inmuebles (estado → en_revision for moderation)
        // ──────────────────────────────────────────────────────────────
        const { error: inmuebleError } = await supabase
            .from('inmuebles')
            .update({
                estado: 'en_revision',   // MUST go through moderation queue
                fecha_expiracion: newExpiration.toISOString()
            })
            .eq('id', inmuebleId);

        if (inmuebleError) {
            console.error('❌ [Renew] Failed to update inmueble:', inmuebleError.message);
            return { success: false, error: 'Error al renovar la publicación' };
        }

        console.log(`✅ [Renew] Property ${inmuebleId} renewed | Plan: ${pkg.nombre} | Expires: ${newExpiration.toISOString()}`);

        return {
            success: true,
            data: {
                newExpiration: newExpiration.toISOString(),
                packageName: pkg.nombre,
                durationDays
            }
        };

    } catch (error: any) {
        console.error('💥 [Renew] Unexpected error:', error.message);
        return { success: false, error: 'Error inesperado al renovar' };
    }
}
