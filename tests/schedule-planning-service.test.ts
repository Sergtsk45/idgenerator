import test from "node:test";
import assert from "node:assert/strict";

test("schedule planning service: target draft, staleness, ownership and idempotent approval", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL not set; skipping DB-backed schedule planning integration test");
    return;
  }

  const { eq, inArray } = await import("drizzle-orm");
  const { db } = await import("../server/db.ts");
  const {
    users,
    objects,
    estimates,
    estimateSections,
    estimatePositions,
    positionResources,
    executionWorkflows,
    toolIdempotencyRecords,
    schedules,
    scheduleTasks,
  } = await import("../shared/schema.ts");
  const { analyzeEstimate } = await import("../server/services/estimateAnalysisService.ts");
  const { getScheduleDraft, calculateScheduleDraft, approveSchedule } = await import(
    "../server/services/schedulePlanningService.ts"
  );
  const { setWorkflowInput } = await import(
    "../server/services/execution-workflow/workflowService.ts"
  );
  const workflowRepo = await import(
    "../server/services/execution-workflow/workflowRepository.ts"
  );
  const { McpToolError, MCP_ERROR_CODES } = await import("../server/mcp/errors.ts");

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [owner, other] = await db
    .insert(users)
    .values([
      { displayName: "TASK-006 owner", email: `task006-owner-${suffix}@test.local` },
      { displayName: "TASK-006 other", email: `task006-other-${suffix}@test.local` },
    ])
    .returning();
  const [object] = await db
    .insert(objects)
    .values({ title: `TASK-006 object ${suffix}`, userId: owner.id })
    .returning();
  const [estimate] = await db
    .insert(estimates)
    .values({ objectId: object.id, code: "ЛСР-TASK-006", name: `TASK-006 estimate ${suffix}` })
    .returning();

  t.after(async () => {
    await db.transaction(async (tx) => {
      const ownedSchedules = await tx
        .select({ id: schedules.id })
        .from(schedules)
        .where(eq(schedules.objectId, object.id));
      const scheduleIds = ownedSchedules.map((schedule) => schedule.id);
      if (scheduleIds.length) {
        await tx.delete(scheduleTasks).where(inArray(scheduleTasks.scheduleId, scheduleIds));
        await tx.delete(schedules).where(inArray(schedules.id, scheduleIds));
      }
      await tx.delete(executionWorkflows).where(eq(executionWorkflows.objectId, object.id));
      const positions = await tx
        .select({ id: estimatePositions.id })
        .from(estimatePositions)
        .where(eq(estimatePositions.estimateId, estimate.id));
      const positionIds = positions.map((position) => position.id);
      if (positionIds.length) {
        await tx.delete(positionResources).where(inArray(positionResources.positionId, positionIds));
        await tx.delete(estimatePositions).where(inArray(estimatePositions.id, positionIds));
      }
      await tx.delete(estimateSections).where(eq(estimateSections.estimateId, estimate.id));
      await tx.delete(estimates).where(eq(estimates.id, estimate.id));
      await tx.delete(objects).where(eq(objects.id, object.id));
      await tx
        .delete(toolIdempotencyRecords)
        .where(inArray(toolIdempotencyRecords.userId, [owner.id, other.id]));
      await tx.delete(users).where(inArray(users.id, [owner.id, other.id]));
    });
  });

  const [section] = await db
    .insert(estimateSections)
    .values({ estimateId: estimate.id, number: "1", title: "Main works", orderIndex: 1 })
    .returning();
  const [firstPosition, secondPosition] = await db
    .insert(estimatePositions)
    .values([
      {
        estimateId: estimate.id,
        sectionId: section.id,
        lineNo: "1",
        code: "ГЭСН01-01-001",
        name: "First work",
        unit: "м3",
        quantity: "10",
        orderIndex: 1,
      },
      {
        estimateId: estimate.id,
        sectionId: section.id,
        lineNo: "2",
        code: "ФЕР01-01-002",
        name: "Second work",
        unit: "м2",
        quantity: "20",
        orderIndex: 2,
      },
    ])
    .returning();
  await db.insert(positionResources).values([
    {
      positionId: firstPosition.id,
      resourceType: "ОТ",
      name: "First work labor",
      unit: "чел.-ч",
      quantityTotal: "8",
      orderIndex: 1,
    },
    {
      positionId: secondPosition.id,
      resourceType: "ОТ",
      name: "Second work labor",
      unit: "чел.-ч",
      quantityTotal: "16",
      orderIndex: 1,
    },
  ]);
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
    idempotencyKey: `task006-analyze-${suffix}`,
  });
  let currentVersion = analyzed.version;

  const setInput = async (
    key: "projectStartDate" | "workingCalendar" | "planningMode" | "targetDurationDays",
    value: string | number,
  ) => {
    const result = await setWorkflowInput(ownerAuth, {
      workflowId: workflow.id,
      expectedVersion: currentVersion,
      idempotencyKey: `task006-input-${key}-${value}-${suffix}`,
      key,
      value,
      source: "user",
      confirmed: true,
    });
    currentVersion = result.version;
    return result;
  };

  await setInput("projectStartDate", "2026-09-04"); // Friday
  await setInput("workingCalendar", "5x2");
  await setInput("planningMode", "target_duration");
  const ready = await setInput("targetDurationDays", 5);
  assert.equal(ready.ready, true);

  const calculateArgs = {
    workflowId: workflow.id,
    expectedVersion: currentVersion,
    idempotencyKey: `task006-calculate-${suffix}`,
  };
  const firstDraft = await calculateScheduleDraft(ownerAuth, calculateArgs);
  currentVersion = firstDraft.workflowVersion;
  assert.equal(firstDraft.stage, "schedule_draft_ready");
  assert.equal(firstDraft.draftVersion, 1);
  assert.equal(firstDraft.plan.totalWorkingDays, 5);
  assert.deepEqual(
    firstDraft.plan.tasks.map((task) => ({
      positionId: task.estimatePositionId,
      startDate: task.startDate,
      endDate: task.endDate,
      durationDays: task.durationDays,
    })),
    [
      { positionId: firstPosition.id, startDate: "2026-09-04", endDate: "2026-09-07", durationDays: 2 },
      { positionId: secondPosition.id, startDate: "2026-09-08", endDate: "2026-09-10", durationDays: 3 },
    ],
  );
  assert.deepEqual(await calculateScheduleDraft(ownerAuth, calculateArgs), firstDraft);

  await assert.rejects(
    () => getScheduleDraft(otherAuth, workflow.id),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
  );
  await assert.rejects(
    () => approveSchedule(otherAuth, {
      workflowId: workflow.id,
      draftVersion: firstDraft.draftVersion,
      expectedVersion: currentVersion,
      idempotencyKey: `task006-other-approve-${suffix}`,
    }),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
  );

  const changed = await setInput("targetDurationDays", 6);
  assert.notEqual(changed.scheduleInputHash, firstDraft.inputHash);
  const staleKey = `task006-stale-approve-${suffix}`;
  await assert.rejects(
    () => approveSchedule(ownerAuth, {
      workflowId: workflow.id,
      draftVersion: firstDraft.draftVersion,
      expectedVersion: currentVersion,
      idempotencyKey: staleKey,
    }),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.SCHEDULE_DRAFT_STALE,
  );
  assert.equal(
    await workflowRepo.findIdempotencyRecord(db, owner.id, "approve_schedule", staleKey),
    undefined,
  );
  assert.equal(
    (await db.select().from(schedules).where(eq(schedules.objectId, object.id))).length,
    0,
    "stale approval must not persist a partial schedule",
  );

  const currentDraft = await calculateScheduleDraft(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: currentVersion,
    idempotencyKey: `task006-recalculate-${suffix}`,
  });
  currentVersion = currentDraft.workflowVersion;
  assert.equal(currentDraft.draftVersion, 2);
  assert.equal(currentDraft.plan.totalWorkingDays, 6);

  const approveArgs = {
    workflowId: workflow.id,
    draftVersion: currentDraft.draftVersion,
    expectedVersion: currentVersion,
    idempotencyKey: `task006-approve-${suffix}`,
  };
  const approved = await approveSchedule(ownerAuth, approveArgs);
  assert.equal(approved.stage, "schedule_approved");
  assert.equal(approved.tasksCount, 2);

  const persistedTasks = await db
    .select()
    .from(scheduleTasks)
    .where(eq(scheduleTasks.scheduleId, approved.scheduleId));
  assert.deepEqual(
    persistedTasks
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((task) => ({
        positionId: task.estimatePositionId,
        startDate: task.startDate,
        durationDays: task.durationDays,
        orderIndex: task.orderIndex,
      })),
    [
      { positionId: firstPosition.id, startDate: "2026-09-04", durationDays: 2, orderIndex: 0 },
      { positionId: secondPosition.id, startDate: "2026-09-08", durationDays: 4, orderIndex: 1 },
    ],
  );

  assert.deepEqual(await approveSchedule(ownerAuth, approveArgs), approved);
  const repeatedWithNewKey = await approveSchedule(ownerAuth, {
    ...approveArgs,
    expectedVersion: approved.workflowVersion,
    idempotencyKey: `task006-approve-again-${suffix}`,
  });
  assert.deepEqual(repeatedWithNewKey, approved);
  assert.equal(
    (await db.select().from(schedules).where(eq(schedules.objectId, object.id))).length,
    1,
  );
  assert.equal(
    (await db.select().from(scheduleTasks).where(eq(scheduleTasks.scheduleId, approved.scheduleId))).length,
    2,
  );

  const approvedDraft = await getScheduleDraft(ownerAuth, workflow.id);
  assert.equal(approvedDraft.status, "approved");
  assert.equal(approvedDraft.approvedScheduleId, approved.scheduleId);
});
