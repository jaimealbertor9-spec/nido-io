-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 011: User Wallets, Subscriptions & Listing Credits
-- Monetization Phase 2: Credit tracking, subscription lifecycle, audit trail
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. USER_WALLETS — Credit balance per purchase
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_wallets (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    package_id      UUID NOT NULL REFERENCES public.packages(id),
    creditos_total  INTEGER NOT NULL DEFAULT 0,
    creditos_usados INTEGER NOT NULL DEFAULT 0,
    pago_id         UUID REFERENCES public.pagos(id),
    created_at      TIMESTAMPTZ DEFAULT now(),
    expires_at      TIMESTAMPTZ,

    CONSTRAINT check_creditos CHECK (creditos_usados <= creditos_total OR creditos_total < 0)
);

CREATE INDEX idx_user_wallets_user ON user_wallets(user_id);

-- RLS
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallets"
ON public.user_wallets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to wallets"
ON public.user_wallets FOR ALL
USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 2. USER_SUBSCRIPTIONS — Unlimited Monthly plan lifecycle
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    package_id      UUID NOT NULL REFERENCES public.packages(id),
    estado          TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'cancelada', 'vencida')),
    fecha_inicio    TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_fin       TIMESTAMPTZ NOT NULL,
    auto_renewal    BOOLEAN DEFAULT true,
    pago_id         UUID REFERENCES public.pagos(id),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_estado ON user_subscriptions(estado, fecha_fin);

-- RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
ON public.user_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to subscriptions"
ON public.user_subscriptions FOR ALL
USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 3. LISTING_CREDITS — Audit trail: which credit funded which listing
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.listing_credits (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    inmueble_id         UUID NOT NULL REFERENCES public.inmuebles(id) ON DELETE CASCADE,
    wallet_id           UUID REFERENCES public.user_wallets(id),
    subscription_id     UUID REFERENCES public.user_subscriptions(id),
    features_snapshot   JSONB NOT NULL DEFAULT '{}',
    fecha_publicacion   TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_expiracion    TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT check_funding CHECK (wallet_id IS NOT NULL OR subscription_id IS NOT NULL)
);

CREATE UNIQUE INDEX idx_listing_credits_inmueble ON listing_credits(inmueble_id);

-- RLS
ALTER TABLE public.listing_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own listing credits"
ON public.listing_credits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to listing_credits"
ON public.listing_credits FOR ALL
USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Add fecha_expiracion to inmuebles if missing
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.inmuebles
ADD COLUMN IF NOT EXISTS fecha_expiracion TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICATION
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN ('user_wallets', 'user_subscriptions', 'listing_credits');
