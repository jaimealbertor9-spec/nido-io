-- ============================================
-- MIGRACIÓN 005: Sistema de Notificaciones Programadas
-- Para emails de verificación (20min, 24hrs antes deadline)
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- ═══════════════════════════════════════════════════════════════
-- 1. CREAR TABLA scheduled_notifications
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Usuario destino
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    
    -- Tipo de notificación
    notification_type VARCHAR(50) NOT NULL,
    -- Tipos: 'verification_reminder_20min', 'verification_reminder_24hrs', 'verification_expired'
    
    -- Cuándo enviar
    scheduled_for TIMESTAMPTZ NOT NULL,
    
    -- Estado de la notificación
    sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMPTZ,
    
    -- Referencia opcional (ej: verification_id, inmueble_id)
    reference_id UUID,
    reference_type VARCHAR(50),
    
    -- Metadata adicional (JSON para flexibilidad)
    metadata JSONB DEFAULT '{}',
    
    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 2. ÍNDICES PARA EL CRON JOB
-- ═══════════════════════════════════════════════════════════════

-- Buscar notificaciones pendientes de envío
CREATE INDEX IF NOT EXISTS idx_notifications_pending 
ON scheduled_notifications(scheduled_for)
WHERE sent = FALSE;

-- Buscar por usuario
CREATE INDEX IF NOT EXISTS idx_notifications_user 
ON scheduled_notifications(user_id);

-- Buscar por tipo y referencia
CREATE INDEX IF NOT EXISTS idx_notifications_reference 
ON scheduled_notifications(reference_id, reference_type);

-- ═══════════════════════════════════════════════════════════════
-- 3. FUNCIÓN: Programar notificaciones de verificación
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION schedule_verification_notifications(
    p_user_id UUID,
    p_verification_id UUID,
    p_user_email TEXT
)
RETURNS VOID AS $$
BEGIN
    -- Notificación 1: 20 minutos después del pago
    INSERT INTO scheduled_notifications (
        user_id, 
        notification_type, 
        scheduled_for, 
        reference_id, 
        reference_type,
        metadata
    ) VALUES (
        p_user_id,
        'verification_reminder_20min',
        NOW() + INTERVAL '20 minutes',
        p_verification_id,
        'user_verification',
        jsonb_build_object('email', p_user_email, 'subject', 'Completa tu verificación en Nido')
    );
    
    -- Notificación 2: 24 horas antes del deadline (48hrs después del pago)
    INSERT INTO scheduled_notifications (
        user_id, 
        notification_type, 
        scheduled_for, 
        reference_id, 
        reference_type,
        metadata
    ) VALUES (
        p_user_id,
        'verification_reminder_24hrs',
        NOW() + INTERVAL '48 hours', -- 72hrs - 24hrs = 48hrs desde ahora
        p_verification_id,
        'user_verification',
        jsonb_build_object('email', p_user_email, 'subject', '⚠️ Última oportunidad: verifica tu identidad', 'urgent', true)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- 4. FUNCIÓN: Obtener notificaciones pendientes
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_pending_notifications(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    notification_type VARCHAR(50),
    metadata JSONB,
    scheduled_for TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.user_id,
        n.notification_type,
        n.metadata,
        n.scheduled_for
    FROM scheduled_notifications n
    WHERE n.sent = FALSE
    AND n.scheduled_for <= NOW()
    AND n.retry_count < 3
    ORDER BY n.scheduled_for ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- 5. FUNCIÓN: Marcar notificación como enviada
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION mark_notification_sent(p_notification_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE scheduled_notifications
    SET sent = TRUE, sent_at = NOW(), updated_at = NOW()
    WHERE id = p_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- 6. RLS POLICIES
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Solo admins y service role pueden ver/modificar notificaciones
CREATE POLICY "Service role full access to notifications"
ON scheduled_notifications
FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view notifications"
ON scheduled_notifications FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM usuarios 
        WHERE id = auth.uid() 
        AND rol = 'admin'
    )
);
