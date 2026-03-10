-- 016_update_package_durations.sql
-- Executed 2026-03-09

-- STEP 1: Update package durations to match CEO rules
UPDATE packages SET duracion_anuncio_dias = 15 WHERE slug = 'free';
UPDATE packages SET duracion_anuncio_dias = 30 WHERE slug = 'bronze';
UPDATE packages SET duracion_anuncio_dias = 45 WHERE slug = 'silver';
UPDATE packages SET duracion_anuncio_dias = 60 WHERE slug = 'gold';
-- unlimited stays at 90

-- STEP 2: Deduplicate user_wallets (keep most recent per user_id+package_id)
DELETE FROM user_wallets w
WHERE w.id NOT IN (
  SELECT DISTINCT ON (user_id, package_id) id
  FROM user_wallets
  ORDER BY user_id, package_id, created_at DESC
);

-- STEP 3: Add UNIQUE constraint for Rollover UPSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_wallets_user_package'
  ) THEN
    ALTER TABLE user_wallets
      ADD CONSTRAINT uq_user_wallets_user_package UNIQUE (user_id, package_id);
  END IF;
END $$;
