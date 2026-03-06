-- Migration: 0022_invoice_parse_corrections
-- Description: Creates table for storing user corrections of invoice parse results (name, unit, qty).
-- Dependencies: objects, users tables must exist.
-- Created: 2026-03-06

CREATE TABLE IF NOT EXISTS invoice_parse_corrections (
  id SERIAL PRIMARY KEY,
  object_id INTEGER NOT NULL REFERENCES objects(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  field_name TEXT NOT NULL,
  original_value TEXT NOT NULL,
  corrected_value TEXT NOT NULL,
  item_index INTEGER NOT NULL,
  invoice_number TEXT,
  supplier_name TEXT,
  pdf_filename TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT ipc_field_name_check
    CHECK (field_name IN ('name', 'unit', 'qty'))
);

CREATE INDEX ipc_object_id_idx ON invoice_parse_corrections(object_id);
CREATE INDEX ipc_user_id_idx ON invoice_parse_corrections(user_id);
CREATE INDEX ipc_field_name_idx ON invoice_parse_corrections(field_name);
CREATE INDEX ipc_created_at_idx ON invoice_parse_corrections(created_at);
