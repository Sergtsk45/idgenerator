-- Migration: Add tariff system to users table
-- Created: 2026-03-06

-- Add tariff field (basic by default)
ALTER TABLE users ADD COLUMN tariff TEXT NOT NULL DEFAULT 'basic';

-- Add subscription end date (nullable)
ALTER TABLE users ADD COLUMN subscription_ends_at TIMESTAMP;

-- Add trial used flag (false by default)
ALTER TABLE users ADD COLUMN trial_used BOOLEAN NOT NULL DEFAULT false;

-- Add check constraint for tariff values
ALTER TABLE users ADD CONSTRAINT users_tariff_check
  CHECK (tariff IN ('basic', 'standard', 'premium'));
