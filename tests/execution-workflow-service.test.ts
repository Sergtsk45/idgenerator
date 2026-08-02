/**
 * @file: execution-workflow-service.test.ts
 * @description: Integration tests against a real Postgres database for ownership,
 *   idempotency and optimistic-concurrency contracts of the execution workflow service.
 *   Skips gracefully when DATABASE_URL is not configured (e.g. CI without a DB), since
 *   server/db.ts throws at import time otherwise. Requires migrations up to
 *   0029_execution_workflow_state.sql to be applied (npm run db:migrate).
 * @dependencies: node:test, DATABASE_URL, migrations/0029_execution_workflow_state.sql
 * @created: 2026-08-02
 */

import test from "node:test";
import assert from "node:assert/strict";

async function setupTestUsers() {
  const { db } = await import("../server/db.ts");
  const { users, objects } = await import("../shared/schema.ts");

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const [ownerUser] = await db
    .insert(users)
    .values({ displayName: "MCP Test Owner", email: `mcp-owner-${suffix}@test.local` })
    .returning();
  const [otherUser] = await db
    .insert(users)
    .values({ displayName: "MCP Test Other", email: `mcp-other-${suffix}@test.local` })
    .returning();
  const [ownerObject] = await db
    .insert(objects)
    .values({ title: `MCP Test Object ${suffix}`, userId: ownerUser.id })
    .returning();

  return { db, ownerUser, otherUser, ownerObject };
}

