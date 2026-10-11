-- Remove the legacy global uniqueness left by 0000_initial_schema.sql.
-- Act numbers are scoped by workflow, or by object for legacy REST flows,
-- through the partial unique indexes created in migration 0036.

ALTER TABLE "acts" DROP CONSTRAINT IF EXISTS "acts_act_number_key";
DROP INDEX IF EXISTS "acts_act_number_key";
