-- ═══════════════════════════════════════════════════════════════════════════
-- NIDO IO - Migration 009: Add es_propietario column
-- Purpose: Persist the "Soy el propietario" checkbox state
-- Default TRUE for backward compatibility with existing rows
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.inmuebles
  ADD COLUMN IF NOT EXISTS es_propietario BOOLEAN DEFAULT TRUE;
