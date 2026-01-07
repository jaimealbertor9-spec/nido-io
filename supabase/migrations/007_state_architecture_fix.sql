-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 007: State Architecture Fix (CORRECTED)
-- Usa columna 'estado' existente en ambas tablas
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 1: USER_VERIFICATIONS - Limpiar y validar estados
-- Columna: estado (TEXT)
-- Valores permitidos: pendiente, aprobado, rechazado
-- ═══════════════════════════════════════════════════════════════════════════

-- 1.1 Asegurar que la columna existe
ALTER TABLE user_verifications 
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente';

-- 1.2 Actualizar NULLs a pendiente
UPDATE user_verifications 
SET estado = 'pendiente' 
WHERE estado IS NULL;

-- 1.3 Eliminar constraint existente si existe
ALTER TABLE user_verifications 
DROP CONSTRAINT IF EXISTS check_user_verifications_estado;

-- 1.4 Agregar constraint para valores permitidos
ALTER TABLE user_verifications 
ADD CONSTRAINT check_user_verifications_estado 
CHECK (estado IN ('pendiente', 'aprobado', 'rechazado'));

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 2: INMUEBLES - Limpiar y validar estados
-- Columna: estado (TEXT)
-- Valores permitidos: borrador, en_revision, publicado, rechazado, vendido
-- IMPORTANTE: 'pendiente' ya NO es válido para propiedades
-- ═══════════════════════════════════════════════════════════════════════════

-- 2.1 Asegurar que la columna existe con default correcto
ALTER TABLE inmuebles 
ALTER COLUMN estado SET DEFAULT 'borrador';

-- 2.2 Actualizar NULLs a borrador
UPDATE inmuebles 
SET estado = 'borrador' 
WHERE estado IS NULL;

-- 2.3 MIGRACIÓN: Convertir 'pendiente' → 'en_revision'
UPDATE inmuebles 
SET estado = 'en_revision' 
WHERE estado = 'pendiente';

-- 2.4 Eliminar constraint existente si existe
ALTER TABLE inmuebles 
DROP CONSTRAINT IF EXISTS check_inmuebles_estado;

ALTER TABLE inmuebles 
DROP CONSTRAINT IF EXISTS check_inmueble_estado_values;

-- 2.5 Agregar constraint para valores permitidos
ALTER TABLE inmuebles 
ADD CONSTRAINT check_inmuebles_estado 
CHECK (estado IN ('borrador', 'en_revision', 'publicado', 'rechazado', 'vendido'));

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 3: HELPER FUNCTION - Verificar si usuario está aprobado
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION is_user_identity_approved(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_verifications 
        WHERE user_id = p_user_id 
        AND estado = 'aprobado'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN: Ejecutar después de la migración
-- ═══════════════════════════════════════════════════════════════════════════
/*
-- Ver estados actuales:
SELECT DISTINCT estado FROM user_verifications;
SELECT DISTINCT estado FROM inmuebles;

-- Verificar constraints:
SELECT conname FROM pg_constraint WHERE conname LIKE '%estado%';
*/