test("execution workflow service: ownership, idempotency, concurrency, events", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL not set; skipping DB-backed workflow integration tests");
    return;
  }

  const { ownerUser, otherUser, ownerObject } = await setupTestUsers();
  const workflowService = await import("../server/services/execution-workflow/workflowService.ts");
  const workflowRepository = await import("../server/services/execution-workflow/workflowRepository.ts");
  const { McpToolError, MCP_ERROR_CODES } = await import("../server/mcp/errors.ts");

  const ownerAuth = { userId: ownerUser.id, displayName: "Owner", email: null, role: "user" };
  const otherAuth = { userId: otherUser.id, displayName: "Other", email: null, role: "user" };

  await t.test("creating a workflow for another user's object fails as NOT_FOUND (no existence leak)", async () => {
    await assert.rejects(
      () =>
        workflowService.createExecutionWorkflow(otherAuth, {
          objectId: ownerObject.id,
          idempotencyKey: `create-forbidden-${Date.now()}`,
        }),
      (err: unknown) => err instanceof McpToolError && err.code === MCP_ERROR_CODES.NOT_FOUND,
    );
  });

  const createKey = `create-${Date.now()}`;
  const created = await workflowService.createExecutionWorkflow(ownerAuth, {
    objectId: ownerObject.id,
    idempotencyKey: createKey,
  });

  await t.test("workflow starts in the 'created' stage at version 1", () => {
    assert.equal(created.stage, "created");
    assert.equal(created.version, 1);
    assert.equal(created.objectId, ownerObject.id);
  });

  await t.test("repeating create_execution_workflow with the same idempotencyKey does not create a duplicate", async () => {
    const retried = await workflowService.createExecutionWorkflow(ownerAuth, {
      objectId: ownerObject.id,
      idempotencyKey: createKey,
    });
    assert.equal(retried.workflowId, created.workflowId);
  });

  await t.test("reusing the same idempotencyKey with a different objectId is rejected as VALIDATION_ERROR", async () => {
    const [secondObject] = await (
      await import("../server/db.ts")
    ).db
      .insert((await import("../shared/schema.ts")).objects)
      .values({ title: `MCP Test Object 2 ${Date.now()}`, userId: ownerUser.id })
      .returning();

    await assert.rejects(
      () =>
        workflowService.createExecutionWorkflow(ownerAuth, {
          objectId: secondObject.id,
          idempotencyKey: createKey,
        }),
      (err: unknown) => err instanceof McpToolError && err.code === MCP_ERROR_CODES.VALIDATION_ERROR,
    );
  });

  await t.test("a non-owner cannot read the workflow (404, not 403, to avoid existence leak)", async () => {
    await assert.rejects(
      () => workflowService.getExecutionWorkflow(otherAuth, created.workflowId),
      (err: unknown) => err instanceof McpToolError && err.code === MCP_ERROR_CODES.NOT_FOUND,
    );
  });

  await t.test("get_missing_workflow_inputs reports all base inputs initially", async () => {
    const missing = await workflowService.getMissingWorkflowInputs(ownerAuth, created.workflowId);
    assert.equal(missing.missingInputs.length, 3);
  });

  await t.test("set_workflow_input with a stale expectedVersion is rejected as WORKFLOW_VERSION_CONFLICT", async () => {
    await assert.rejects(
      () =>
        workflowService.setWorkflowInput(ownerAuth, {
          workflowId: created.workflowId,
          expectedVersion: created.version + 99,
          idempotencyKey: `stale-${Date.now()}`,
          key: "projectStartDate",
          value: "2026-09-01",
          source: "user",
          confirmed: true,
        }),
      (err: unknown) => err instanceof McpToolError && err.code === MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT,
    );
  });

  let currentVersion = created.version;

  const setInput = async (key: string, value: unknown) => {
    const result = await workflowService.setWorkflowInput(ownerAuth, {
      workflowId: created.workflowId,
      expectedVersion: currentVersion,
      idempotencyKey: `set-${key}-${Date.now()}-${Math.random()}`,
      key,
      value,
      source: "user",
      confirmed: true,
    });
    currentVersion = result.version;
    return result;
  };

  await t.test("set_workflow_input persists a confirmed value and bumps the version", async () => {
    const result = await setInput("projectStartDate", "2026-09-01");
    assert.equal(result.version, 2);
    assert.ok(result.inputs.some((i) => i.key === "projectStartDate" && i.confirmed === true));
  });

  await t.test("repeating set_workflow_input with the previous (now stale) version conflicts", async () => {
    await assert.rejects(
      () =>
        workflowService.setWorkflowInput(ownerAuth, {
          workflowId: created.workflowId,
          expectedVersion: currentVersion - 1,
          idempotencyKey: `stale-2-${Date.now()}`,
          key: "workingCalendar",
          value: "5x2",
          source: "user",
          confirmed: true,
        }),
      (err: unknown) => err instanceof McpToolError && err.code === MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT,
    );
  });

  await setInput("workingCalendar", "5x2");
  const afterThird = await setInput("planningMode", "target_duration");

  await t.test("set_workflow_input never changes stage by itself (stage transitions are a separate concern)", () => {
    assert.equal(afterThird.stage, "created");
    assert.deepEqual(afterThird.missingInputs.map((input) => input.key), ["targetDurationDays"]);
  });

  await t.test("transitionWorkflowStage rejects skipping stages (created -> awaiting_schedule_inputs is not one hop)", async () => {
    await assert.rejects(
      () =>
        workflowService.transitionWorkflowStage(ownerAuth, {
          workflowId: created.workflowId,
          expectedVersion: currentVersion,
          nextStage: "awaiting_schedule_inputs",
        }),
      (err: unknown) => err instanceof McpToolError && err.code === MCP_ERROR_CODES.WORKFLOW_TRANSITION_NOT_ALLOWED,
    );
  });

  const transitioned = await workflowService.transitionWorkflowStage(ownerAuth, {
    workflowId: created.workflowId,
    expectedVersion: currentVersion,
    nextStage: "estimate_upload_pending",
  });

  await t.test("transitionWorkflowStage moves to the next linear stage and bumps the version", () => {
    assert.equal(transitioned.stage, "estimate_upload_pending");
    assert.equal(transitioned.version, currentVersion + 1);
  });

  await t.test("event log records workflow_created, three input_set and one stage_transition (append-only)", async () => {
    const { db } = await import("../server/db.ts");
    const events = await workflowRepository.getWorkflowEvents(db, created.workflowId);
    const types = events.map((e) => e.eventType);
    assert.equal(types.filter((t) => t === "workflow_created").length, 1);
    assert.equal(types.filter((t) => t === "input_set").length, 3);
    assert.equal(types.filter((t) => t === "stage_transition").length, 1);
    const stageEvent = events.find((e) => e.eventType === "stage_transition");
    assert.deepEqual(stageEvent?.payloadJson, { from: "created", to: "estimate_upload_pending" });
  });

  await t.test("a transition to the current stage is a genuine no-op: no version bump, no new event", async () => {
    const { db } = await import("../server/db.ts");
    const before = await workflowRepository.getWorkflowEvents(db, created.workflowId);

    const result = await workflowService.transitionWorkflowStage(ownerAuth, {
      workflowId: created.workflowId,
      expectedVersion: transitioned.version,
      nextStage: transitioned.stage,
    });

    assert.equal(result.version, transitioned.version);
    const after = await workflowRepository.getWorkflowEvents(db, created.workflowId);
    assert.equal(after.length, before.length);
  });

  await t.test("reusing an idempotencyKey with the same body but a different expectedVersion is rejected", async () => {
    const sharedKey = `set-shared-${Date.now()}`;
    const before = await workflowService.getExecutionWorkflow(ownerAuth, created.workflowId);

    const first = await workflowService.setWorkflowInput(ownerAuth, {
      workflowId: created.workflowId,
      expectedVersion: before.version,
      idempotencyKey: sharedKey,
      key: "workingCalendar",
      value: "6x1",
      source: "user",
      confirmed: true,
    });
    currentVersion = first.version;

    await assert.rejects(
      () =>
        workflowService.setWorkflowInput(ownerAuth, {
          workflowId: created.workflowId,
          expectedVersion: currentVersion, // different from the first call's expectedVersion (before.version)
          idempotencyKey: sharedKey,
          key: "workingCalendar",
          value: "6x1",
          source: "user",
          confirmed: true,
        }),
      (err: unknown) => err instanceof McpToolError && err.code === MCP_ERROR_CODES.VALIDATION_ERROR,
    );
  });

  await t.test("transitioning into 'failed' keeps status in sync (no {stage: failed, status: active})", async () => {
    const before = await workflowService.getExecutionWorkflow(ownerAuth, created.workflowId);
    const failed = await workflowService.transitionWorkflowStage(ownerAuth, {
      workflowId: created.workflowId,
      expectedVersion: before.version,
      nextStage: "failed",
    });
    assert.equal(failed.stage, "failed");
    assert.equal(failed.status, "failed");
  });
});

