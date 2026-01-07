-- ============================================
-- MIGRACIÓN: Ajustes tabla PAGOS para Wompi
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Agregar nuevos campos a tabla pagos
ALTER TABLE pagos 
ADD COLUMN IF NOT EXISTS referencia_pedido VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS wompi_transaction_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS firma_integridad VARCHAR(255),
ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50);

-- 2. Actualizar constraint de referencia_pedido (si ya existe el campo)
-- Si hay datos existentes sin referencia, generarla
UPDATE pagos 
SET referencia_pedido = 'NIDO-' || SUBSTRING(id::text, 1, 8) || '-' || EXTRACT(EPOCH FROM created_at)::bigint
WHERE referencia_pedido IS NULL;

-- 3. Hacer el campo NOT NULL después de poblar
ALTER TABLE pagos 
ALTER COLUMN referencia_pedido SET NOT NULL;

-- 4. Índice para búsqueda ultrarrápida del Webhook
CREATE UNIQUE INDEX IF NOT EXISTS idx_pagos_referencia_pedido 
ON pagos (referencia_pedido);

-- 5. Índice adicional por wompi_transaction_id
CREATE INDEX IF NOT EXISTS idx_pagos_wompi_tx_id 
ON pagos (wompi_transaction_id);

-- 6. Índice por estado para queries de dashboard
CREATE INDEX IF NOT EXISTS idx_pagos_estado 
ON pagos (estado);

-- ============================================
-- VERIFICACIÓN
-- ============================================
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'pagos';
