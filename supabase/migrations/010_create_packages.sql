-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 010: Packages (Product Catalog)
-- Monetization Phase 1: Defines the 5 tiers (free, bronze, silver, gold, unlimited)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. CREATE TABLE
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.packages (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug                    TEXT UNIQUE NOT NULL,
    nombre                  TEXT NOT NULL,
    tipo                    TEXT NOT NULL CHECK (tipo IN ('gratuito', 'paquete', 'suscripcion')),
    precio_cop              INTEGER NOT NULL DEFAULT 0,
    creditos                INTEGER NOT NULL DEFAULT 0,  -- -1 = unlimited
    duracion_anuncio_dias   INTEGER NOT NULL DEFAULT 30,
    features                JSONB DEFAULT '{}',
    wompi_payment_link_url  TEXT,                         -- NULL for free tier
    activo                  BOOLEAN DEFAULT true,
    created_at              TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. SEED DATA
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO public.packages (slug, nombre, tipo, precio_cop, creditos, duracion_anuncio_dias, features, wompi_payment_link_url)
VALUES
    (
        'free',
        'Gratuito',
        'gratuito',
        0,
        1,
        30,
        '{"phone_visible": false, "analytics": false, "ai_insights": false}'::jsonb,
        NULL
    ),
    (
        'bronze',
        'Bronce',
        'paquete',
        10000,
        1,
        90,
        '{"phone_visible": true, "analytics": true, "ai_insights": false}'::jsonb,
        NULL  -- CEO will set the real Wompi Payment Link URL later
    ),
    (
        'silver',
        'Plata',
        'paquete',
        40000,
        5,
        90,
        '{"phone_visible": true, "analytics": true, "ai_insights": true}'::jsonb,
        NULL
    ),
    (
        'gold',
        'Oro',
        'paquete',
        80000,
        10,
        90,
        '{"phone_visible": true, "analytics": true, "ai_insights": true}'::jsonb,
        NULL
    ),
    (
        'unlimited',
        'Ilimitado Mensual',
        'suscripcion',
        120000,
        -1,
        90,
        '{"phone_visible": true, "analytics": true, "ai_insights": true}'::jsonb,
        NULL
    )
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RLS — Public read, service role write
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read packages"
ON public.packages FOR SELECT
USING (true);

CREATE POLICY "Service role full access to packages"
ON public.packages FOR ALL
USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICATION
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT slug, nombre, tipo, precio_cop, creditos, duracion_anuncio_dias FROM packages;