test("execution workflow service: concurrent requests do not create duplicates or leak losing writes", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL not set; skipping DB-backed concurrency tests");
    return;
  }

  const { db } = await import("../server/db.ts");
  const { executionWorkflows } = await import("../shared/schema.ts");
  const { eq } = await import("drizzle-orm");
  const { ownerUser, ownerObject } = await setupTestUsers();
  const workflowService = await import("../server/services/execution-workflow/workflowService.ts");
  const workflowRepository = await import("../server/services/execution-workflow/workflowRepository.ts");
  const { McpToolError, MCP_ERROR_CODES } = await import("../server/mcp/errors.ts");

  const auth = { userId: ownerUser.id, displayName: "Owner", email: null, role: "user" };

  await t.test("two concurrent create_execution_workflow calls with the same idempotencyKey create exactly one workflow", async () => {
    const key = `concurrent-create-${Date.now()}`;
    const [resultA, resultB] = await Promise.all([
      workflowService.createExecutionWorkflow(auth, { objectId: ownerObject.id, idempotencyKey: key }),
      workflowService.createExecutionWorkflow(auth, { objectId: ownerObject.id, idempotencyKey: key }),
    ]);

    assert.equal(resultA.workflowId, resultB.workflowId);

    const rows = await db.select().from(executionWorkflows).where(eq(executionWorkflows.objectId, ownerObject.id));
    const createdForThisObject = rows.filter((r) => r.id === resultA.workflowId);
    assert.equal(createdForThisObject.length, 1);
  });

  await t.test("two concurrent set_workflow_input calls racing on the same expectedVersion: exactly one wins, the loser's write never lands", async () => {
    const workflow = await workflowService.createExecutionWorkflow(auth, {
      objectId: ownerObject.id,
      idempotencyKey: `concurrent-race-base-${Date.now()}-${Math.random()}`,
    });

    const attempt = (value: string) =>
      workflowService
        .setWorkflowInput(auth, {
          workflowId: workflow.workflowId,
          expectedVersion: workflow.version,
          idempotencyKey: `concurrent-race-${value}-${Date.now()}-${Math.random()}`,
          key: "projectStartDate",
          value,
          source: "user",
          confirmed: true,
        })
        .then((r) => ({ status: "fulfilled" as const, value: r }))
        .catch((err) => ({ status: "rejected" as const, error: err }));

    const [outcomeA, outcomeB] = await Promise.all([attempt("2026-09-01"), attempt("2026-10-01")]);
    const outcomes = [outcomeA, outcomeB];

    const winners = outcomes.filter((o) => o.status === "fulfilled");
    const losers = outcomes.filter((o) => o.status === "rejected");

    assert.equal(winners.length, 1, "exactly one concurrent writer should succeed");
    assert.equal(losers.length, 1, "exactly one concurrent writer should be rejected");
    assert.ok(
      losers[0].status === "rejected" &&
        losers[0].error instanceof McpToolError &&
        losers[0].error.code === MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT,
    );

    // The persisted state must match the winner's write exactly — the loser's value must
    // not have landed even transiently (this is the exact bug from the code review: the
    // loser's upsertWorkflowInput used to run before the CAS check).
    const winningValue = winners[0].status === "fulfilled" ? winners[0].value.inputs[0].value : undefined;
    const stored = await workflowService.getExecutionWorkflow(auth, workflow.workflowId);
    assert.equal(stored.version, workflow.version + 1, "version must have incremented exactly once");
    assert.equal(stored.inputs.find((i) => i.key === "projectStartDate")?.value, winningValue);

    const events = await workflowRepository.getWorkflowEvents(db, workflow.workflowId);
    assert.equal(
      events.filter((e) => e.eventType === "input_set").length,
      1,
      "only the winning write should be recorded in the event log",
    );
  });
});

