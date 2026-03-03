-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 014: Subscription Renewal Alerts
-- Monetization Phase 5: Auto-schedule 3-day renewal reminders via
-- existing scheduled_notifications infrastructure (migration 005)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. TRIGGER FUNCTION: Schedule renewal alert on subscription creation
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION schedule_subscription_renewal_alert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO scheduled_notifications (
        user_id,
        notification_type,
        scheduled_for,
        reference_id,
        reference_type,
        metadata
    ) VALUES (
        NEW.user_id,
        'subscription_renewal_3day',
        NEW.fecha_fin - INTERVAL '3 days',
        NEW.id,
        'user_subscription',
        jsonb_build_object(
            'subscription_id', NEW.id,
            'fecha_fin', NEW.fecha_fin,
            'package_id', NEW.package_id
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. ATTACH TRIGGER to user_subscriptions
-- ─────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_subscription_renewal_alert ON user_subscriptions;

CREATE TRIGGER trg_subscription_renewal_alert
AFTER INSERT ON user_subscriptions
FOR EACH ROW EXECUTE FUNCTION schedule_subscription_renewal_alert();

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICATION
-- ─────────────────────────────────────────────────────────────────────────
-- After inserting a subscription with fecha_fin = NOW() + 30 days:
-- SELECT notification_type, scheduled_for, metadata
-- FROM scheduled_notifications
-- WHERE notification_type = 'subscription_renewal_3day'
-- ORDER BY created_at DESC LIMIT 1;
-- Expected: scheduled_for ≈ fecha_fin - 3 days
