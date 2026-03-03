-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 012: Property Analytics
-- Monetization Phase 3: Engagement metrics per listing + atomic increment RPC
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. CREATE TABLE
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.property_analytics (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inmueble_id         UUID NOT NULL REFERENCES public.inmuebles(id) ON DELETE CASCADE,
    views               INTEGER NOT NULL DEFAULT 0,
    unique_views        INTEGER NOT NULL DEFAULT 0,
    whatsapp_clicks     INTEGER NOT NULL DEFAULT 0,
    phone_clicks        INTEGER NOT NULL DEFAULT 0,
    message_clicks      INTEGER NOT NULL DEFAULT 0,
    saves               INTEGER NOT NULL DEFAULT 0,
    shares              INTEGER NOT NULL DEFAULT 0,
    avg_view_seconds    NUMERIC DEFAULT 0,
    last_viewed_at      TIMESTAMPTZ,
    ai_cache            JSONB,                      -- Cached LLM insights (24h TTL)
    ai_cache_updated_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_property_analytics_inmueble ON property_analytics(inmueble_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. ATOMIC INCREMENT RPC
-- Called from frontend/edge functions to track engagement safely
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_property_stat(
    p_inmueble_id UUID,
    p_stat TEXT
)
RETURNS VOID AS $$
BEGIN
    -- Validate stat name to prevent SQL injection
    IF p_stat NOT IN ('views', 'unique_views', 'whatsapp_clicks', 'phone_clicks', 'message_clicks', 'saves', 'shares') THEN
        RAISE EXCEPTION 'Invalid stat name: %', p_stat;
    END IF;

    -- Upsert: create row if missing, then increment
    INSERT INTO property_analytics (inmueble_id)
    VALUES (p_inmueble_id)
    ON CONFLICT (inmueble_id) DO NOTHING;

    EXECUTE format(
        'UPDATE property_analytics SET %I = %I + 1, updated_at = now(), last_viewed_at = CASE WHEN %L = ''views'' THEN now() ELSE last_viewed_at END WHERE inmueble_id = $1',
        p_stat, p_stat, p_stat
    ) USING p_inmueble_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RLS — Owners can read their stats, writes via RPC only
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.property_analytics ENABLE ROW LEVEL SECURITY;

-- Property owners can read their own analytics
CREATE POLICY "Owners can view own property analytics"
ON public.property_analytics FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM inmuebles
        WHERE inmuebles.id = property_analytics.inmueble_id
        AND inmuebles.propietario_id = auth.uid()
    )
);

-- Service role full access (for RPCs and admin)
CREATE POLICY "Service role full access to analytics"
ON public.property_analytics FOR ALL
USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICATION
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT * FROM property_analytics LIMIT 5;
-- SELECT increment_property_stat('some-uuid', 'views');
