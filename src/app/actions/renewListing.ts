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
        const nowIso = new Date().toISOString();

        // ──────────────────────────────────────────────────────────────
        // Step 1 — Find available wallet ("Protect the User" FIFO)
        // Fetch unexpired wallets and filter available credits in memory
        // ──────────────────────────────────────────────────────────────
        const { data: wallets, error: walletError } = await supabase
            .from('user_wallets')
            .select('id, creditos_total, creditos_usados, package_id, expires_at')
            .eq('user_id', userId)
            .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
            .order('expires_at', { ascending: true, nullsFirst: false });

        if (walletError) {
            console.error('❌ [Renew] Error fetching wallets:', walletError.message);
            return { success: false, error: 'Error al buscar billetera' };
        }

        // Find the first wallet that has credits available
        const wallet = wallets?.find(w => w.creditos_total === -1 || w.creditos_total > w.creditos_usados);

        // ──────────────────────────────────────────────────────────────
        // Step 2 — No credits → redirect to generic plans page
        // ──────────────────────────────────────────────────────────────
        if (!wallet) {
            console.log('ℹ️ [Renew] No available wallet for user:', userId, '| Redirecting to generic plans');
            return { success: false, redirect: '/mis-inmuebles/planes' };
        }

        // ──────────────────────────────────────────────────────────────
        // Step 3 — Deduct 1 credit (atomic guard)
        // For unlimited plans (creditos_total = -1), skip decrement
        // ──────────────────────────────────────────────────────────────
        if (wallet.creditos_total !== -1) {
            const { data: decrementResult, error: decrementError } = await supabase
                .from('user_wallets')
                .update({
                    creditos_usados: wallet.creditos_usados + 1,
                    updated_at: new Date().toISOString()
                })
                .eq('id', wallet.id)
                .gt('creditos_total', wallet.creditos_usados) // atomic guard: creditos_total > creditos_usados
                .select('id');

            if (decrementError || !decrementResult || decrementResult.length === 0) {
                console.log('⚠️ [Renew] Credit decrement race lost or exhausted:', wallet.id);
                return { success: false, redirect: '/mis-inmuebles/planes' };
            }

            console.log('✅ [Renew] Credit deducted from wallet:', wallet.id,
                `| Used: ${wallet.creditos_usados + 1}/${wallet.creditos_total}`);
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
        const now = new Date();
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
                    fecha_expiracion: newExpiration.toISOString(),
                    updated_at: now.toISOString()
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
                fecha_expiracion: newExpiration.toISOString(),
                updated_at: now.toISOString()
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
