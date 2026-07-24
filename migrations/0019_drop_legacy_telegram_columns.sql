-- Migration 0019: Drop legacy Telegram columns
-- Description: Remove admin_users table and telegram_user_id columns
-- Date: 2026-03-01
-- Impact: Completes multi-provider auth migration

BEGIN;

-- ============================
-- 1. Drop admin_users table (replaced by users.role)
-- ============================
DROP TABLE IF EXISTS "admin_users";

-- ============================
-- 2. Drop telegram_user_id from objects (replaced by user_id)
-- ============================
ALTER TABLE "objects" DROP COLUMN IF EXISTS "telegram_user_id";

-- ============================
-- 3. Make user_id NOT NULL in objects (now required)
-- ============================
-- Clean migration chain can still contain seed object(s) created before the
-- users table existed. Assign them to one explicit legacy owner instead of a
-- random real user, then enforce NOT NULL.
DO $$
DECLARE
  legacy_user_id INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM objects WHERE user_id IS NULL) THEN
    SELECT u.id INTO legacy_user_id
    FROM users u
    WHERE u.email = 'legacy-system-owner@local.invalid'
    LIMIT 1;

    IF legacy_user_id IS NULL THEN
      INSERT INTO users (display_name, email, role, is_blocked, created_at)
      VALUES ('Legacy System Owner', 'legacy-system-owner@local.invalid', 'admin', true, now())
      RETURNING id INTO legacy_user_id;
    END IF;

    UPDATE objects
    SET user_id = legacy_user_id
    WHERE user_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM objects WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot make user_id NOT NULL: found % rows with NULL user_id', 
      (SELECT COUNT(*) FROM objects WHERE user_id IS NULL);
  END IF;
END $$;

ALTER TABLE "objects" ALTER COLUMN "user_id" SET NOT NULL;

-- ============================
-- 4. Rename internal_user_id to user_id in messages
-- ============================
-- Note: The old user_id (TEXT, telegram ID) is legacy and will be dropped
-- First check if the rename was already done
DO $$
BEGIN
  -- Check if internal_user_id exists and user_id is TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'internal_user_id'
  ) THEN
    -- Drop the old user_id column (TEXT telegram ID)
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "user_id";
    
    -- Rename internal_user_id to user_id
    ALTER TABLE "messages" RENAME COLUMN "internal_user_id" TO "user_id";
    
    RAISE NOTICE 'Renamed messages.internal_user_id to user_id and dropped old user_id column';
  ELSE
    RAISE NOTICE 'Column messages.internal_user_id not found - rename already done or not needed';
  END IF;
END $$;

COMMIT;
