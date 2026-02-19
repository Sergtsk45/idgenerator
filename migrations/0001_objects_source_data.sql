-- @file: 0001_objects_source_data.sql
-- @description: Create objects + source data tables and link acts to objects (MVP default object)
-- @created: 2026-01-27

-- NOTE: Единственный способ изменения БД — SQL-миграции (этот файл).
-- drizzle-kit используется только для генерации миграций (`drizzle-kit generate`).
-- `drizzle-kit push` в проекте не применяется.

CREATE TABLE IF NOT EXISTS "objects" (
  "id" SERIAL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "address" TEXT,
  "city" TEXT,
  "created_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "object_parties" (
  "id" SERIAL PRIMARY KEY,
  "object_id" INTEGER NOT NULL REFERENCES "objects"("id"),
  "role" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "short_name" TEXT,
  "inn" TEXT,
  "kpp" TEXT,
  "ogrn" TEXT,
  "address_legal" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "object_parties_object_role_uq"
  ON "object_parties" ("object_id", "role");

CREATE TABLE IF NOT EXISTS "object_responsible_persons" (
  "id" SERIAL PRIMARY KEY,
  "object_id" INTEGER NOT NULL REFERENCES "objects"("id"),
  "role" TEXT NOT NULL,
  "person_name" TEXT NOT NULL,
  "position" TEXT,
  "basis_text" TEXT,
  "line_text" TEXT,
  "sign_text" TEXT,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "object_responsible_persons_object_role_uq"
  ON "object_responsible_persons" ("object_id", "role");

ALTER TABLE "acts"
  ADD COLUMN IF NOT EXISTS "object_id" INTEGER REFERENCES "objects"("id");

-- Seed default object for MVP
INSERT INTO "objects" ("id", "title", "address", "city")
VALUES (1, 'Объект по умолчанию', NULL, NULL)
ON CONFLICT ("id") DO NOTHING;

-- Backfill existing acts
UPDATE "acts"
SET "object_id" = 1
WHERE "object_id" IS NULL;

