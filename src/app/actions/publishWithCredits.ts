'use server';

import { getServiceRoleClient } from '@/lib/supabase-admin';

// ═══════════════════════════════════════════════════════════════════════════
// publishWithCredits — Consumes 1 credit (wallet or free tier) to publish
// No Wompi involved. Direct publish flow.
// ═══════════════════════════════════════════════════════════════════════════

interface PublishResult {
    success: boolean;
    error?: string;
}

export async function publishWithCredits(
    draftId: string,
    userId: string,
    walletId?: string,
    subscriptionId?: string
): Promise<PublishResult> {
    const supabase = getServiceRoleClient();

    try {
        // ─────────────────────────────────────────────────────────────────────
        // KYC GATE — Must have uploaded ID before consuming any credit
        // "Charge first, verify later": payment is free, publication is gated.
        // Returns 'KYC_REQUIRED' sentinel so the UI can show the upload banner.
        // ─────────────────────────────────────────────────────────────────────
        const { data: verifications } = await supabase
            .from('user_verifications')
            .select('documento_url')
            .eq('user_id', userId);

        const hasDocument = verifications?.some((v: any) => v.documento_url);
        if (!hasDocument) {
            return { success: false, error: 'KYC_REQUIRED' };
        }

        // ─────────────────────────────────────────────────────────────────────
        // 1. Validate the draft exists and belongs to the user
        // ─────────────────────────────────────────────────────────────────────
        const { data: inmueble, error: imError } = await supabase
            .from('inmuebles')
            .select('id, propietario_id, estado')
            .eq('id', draftId)
            .single();

        if (imError || !inmueble) {
            return { success: false, error: 'Inmueble no encontrado' };
        }

        if (inmueble.propietario_id !== userId) {
            return { success: false, error: 'No tienes permiso para publicar este inmueble' };
        }

        if (inmueble.estado === 'publicado' || inmueble.estado === 'en_revision') {
            return { success: false, error: 'Este inmueble ya está publicado o en revisión' };
        }

        let effectiveWalletId = walletId;
        let effectiveSubscriptionId = subscriptionId;
        let features: Record<string, boolean> = {};
        let duracionDias = 30;

        // Tracking variables for manual rollback
        let isConsumingWalletCredit = false;
        let originalCreditosUsados = 0;

        // ─────────────────────────────────────────────────────────────────────
        // 2A. If subscription path — validate active subscription
        // ─────────────────────────────────────────────────────────────────────
        if (effectiveSubscriptionId) {
            const { data: sub } = await supabase
                .from('user_subscriptions')
                .select('id, package_id, packages(features, duracion_anuncio_dias)')
                .eq('id', effectiveSubscriptionId)
                .eq('user_id', userId)
                .eq('estado', 'activa')
                .gt('fecha_fin', new Date().toISOString())
                .single();

            if (!sub) {
                return { success: false, error: 'Suscripción no válida o expirada' };
            }

            const pkg = sub.packages as any;
            features = pkg?.features || {};
            duracionDias = pkg?.duracion_anuncio_dias || 90;

            // ─────────────────────────────────────────────────────────────────────
            // 2B. If wallet path — validate and consume 1 credit
            // ─────────────────────────────────────────────────────────────────────
        } else if (effectiveWalletId) {
            const { data: wallet } = await supabase
                .from('user_wallets')
                .select('id, creditos_total, creditos_usados, package_id, packages(features, duracion_anuncio_dias, slug)')
                .eq('id', effectiveWalletId)
                .eq('user_id', userId)
                .single();

            if (!wallet) {
                return { success: false, error: 'Wallet no encontrado' };
            }

            if (wallet.creditos_usados >= wallet.creditos_total && wallet.creditos_total >= 0) {
                return { success: false, error: 'No tienes créditos disponibles' };
            }

            const pkg = wallet.packages as any;
            features = pkg?.features || {};
            duracionDias = pkg?.duracion_anuncio_dias || 30;

            // Increment creditos_usados
            isConsumingWalletCredit = true;
            originalCreditosUsados = wallet.creditos_usados;
            const { error: updateError } = await supabase
                .from('user_wallets')
                .update({ creditos_usados: wallet.creditos_usados + 1 })
                .eq('id', wallet.id);

            if (updateError) {
                return { success: false, error: 'Error al consumir crédito' };
            }

            // ─────────────────────────────────────────────────────────────────────
            // 2C. Free tier — auto-create wallet and consume
            // ─────────────────────────────────────────────────────────────────────
        } else {
            // Look up the free package
            const { data: freePkg } = await supabase
                .from('packages')
                .select('id, features, duracion_anuncio_dias')
                .eq('slug', 'free')
                .single();

            if (!freePkg) {
                return { success: false, error: 'Paquete gratuito no encontrado' };
            }

            features = (freePkg.features as Record<string, boolean>) || {};
            // EXPLICIT 15 DAYS FALLBACK FOR FREE TIER
            duracionDias = freePkg.duracion_anuncio_dias || 15;

            // Calculate expiration specifically for the wallet
            const now = new Date();
            const expirationWallet = new Date(now);
            expirationWallet.setDate(expirationWallet.getDate() + duracionDias);

            // Create wallet for free tier with 1 credit already consumed
            const { data: newWallet, error: walletErr } = await supabase
                .from('user_wallets')
                .insert({
                    user_id: userId,
                    package_id: freePkg.id,
                    creditos_total: 1,
                    creditos_usados: 1,
                    expires_at: expirationWallet.toISOString()
                })
                .select('id')
                .single();

            if (walletErr || !newWallet) {
                return { success: false, error: 'Error al crear wallet gratuito' };
            }

            effectiveWalletId = newWallet.id;
            isConsumingWalletCredit = true;
            originalCreditosUsados = 0;
        }

        // ─────────────────────────────────────────────────────────────────────
        // 3. Create listing_credits audit record
        // ─────────────────────────────────────────────────────────────────────
        const now = new Date();
        const expiration = new Date(now);
        expiration.setDate(expiration.getDate() + duracionDias);

        const { error: lcError } = await supabase
            .from('listing_credits')
            .insert({
                user_id: userId,
                inmueble_id: draftId,
                wallet_id: effectiveWalletId || null,
                subscription_id: effectiveSubscriptionId || null,
                features_snapshot: features,
                fecha_publicacion: now.toISOString(),
                fecha_expiracion: expiration.toISOString(),
            });

        if (lcError) {
            console.error('[publishWithCredits] listing_credits insert error:', lcError.message);
            // 🛡️ MANUAL ROLLBACK
            if (isConsumingWalletCredit && effectiveWalletId) {
                console.warn('[publishWithCredits] MANUAL ROLLBACK: Restoring wallet credit');
                await supabase.from('user_wallets').update({ creditos_usados: originalCreditosUsados }).eq('id', effectiveWalletId);
            }
            return { success: false, error: 'Error al registrar crédito de publicación' };
        }

        // ─────────────────────────────────────────────────────────────────────
        // 4. Update inmueble status → en_revision
        // ─────────────────────────────────────────────────────────────────────
        const { error: updateImError } = await supabase
            .from('inmuebles')
            .update({
                estado: 'en_revision',
                fecha_publicacion: now.toISOString(),
                fecha_expiracion: expiration.toISOString(),
                updated_at: now.toISOString(),
            })
            .eq('id', draftId);

        if (updateImError) {
            console.error('[publishWithCredits] inmueble update error:', updateImError.message);
            // 🛡️ MANUAL ROLLBACK
            if (isConsumingWalletCredit && effectiveWalletId) {
                console.warn('[publishWithCredits] MANUAL ROLLBACK: Restoring wallet credit');
                await supabase.from('user_wallets').update({ creditos_usados: originalCreditosUsados }).eq('id', effectiveWalletId);
            }
            await supabase.from('listing_credits').delete().eq('inmueble_id', draftId).eq('wallet_id', effectiveWalletId || null);
            return { success: false, error: 'Error al actualizar estado del inmueble' };
        }

        return { success: true };

    } catch (err: any) {
        console.error('[publishWithCredits] Unexpected error:', err.message);
        return { success: false, error: 'Error inesperado al publicar' };
    }
}
