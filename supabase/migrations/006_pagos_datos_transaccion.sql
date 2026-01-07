-- ============================================
-- MIGRACIÓN: Agregar columna datos_transaccion
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Agregar columna JSONB para datos de transacción
ALTER TABLE public.pagos 
ADD COLUMN IF NOT EXISTS datos_transaccion JSONB;

-- 2. Comentario descriptivo
COMMENT ON COLUMN public.pagos.datos_transaccion IS 'Datos adicionales de la transacción Wompi (user_id, email, timestamps, response)';

-- ============================================
-- VERIFICACIÓN
-- ============================================
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'pagos' AND column_name = 'datos_transaccion';
