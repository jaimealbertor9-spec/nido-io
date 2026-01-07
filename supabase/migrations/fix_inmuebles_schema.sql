-- ═══════════════════════════════════════════════════════════════════════════
-- NIDO IO - Database Schema Migration
-- Purpose: Synchronize inmuebles table for Paso 1 & Paso 2 wizard
-- Error Fix: "Could not find the 'estrato' column of 'inmuebles' in the schema cache"
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Fix the immediate error by adding the missing 'estrato' column
ALTER TABLE public.inmuebles 
ADD COLUMN IF NOT EXISTS estrato SMALLINT;

-- 2. Ensure all other required columns for 'Paso 1' exist
ALTER TABLE public.inmuebles 
ADD COLUMN IF NOT EXISTS direccion TEXT,
ADD COLUMN IF NOT EXISTS barrio TEXT,
ADD COLUMN IF NOT EXISTS habitaciones SMALLINT,
ADD COLUMN IF NOT EXISTS banos SMALLINT,
ADD COLUMN IF NOT EXISTS area_m2 NUMERIC,
ADD COLUMN IF NOT EXISTS servicios TEXT[],   -- Stores 'Servicios Públicos'
ADD COLUMN IF NOT EXISTS amenidades TEXT[],  -- Stores amenities/features
ADD COLUMN IF NOT EXISTS latitud NUMERIC,
ADD COLUMN IF NOT EXISTS longitud NUMERIC;

-- 3. Ensure columns for 'Paso 2' (Details & Contact) exist
ALTER TABLE public.inmuebles 
ADD COLUMN IF NOT EXISTS titulo TEXT,
ADD COLUMN IF NOT EXISTS descripcion TEXT,
ADD COLUMN IF NOT EXISTS precio NUMERIC,
ADD COLUMN IF NOT EXISTS tipo_oferta TEXT,   -- 'venta' OR 'arriendo'
ADD COLUMN IF NOT EXISTS telefono TEXT,
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'borrador';

-- 4. Ensure the Images table exists with the correct relationship
CREATE TABLE IF NOT EXISTS public.property_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    property_id UUID REFERENCES public.inmuebles(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    etiqueta TEXT -- e.g., 'fachada', 'piscina', 'interior'
);

-- 5. Refresh Schema Cache (IMPORTANT!)
-- ═══════════════════════════════════════════════════════════════════════════
-- After running this SQL, navigate to:
--   Supabase Dashboard > Project Settings > API > "Reload Schema Cache"
-- This ensures the API recognizes the new columns immediately.
-- ═══════════════════════════════════════════════════════════════════════════
