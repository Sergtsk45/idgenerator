-- Migration: 0014_admin_panel
-- Add admin_users table and is_blocked flag on objects for admin panel functionality

-- Admin users registry
CREATE TABLE IF NOT EXISTS admin_users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  telegram_user_id text NOT NULL UNIQUE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_users_telegram_user_id_idx ON admin_users(telegram_user_id);

-- Block flag for users (stored on objects level since object IS the user context)
ALTER TABLE objects ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;
