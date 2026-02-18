-- ═══════════════════════════════════════════════════════════════════════════
-- NIDO IO - Migration: Dynamic Photo Categories
-- Purpose: Replace static category constraint with regex to support
--          dynamic tags: habitacion_1..N, bano_1..N, extra_1..N
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Migrate legacy tags to new format
UPDATE public.inmueble_imagenes SET category = 'bano_1' WHERE category = 'bano';
UPDATE public.inmueble_imagenes SET category = 'habitacion_1' WHERE category = 'habitacion';

-- Step 2: Drop old static constraint
ALTER TABLE public.inmueble_imagenes
  DROP CONSTRAINT IF EXISTS tipos_de_fotos_validos;

-- Step 3: Add new regex-based constraint
ALTER TABLE public.inmueble_imagenes
  ADD CONSTRAINT tipos_de_fotos_validos CHECK (
    category ~ '^(fachada|cocina|sala|comedor|garaje|patio|otros|habitacion_[0-9]+|bano_[0-9]+|extra_[0-9]+)$'
  );
