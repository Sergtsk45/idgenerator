-- TASK-002 follow-up (code review): enforce append-only at the DB level, not just by
-- application convention. UPDATE/DELETE issued directly against execution_workflow_events
-- are rejected. Deleting a workflow still cascades and removes its events — that decision
-- is made explicit here rather than left as an accidental side-effect of the FK.
--
-- pg_trigger_depth() lets us tell the two cases apart: a direct
-- `DELETE FROM execution_workflow_events` runs at trigger depth 1 (this trigger itself);
-- a delete cascaded from `DELETE FROM execution_workflows` runs one level deeper (the
-- parent's FK cascade trigger is already on the stack), so depth is > 1 there.

CREATE OR REPLACE FUNCTION execution_workflow_events_block_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD; -- allow cascade delete triggered by removing the parent workflow
  END IF;

  RAISE EXCEPTION 'execution_workflow_events is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS execution_workflow_events_no_update ON execution_workflow_events;
CREATE TRIGGER execution_workflow_events_no_update
  BEFORE UPDATE ON execution_workflow_events
  FOR EACH ROW EXECUTE FUNCTION execution_workflow_events_block_mutation();

DROP TRIGGER IF EXISTS execution_workflow_events_no_delete ON execution_workflow_events;
CREATE TRIGGER execution_workflow_events_no_delete
  BEFORE DELETE ON execution_workflow_events
  FOR EACH ROW EXECUTE FUNCTION execution_workflow_events_block_mutation();

-- Rollback plan: DROP TRIGGER execution_workflow_events_no_update, execution_workflow_events_no_delete
-- ON execution_workflow_events; DROP FUNCTION execution_workflow_events_block_mutation();
