-- Migration 0018: Multi-provider authentication
-- Description: Add users and auth_providers tables, migrate existing telegram users
-- Date: 2026-03-01
-- Impact: Adds new auth system, preserves backward compatibility

BEGIN;

-- ============================
-- 1. Create users table
-- ============================
CREATE TABLE IF NOT EXISTS "users" (
  "id"            SERIAL PRIMARY KEY,
  "display_name"  TEXT NOT NULL,
  "email"         TEXT UNIQUE,
  "password_hash" TEXT,
  "role"          TEXT NOT NULL DEFAULT 'user',
  "is_blocked"    BOOLEAN NOT NULL DEFAULT false,
  "created_at"    TIMESTAMP DEFAULT now(),
  "last_login_at" TIMESTAMP,
  
  CONSTRAINT "users_role_check" CHECK (role IN ('user', 'admin'))
);

-- ============================
-- 2. Create auth_providers table
-- ============================
CREATE TABLE IF NOT EXISTS "auth_providers" (
  "id"          SERIAL PRIMARY KEY,
  "user_id"     INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider"    TEXT NOT NULL,
  "external_id" TEXT,
  "metadata"    JSONB,
  "created_at"  TIMESTAMP DEFAULT now(),
  
  CONSTRAINT "auth_providers_provider_check" CHECK (provider IN ('telegram', 'email', 'phone')),
  CONSTRAINT "auth_providers_provider_external_id_uq" UNIQUE (provider, external_id)
);

-- ============================
-- 3. Add new columns to objects and messages
-- ============================
ALTER TABLE "objects" ADD COLUMN IF NOT EXISTS "user_id" INTEGER REFERENCES "users"("id");

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "internal_user_id" INTEGER REFERENCES "users"("id");

-- ============================
-- 4. Migrate existing telegram users
-- ============================
DO $$
DECLARE
  rec RECORD;
  new_user_id INTEGER;
  users_created INTEGER := 0;
  objects_updated INTEGER := 0;
  rows_affected INTEGER;
BEGIN
  -- Migrate from objects.telegram_user_id (BIGINT)
  FOR rec IN 
    SELECT DISTINCT telegram_user_id 
    FROM objects 
    WHERE telegram_user_id IS NOT NULL
    ORDER BY telegram_user_id
  LOOP
    -- Check if user already exists for this telegram ID
    SELECT u.id INTO new_user_id
    FROM users u
    JOIN auth_providers ap ON ap.user_id = u.id
    WHERE ap.provider = 'telegram' 
      AND ap.external_id = rec.telegram_user_id::TEXT;
    
    IF new_user_id IS NULL THEN
      -- Create new user
      INSERT INTO users (display_name, role, is_blocked, created_at)
      VALUES (
        'Telegram User ' || rec.telegram_user_id,
        'user',
        false,
        (SELECT MIN(created_at) FROM objects WHERE telegram_user_id = rec.telegram_user_id)
      )
      RETURNING id INTO new_user_id;
      
      -- Create auth provider
      INSERT INTO auth_providers (user_id, provider, external_id, created_at)
      VALUES (
        new_user_id,
        'telegram',
        rec.telegram_user_id::TEXT,
        (SELECT MIN(created_at) FROM objects WHERE telegram_user_id = rec.telegram_user_id)
      );
      
      users_created := users_created + 1;
    END IF;
    
    -- Update all objects for this telegram user
    UPDATE objects
    SET user_id = new_user_id
    WHERE telegram_user_id = rec.telegram_user_id
      AND user_id IS NULL;
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    objects_updated := objects_updated + rows_affected;
  END LOOP;
  
  RAISE NOTICE 'Created % users from objects.telegram_user_id, updated % objects', 
    users_created, objects_updated;
END $$;

-- ============================
-- 5. Promote admin users
-- ============================
DO $$
DECLARE
  rec RECORD;
  target_user_id INTEGER;
  admins_promoted INTEGER := 0;
  admins_created INTEGER := 0;
BEGIN
  FOR rec IN SELECT telegram_user_id, note, created_at FROM admin_users
  LOOP
    -- Find existing user by telegram ID
    SELECT u.id INTO target_user_id
    FROM users u
    JOIN auth_providers ap ON ap.user_id = u.id
    WHERE ap.provider = 'telegram' 
      AND ap.external_id = rec.telegram_user_id;
    
    IF target_user_id IS NOT NULL THEN
      -- User exists, promote to admin
      UPDATE users
      SET role = 'admin'
      WHERE id = target_user_id;
      
      admins_promoted := admins_promoted + 1;
    ELSE
      -- User doesn't exist, create as admin
      INSERT INTO users (display_name, role, is_blocked, created_at)
      VALUES (
        'Admin ' || rec.telegram_user_id,
        'admin',
        false,
        rec.created_at
      )
      RETURNING id INTO target_user_id;
      
      -- Create auth provider
      INSERT INTO auth_providers (user_id, provider, external_id, metadata, created_at)
      VALUES (
        target_user_id,
        'telegram',
        rec.telegram_user_id,
        jsonb_build_object('note', rec.note),
        rec.created_at
      );
      
      admins_created := admins_created + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Promoted % existing users to admin, created % new admin users', 
    admins_promoted, admins_created;
END $$;

-- ============================
-- 6. Migrate messages.user_id (TEXT telegram ID) to internal_user_id
-- ============================
DO $$
DECLARE
  messages_updated INTEGER := 0;
BEGIN
  UPDATE messages m
  SET internal_user_id = (
    SELECT u.id
    FROM users u
    JOIN auth_providers ap ON ap.user_id = u.id
    WHERE ap.provider = 'telegram' 
      AND ap.external_id = m.user_id
  )
  WHERE internal_user_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM users u
      JOIN auth_providers ap ON ap.user_id = u.id
      WHERE ap.provider = 'telegram' 
        AND ap.external_id = m.user_id
    );
  
  GET DIAGNOSTICS messages_updated = ROW_COUNT;
  
  RAISE NOTICE 'Migrated % messages to internal_user_id', messages_updated;
END $$;

-- ============================
-- 7. Create indexes
-- ============================
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");

CREATE INDEX IF NOT EXISTS "auth_providers_user_id_idx" ON "auth_providers"("user_id");

CREATE INDEX IF NOT EXISTS "auth_providers_provider_external_id_idx" ON "auth_providers"("provider", "external_id");

CREATE INDEX IF NOT EXISTS "objects_user_id_idx" ON "objects"("user_id");

CREATE INDEX IF NOT EXISTS "messages_internal_user_id_idx" ON "messages"("internal_user_id");

COMMIT;