test("execution_workflow_events is append-only at the DB level", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL not set; skipping DB-level append-only trigger tests");
    return;
  }

  const { db } = await import("../server/db.ts");
  const { executionWorkflowEvents } = await import("../shared/schema.ts");
  const { eq } = await import("drizzle-orm");
  const { ownerUser, ownerObject } = await setupTestUsers();
  const workflowService = await import("../server/services/execution-workflow/workflowService.ts");

  const auth = { userId: ownerUser.id, displayName: "Owner", email: null, role: "user" };
  const workflow = await workflowService.createExecutionWorkflow(auth, {
    objectId: ownerObject.id,
    idempotencyKey: `append-only-${Date.now()}`,
  });

  await t.test("direct UPDATE against execution_workflow_events is rejected by the DB trigger", async () => {
    await assert.rejects(
      () =>
        db
          .update(executionWorkflowEvents)
          .set({ eventType: "tampered" })
          .where(eq(executionWorkflowEvents.workflowId, workflow.workflowId)),
      /append-only/,
    );
  });

  await t.test("direct DELETE against execution_workflow_events is rejected by the DB trigger", async () => {
    await assert.rejects(
      () => db.delete(executionWorkflowEvents).where(eq(executionWorkflowEvents.workflowId, workflow.workflowId)),
      /append-only/,
    );
  });

  await t.test("deleting the parent workflow still cascades and removes its events", async () => {
    const { executionWorkflows } = await import("../shared/schema.ts");
    await db.delete(executionWorkflows).where(eq(executionWorkflows.id, workflow.workflowId));
    const remaining = await db
      .select()
      .from(executionWorkflowEvents)
      .where(eq(executionWorkflowEvents.workflowId, workflow.workflowId));
    assert.equal(remaining.length, 0);
  });
});
