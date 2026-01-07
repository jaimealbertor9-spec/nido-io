-- ============================================
-- MIGRACIÓN 004: Sistema de Verificación de Usuarios
-- Identity & Publication Lifecycle
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- ═══════════════════════════════════════════════════════════════
-- 1. CREAR ENUM PARA ESTADOS DE VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
        CREATE TYPE verification_status AS ENUM (
            'PENDING_UPLOAD',   -- Esperando subir documentos (deadline 72hrs)
            'UNDER_REVIEW',     -- Documentos subidos, esperando aprobación admin
            'VERIFIED',         -- Usuario verificado por admin
            'REJECTED_KYC'      -- Rechazado o deadline vencido
        );
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 2. AGREGAR NUEVOS ESTADOS A ENUM DE INMUEBLES
-- ═══════════════════════════════════════════════════════════════
-- Nota: PostgreSQL no permite IF NOT EXISTS para ADD VALUE
-- Usamos DO block con exception handling

DO $$ 
BEGIN
    ALTER TYPE inmueble_estado ADD VALUE IF NOT EXISTS 'en_revision';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TYPE inmueble_estado ADD VALUE IF NOT EXISTS 'rechazado';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 3. CREAR TABLA user_verifications
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relación con usuario
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    
    -- Estado del proceso de verificación
    status verification_status NOT NULL DEFAULT 'PENDING_UPLOAD',
    
    -- Documento de identidad (URL del bucket privado)
    document_url TEXT,
    document_type VARCHAR(50), -- 'cedula_frontal', 'cedula_posterior', 'pasaporte'
    
    -- Deadline de las 72 horas para subir documentos
    deadline_at TIMESTAMPTZ,
    
    -- Timestamps de estados
    document_uploaded_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    
    -- Motivo de rechazo (si aplica)
    rejected_reason TEXT,
    
    -- Admin que procesó la verificación
    reviewed_by UUID REFERENCES usuarios(id),
    
    -- Metadata para trazabilidad
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Restricción: un registro por usuario
    CONSTRAINT unique_user_verification UNIQUE(user_id)
);

-- ═══════════════════════════════════════════════════════════════
-- 4. ÍNDICES PARA PERFORMANCE
-- ═══════════════════════════════════════════════════════════════

-- Buscar por estado (para cron job y admin panel)
CREATE INDEX IF NOT EXISTS idx_verifications_status 
ON user_verifications(status);

-- Buscar verificaciones expiradas (cron job)
CREATE INDEX IF NOT EXISTS idx_verifications_deadline 
ON user_verifications(deadline_at) 
WHERE status = 'PENDING_UPLOAD';

-- Buscar por usuario
CREATE INDEX IF NOT EXISTS idx_verifications_user 
ON user_verifications(user_id);

-- ═══════════════════════════════════════════════════════════════
-- 5. ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE user_verifications ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden ver SOLO su propia verificación
CREATE POLICY "Users can view own verification"
ON user_verifications FOR SELECT
USING (auth.uid() = user_id);

-- Usuarios pueden insertar su propia verificación
CREATE POLICY "Users can insert own verification"
ON user_verifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Usuarios pueden actualizar (subir documento) si es su registro
CREATE POLICY "Users can update own verification"
ON user_verifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins pueden ver todas las verificaciones
CREATE POLICY "Admins can view all verifications"
ON user_verifications FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM usuarios 
        WHERE id = auth.uid() 
        AND rol = 'admin'
    )
);

-- Admins pueden actualizar cualquier verificación (aprobar/rechazar)
CREATE POLICY "Admins can update any verification"
ON user_verifications FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM usuarios 
        WHERE id = auth.uid() 
        AND rol = 'admin'
    )
);

-- ═══════════════════════════════════════════════════════════════
-- 6. TRIGGER PARA auto-update updated_at
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_verification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_verification_updated_at ON user_verifications;
CREATE TRIGGER trigger_verification_updated_at
    BEFORE UPDATE ON user_verifications
    FOR EACH ROW
    EXECUTE FUNCTION update_verification_timestamp();

-- ═══════════════════════════════════════════════════════════════
-- 7. FUNCIÓN HELPER: Verificar si usuario está verificado
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION is_user_verified(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_verifications 
        WHERE user_id = p_user_id 
        AND status = 'VERIFIED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- 8. FUNCIÓN: Iniciar timer de verificación (72 horas)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION start_verification_timer(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO user_verifications (user_id, status, deadline_at)
    VALUES (
        p_user_id, 
        'PENDING_UPLOAD', 
        NOW() + INTERVAL '72 hours'
    )
    ON CONFLICT (user_id) DO UPDATE 
    SET 
        status = 'PENDING_UPLOAD',
        deadline_at = NOW() + INTERVAL '72 hours',
        updated_at = NOW()
    WHERE user_verifications.status != 'VERIFIED'  -- Don't reset if already verified
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- 9. STORAGE BUCKET PARA DOCUMENTOS KYC (Privado)
-- ═══════════════════════════════════════════════════════════════
-- NOTA: Ejecutar en la UI de Supabase Storage o via API:
-- Crear bucket 'kyc-documents' con opciones:
--   - Public: false
--   - File size limit: 10MB
--   - Allowed MIME types: image/jpeg, image/png, application/pdf

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN: Comprobar que todo se creó correctamente
-- ═══════════════════════════════════════════════════════════════
-- Ejecutar después de la migración:
/*
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_verifications';

SELECT enum_range(NULL::verification_status);
SELECT enum_range(NULL::inmueble_estado);
*/
