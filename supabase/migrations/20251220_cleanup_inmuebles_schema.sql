-- ═══════════════════════════════════════════════════════════════
-- INMUEBLES TABLE SCHEMA CLEANUP
-- Date: 2025-12-20
-- Purpose: Clean up redundant columns and standardize schema
-- ═══════════════════════════════════════════════════════════════

-- STEP 1: Remove deprecated tipo_oferta column (replaced by tipo_negocio)
ALTER TABLE inmuebles DROP COLUMN IF EXISTS tipo_oferta;

-- STEP 2: Ensure titulo column exists (for ad title)
ALTER TABLE inmuebles ADD COLUMN IF NOT EXISTS titulo TEXT;

-- STEP 3: Ensure descripcion column exists (for main description)
ALTER TABLE inmuebles ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- STEP 4: Optional - Drop redundant description columns if they exist and are unused
-- CAUTION: Only run these if you've verified the columns are truly unused
ALTER TABLE inmuebles DROP COLUMN IF EXISTS descripcion_original;
ALTER TABLE inmuebles DROP COLUMN IF EXISTS descripcion_enriquecida;
ALTER TABLE inmuebles DROP COLUMN IF EXISTS desc_corta;
ALTER TABLE inmuebles DROP COLUMN IF EXISTS descripcion_larga;

-- STEP 5: Add comment to document the schema
COMMENT ON COLUMN inmuebles.titulo IS 'The display title for the property listing';
COMMENT ON COLUMN inmuebles.descripcion IS 'The detailed description of the property';
COMMENT ON COLUMN inmuebles.tipo_negocio IS 'Type of listing: venta, arriendo, or dias';

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION QUERY - Run this to check the current schema
-- ═══════════════════════════════════════════════════════════════
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'inmuebles' 
-- ORDER BY ordinal_position;
