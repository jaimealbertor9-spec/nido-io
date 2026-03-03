-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 013: Property Leads (Read-Only Inbox)
-- Monetization Phase 4: Buyer contact form → masked lead inbox for sellers
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. CREATE TABLE
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.property_leads (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inmueble_id     UUID NOT NULL REFERENCES public.inmuebles(id) ON DELETE CASCADE,
    propietario_id  UUID NOT NULL,                  -- Denormalized for fast queries

    -- Lead info (from buyer contact form)
    nombre          TEXT NOT NULL,
    telefono        TEXT NOT NULL,
    email           TEXT,
    mensaje         TEXT,

    -- Masked phone: auto-computed (e.g., '315-XXX-XX42')
    telefono_masked TEXT GENERATED ALWAYS AS (
        CASE
            WHEN LENGTH(telefono) >= 5 THEN
                SUBSTRING(telefono FROM 1 FOR 3)
                || '-XXX-XX'
                || SUBSTRING(telefono FROM LENGTH(telefono) - 1 FOR 2)
            ELSE '***'
        END
    ) STORED,

    -- Status
    leido           BOOLEAN DEFAULT false,
    desbloqueado    BOOLEAN DEFAULT false,

    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ─────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_property_leads_propietario ON property_leads(propietario_id, created_at DESC);
CREATE INDEX idx_property_leads_inmueble ON property_leads(inmueble_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RLS
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.property_leads ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a lead (public contact form — no auth required)
CREATE POLICY "Anyone can submit a lead"
ON public.property_leads FOR INSERT
WITH CHECK (true);

-- Owners can view their own leads only
CREATE POLICY "Owners can view their leads"
ON public.property_leads FOR SELECT
USING (propietario_id = auth.uid());

-- Owners can mark leads as read
CREATE POLICY "Owners can update their leads"
ON public.property_leads FOR UPDATE
USING (propietario_id = auth.uid())
WITH CHECK (propietario_id = auth.uid());

-- Service role full access
CREATE POLICY "Service role full access to leads"
ON public.property_leads FOR ALL
USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICATION
-- ─────────────────────────────────────────────────────────────────────────
-- INSERT INTO property_leads (inmueble_id, propietario_id, nombre, telefono, mensaje)
-- VALUES ('test-uuid', 'test-uuid', 'Juan Martínez', '3154567842', 'Me interesa este inmueble');
-- SELECT nombre, telefono_masked, telefono FROM property_leads;
-- Expected: telefono_masked = '315-XXX-XX42'
