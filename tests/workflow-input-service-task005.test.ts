import test from "node:test";
import assert from "node:assert/strict";

test("TASK-005 workflow input service: validation, stage bridge, defaults, staleness and retry safety", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL not set; skipping DB-backed workflow input tests");
    return;
  }

  const { eq } = await import("drizzle-orm");
  const { db } = await import("../server/db.ts");
  const {
    users,
    objects,
    estimates,
    estimateSections,
    estimatePositions,
    positionResources,
    executionWorkflows,
  } = await import("../shared/schema.ts");
  const workflowService = await import("../server/services/execution-workflow/workflowService.ts");
  const workflowRepo = await import("../server/services/execution-workflow/workflowRepository.ts");
  const { analyzeEstimate } = await import("../server/services/estimateAnalysisService.ts");
  const { McpToolError, MCP_ERROR_CODES } = await import("../server/mcp/errors.ts");

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [owner, other] = await db
    .insert(users)
    .values([
      { displayName: "TASK-005 owner", email: `task005-owner-${suffix}@test.local` },
      { displayName: "TASK-005 other", email: `task005-other-${suffix}@test.local` },
    ])
    .returning();
  const [object] = await db
    .insert(objects)
    .values({ title: `TASK-005 object ${suffix}`, userId: owner.id })
    .returning();
  const [estimate] = await db
    .insert(estimates)
    .values({ objectId: object.id, name: `TASK-005 estimate ${suffix}` })
    .returning();
  const [section] = await db
    .insert(estimateSections)
    .values({ estimateId: estimate.id, number: "1", title: "Works", orderIndex: 1 })
    .returning();
  const [position] = await db
    .insert(estimatePositions)
    .values({
      estimateId: estimate.id,
      sectionId: section.id,
      lineNo: "1",
      code: "ГЭСН01-01-001",
      name: "Work with labor",
      unit: "м3",
      quantity: "1",
      orderIndex: 1,
    })
    .returning();
  await db.insert(positionResources).values({
    positionId: position.id,
    resourceType: "ОТ",
    name: "Worker labor",
    unit: "чел.-ч",
    quantityTotal: "8",
    orderIndex: 1,
  });
  const [workflow] = await db
    .insert(executionWorkflows)
    .values({
      userId: owner.id,
      objectId: object.id,
      estimateId: estimate.id,
      stage: "estimate_imported",
      status: "active",
      version: 4,
    })
    .returning();

  const ownerAuth = {
    userId: owner.id,
    displayName: owner.displayName,
    email: owner.email,
    role: owner.role,
  };
  const otherAuth = {
    userId: other.id,
    displayName: other.displayName,
    email: other.email,
    role: other.role,
  };
  const analyzed = await analyzeEstimate(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: workflow.version,
    idempotencyKey: `task005-analyze-${suffix}`,
  });
  assert.equal(analyzed.stage, "estimate_analysis_ready");
  let currentVersion = analyzed.version;

  const persistedState = async () => {
    const [row] = await db.select().from(executionWorkflows).where(eq(executionWorkflows.id, workflow.id));
    const inputs = await workflowRepo.getWorkflowInputs(db, workflow.id);
    const events = await workflowRepo.getWorkflowEvents(db, workflow.id);
    return { stage: row.stage, version: row.version, inputCount: inputs.length, eventCount: events.length };
  };

  const beforeInvalid = await persistedState();
  for (const [key, value, idempotencyKey] of [
    ["unknownInput", 1, `task005-invalid-key-${suffix}`],
    ["crewSize", -2, `task005-invalid-value-${suffix}`],
  ] as const) {
    await assert.rejects(
      () => workflowService.setWorkflowInput(ownerAuth, {
        workflowId: workflow.id,
        expectedVersion: currentVersion,
        idempotencyKey,
        key,
        value,
        source: "user",
        confirmed: true,
      }),
      (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.VALIDATION_ERROR,
    );
    assert.equal(
      await workflowRepo.findIdempotencyRecord(db, owner.id, "set_workflow_input", idempotencyKey),
      undefined,
    );
  }
  assert.deepEqual(await persistedState(), beforeInvalid, "invalid input must not mutate workflow state");

  await assert.rejects(
    () => workflowService.getMissingWorkflowInputs(otherAuth, workflow.id),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
  );
  await assert.rejects(
    () => workflowService.setWorkflowInput(otherAuth, {
      workflowId: workflow.id,
      expectedVersion: currentVersion,
      idempotencyKey: `task005-owner-check-${suffix}`,
      key: "projectStartDate",
      value: "2026-09-01",
      source: "user",
      confirmed: true,
    }),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
  );
  assert.deepEqual(await persistedState(), beforeInvalid, "non-owner input must roll back every write");

  const firstArgs = {
    workflowId: workflow.id,
    expectedVersion: currentVersion,
    idempotencyKey: `task005-first-input-${suffix}`,
    key: "projectStartDate" as const,
    value: "2026-09-01",
    source: "user" as const,
    confirmed: true,
  };
  const first = await workflowService.setWorkflowInput(ownerAuth, firstArgs);
  currentVersion = first.version;
  assert.equal(first.stage, "awaiting_schedule_inputs");
  assert.equal(first.version, analyzed.version + 1);

  const retry = await workflowService.setWorkflowInput(ownerAuth, firstArgs);
  assert.equal(retry.version, first.version);
  assert.equal(retry.stage, first.stage);
  const eventsAfterRetry = await workflowRepo.getWorkflowEvents(db, workflow.id);
  assert.equal(eventsAfterRetry.filter((event) => event.eventType === "input_set").length, 1);
  assert.equal(
    eventsAfterRetry.filter(
      (event) => event.eventType === "stage_transition"
        && event.payloadJson.from === "estimate_analysis_ready"
        && event.payloadJson.to === "awaiting_schedule_inputs",
    ).length,
    1,
  );

  await assert.rejects(
    () => workflowService.setWorkflowInput(ownerAuth, { ...firstArgs, value: "2026-09-02" }),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.VALIDATION_ERROR,
  );

  const beforeNoop = await persistedState();
  const noop = await workflowService.setWorkflowInput(ownerAuth, {
    ...firstArgs,
    expectedVersion: currentVersion,
    idempotencyKey: `task005-same-value-${suffix}`,
  });
  assert.equal(noop.version, currentVersion);
  assert.deepEqual(await persistedState(), beforeNoop, "same value/source/confirmation must be a no-op");

  const setInput = async (
    key: "workingCalendar" | "planningMode" | "crewSize" | "shiftHours" | "projectStartDate",
    value: string | number,
    source: "user" | "system_default" = "user",
    confirmed = true,
  ) => {
    const result = await workflowService.setWorkflowInput(ownerAuth, {
      workflowId: workflow.id,
      expectedVersion: currentVersion,
      idempotencyKey: `task005-set-${key}-${confirmed}-${Date.now()}-${Math.random()}`,
      key,
      value,
      source,
      confirmed,
    });
    currentVersion = result.version;
    return result;
  };

  await setInput("workingCalendar", "5x2");
  await setInput("planningMode", "crew_size");
  await setInput("crewSize", 4);
  const unconfirmedDefault = await setInput("shiftHours", 8, "system_default", false);
  assert.ok(unconfirmedDefault.missingInputs.some((question) => question.key === "shiftHours"));

  const confirmedDefault = await setInput("shiftHours", 8, "system_default", true);
  assert.ok(!confirmedDefault.missingInputs.some((question) => question.key === "shiftHours"));
  assert.ok(confirmedDefault.missingInputs.some((question) => question.key === "utilizationFactor"));

  const changedDate = await setInput("projectStartDate", "2026-09-02");
  assert.notEqual(changedDate.scheduleInputHash, first.scheduleInputHash);
  const finalEvents = await workflowRepo.getWorkflowEvents(db, workflow.id);
  const dateInvalidations = finalEvents.filter(
    (event) => event.eventType === "calculated_artifacts_invalidated"
      && event.payloadJson.key === "projectStartDate",
  );
  assert.equal(dateInvalidations.length, 1);
  assert.deepEqual(dateInvalidations[0]?.payloadJson.artifacts, ["schedule_draft"]);
});
