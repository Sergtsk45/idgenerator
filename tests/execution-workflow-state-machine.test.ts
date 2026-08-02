/**
 * @file: execution-workflow-state-machine.test.ts
 * @description: Pure unit tests for the workflow state machine and missing-inputs
 *   contract (no DB dependency — these modules only import @shared/schema types).
 * @dependencies: node:test
 * @created: 2026-08-02
 */

import test from "node:test";
import assert from "node:assert/strict";

import { allowedNextStages, assertTransitionAllowed } from "../server/services/execution-workflow/workflowStateMachine.ts";
import {
  BASE_REQUIRED_INPUTS,
  computeMissingInputs,
} from "../server/services/execution-workflow/workflowInputs.ts";
import { WORKFLOW_STAGES } from "../shared/schema.ts";
import { McpToolError, MCP_ERROR_CODES } from "../server/mcp/errors.ts";

test("allowedNextStages: linear forward order with failed always reachable", () => {
  assert.deepEqual(allowedNextStages("created"), ["estimate_upload_pending", "failed"]);
  assert.deepEqual(allowedNextStages("schedule_approved"), ["materials_register_ready", "failed"]);
});

test("allowedNextStages: terminal stages have no outgoing transitions", () => {
  assert.deepEqual(allowedNextStages("completed"), []);
  assert.deepEqual(allowedNextStages("failed"), []);
});

test("allowedNextStages: covers every non-terminal stage from the shared enum", () => {
  for (const stage of WORKFLOW_STAGES) {
    if (stage === "completed" || stage === "failed") continue;
    const next = allowedNextStages(stage);
    assert.ok(next.includes("failed"), `${stage} must be able to transition to failed`);
    assert.ok(next.length >= 1);
  }
});

test("assertTransitionAllowed: allows the next linear stage and failed", () => {
  assert.doesNotThrow(() => assertTransitionAllowed("created", "estimate_upload_pending"));
  assert.doesNotThrow(() => assertTransitionAllowed("created", "failed"));
});

test("assertTransitionAllowed: no-op transition to the same stage is allowed", () => {
  assert.doesNotThrow(() => assertTransitionAllowed("created", "created"));
});

test("assertTransitionAllowed: rejects skipping stages with WORKFLOW_TRANSITION_NOT_ALLOWED", () => {
  assert.throws(
    () => assertTransitionAllowed("created", "schedule_approved"),
    (err: unknown) => err instanceof McpToolError && err.code === MCP_ERROR_CODES.WORKFLOW_TRANSITION_NOT_ALLOWED,
  );
});

test("assertTransitionAllowed: rejects any transition out of a terminal stage", () => {
  assert.throws(
    () => assertTransitionAllowed("completed", "failed"),
    (err: unknown) => err instanceof McpToolError && err.code === MCP_ERROR_CODES.WORKFLOW_TRANSITION_NOT_ALLOWED,
  );
});

test("computeMissingInputs: reports all base inputs when nothing is confirmed", () => {
  const missing = computeMissingInputs([]);
  assert.equal(missing.length, BASE_REQUIRED_INPUTS.length);
  assert.deepEqual(missing.map((m) => m.key).sort(), BASE_REQUIRED_INPUTS.map((d) => d.key).sort());
});

test("computeMissingInputs: an unconfirmed stored value still counts as missing (system defaults need confirmation)", () => {
  const missing = computeMissingInputs([
    { id: 1, workflowId: 1, key: "workingCalendar", valueJson: "5x2", source: "system_default", confirmed: false, updatedAt: new Date() },
  ]);
  assert.ok(missing.some((m) => m.key === "workingCalendar"));
});

test("computeMissingInputs: a confirmed value removes that key from the missing list", () => {
  const missing = computeMissingInputs([
    { id: 1, workflowId: 1, key: "workingCalendar", valueJson: "5x2", source: "user", confirmed: true, updatedAt: new Date() },
  ]);
  assert.equal(missing.length, BASE_REQUIRED_INPUTS.length - 1);
  assert.ok(!missing.some((m) => m.key === "workingCalendar"));
});
