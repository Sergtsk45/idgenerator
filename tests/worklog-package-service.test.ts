import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("TASK-010 services scope worklog evidence and build owned idempotent draft packages", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL not set; skipping DB-backed worklog/package integration test");
    return;
  }

  const { eq, inArray } = await import("drizzle-orm");
  const { db } = await import("../server/db.ts");
  const {
    users,
    objects,
    workCollections,
    works,
    schedules,
    scheduleTasks,
    executionWorkflows,
    executionWorkflowEvents,
    messages,
    acts,
    worklogDrafts,
    executionPackages,
    toolIdempotencyRecords,
  } = await import("../shared/schema.ts");
  const { generateWorklogDraft, getWorklogDraft } = await import("../server/services/worklogDraftService.ts");
  const {
    buildExecutionPackage,
    checkHandoverReadiness,
    getOwnedExecutionPackageFile,
  } = await import("../server/services/executionPackageService.ts");
  const { removeExecutionPackageFile } = await import(
    "../server/services/execution-package/executionPackageFiles.ts"
  );
  const { MCP_ERROR_CODES, McpToolError } = await import("../server/mcp/errors.ts");

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const packagesRoot = await mkdtemp(path.join(os.tmpdir(), "task010-packages-"));
  const previousPackagesRoot = process.env.EXECUTION_PACKAGES_DIR;
  process.env.EXECUTION_PACKAGES_DIR = packagesRoot;

  const [owner, other] = await db.insert(users).values([
    { displayName: "TASK-010 owner", email: `task010-owner-${suffix}@test.local` },
    { displayName: "TASK-010 other", email: `task010-other-${suffix}@test.local` },
  ]).returning();
  const [object, siblingObject] = await db.insert(objects).values([
    { title: `TASK-010 object ${suffix}`, address: "Основной объект", city: "Якутск", userId: owner.id },
    { title: `TASK-010 sibling ${suffix}`, address: "Другой объект", city: "Якутск", userId: owner.id },
  ]).returning();
  const [collection] = await db.insert(workCollections).values({
    objectId: object.id,
    code: `TASK010-${suffix}`,
    name: "TASK-010 works",
  }).returning();
  const [work] = await db.insert(works).values({
    workCollectionId: collection.id,
    code: "W-010",
    description: "Монтаж оборудования",
    unit: "шт",
    quantityTotal: "2",
    orderIndex: 1,
  }).returning();
  const [schedule] = await db.insert(schedules).values({
    objectId: object.id,
    title: "TASK-010 schedule",
    calendarStart: "2026-08-03",
    sourceType: "works",
    workCollectionId: collection.id,
  }).returning();
  const [task] = await db.insert(scheduleTasks).values({
    scheduleId: schedule.id,
    workId: work.id,
    actNumber: 10,
    titleOverride: "Плановый монтаж",
    quantity: "2",
    unit: "шт",
    startDate: "2026-08-03",
    durationDays: 1,
    orderIndex: 1,
  }).returning();
  const [workflow] = await db.insert(executionWorkflows).values({
    userId: owner.id,
    objectId: object.id,
    scheduleId: schedule.id,
    stage: "acts_generated",
    status: "active",
    version: 20,
  }).returning();
  await db.insert(executionWorkflowEvents).values({
    workflowId: workflow.id,
    eventType: "acts_generated",
    actorType: "agent",
    actorId: String(owner.id),
    payloadJson: { deliberatelyExcludedFromPackage: "secret-like payload" },
  });
  await db.insert(acts).values([
    {
      objectId: object.id,
      workflowId: workflow.id,
      scheduleId: schedule.id,
      actNumber: 10,
      dateStart: "2026-08-03",
      dateEnd: "2026-08-03",
      status: "generated",
      worksData: [{ sourceType: "works", sourceId: work.id, description: "Подтверждённый монтаж", quantity: 2, unit: "шт" }],
    },
    {
      objectId: object.id,
      workflowId: workflow.id,
      scheduleId: schedule.id,
      actNumber: 11,
      dateStart: "2026-08-04",
      dateEnd: "2026-08-04",
      status: "draft",
      worksData: [{ sourceType: "works", sourceId: work.id, description: "Неподтверждённый акт", quantity: 1, unit: "шт" }],
    },
  ]);
  const [reportedMessage] = await db.insert(messages).values({
    userId: owner.id,
    objectId: object.id,
    messageRaw: "Смонтировано оборудование",
    normalizedData: { workDescription: "Фактически смонтировано", quantity: 2, unit: "шт", date: "2026-08-03" },
    isProcessed: true,
    createdAt: new Date("2026-08-03T10:00:00Z"),
  }).returning();
  await db.insert(messages).values([
    {
      userId: owner.id,
      objectId: object.id,
      messageRaw: "Ещё не нормализовано",
      normalizedData: null,
      isProcessed: false,
      createdAt: new Date("2026-08-03T11:00:00Z"),
    },
    {
      userId: owner.id,
      objectId: siblingObject.id,
      messageRaw: "Сообщение другого объекта",
      normalizedData: { workDescription: "Чужой объект", date: "2026-08-03" },
      isProcessed: true,
    },
    {
      userId: other.id,
      objectId: object.id,
      messageRaw: "Сообщение другого пользователя",
      normalizedData: { workDescription: "Чужой пользователь", date: "2026-08-03" },
      isProcessed: true,
    },
  ]);

  t.after(async () => {
    const rows = await db.select({ storageKey: executionPackages.storageKey })
      .from(executionPackages)
      .where(eq(executionPackages.objectId, object.id));
    await Promise.all(rows.map(({ storageKey }) => removeExecutionPackageFile(storageKey)));
    await db.transaction(async (tx) => {
      await tx.delete(executionWorkflows).where(eq(executionWorkflows.id, workflow.id));
      await tx.delete(messages).where(inArray(messages.objectId, [object.id, siblingObject.id]));
      await tx.delete(scheduleTasks).where(eq(scheduleTasks.scheduleId, schedule.id));
      await tx.delete(schedules).where(eq(schedules.id, schedule.id));
      await tx.delete(works).where(eq(works.id, work.id));
      await tx.delete(workCollections).where(eq(workCollections.id, collection.id));
      await tx.delete(objects).where(inArray(objects.id, [object.id, siblingObject.id]));
      await tx.delete(toolIdempotencyRecords).where(inArray(toolIdempotencyRecords.userId, [owner.id, other.id]));
      await tx.delete(users).where(inArray(users.id, [owner.id, other.id]));
    });
    if (previousPackagesRoot === undefined) delete process.env.EXECUTION_PACKAGES_DIR;
    else process.env.EXECUTION_PACKAGES_DIR = previousPackagesRoot;
    await rm(packagesRoot, { recursive: true, force: true });
  });

  const ownerAuth = { userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role };
  const otherAuth = { userId: other.id, displayName: other.displayName, email: other.email, role: other.role };
  await assert.rejects(
    () => getWorklogDraft(otherAuth, workflow.id),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
  );

  const generateArgs = {
    workflowId: workflow.id,
    expectedVersion: workflow.version,
    idempotencyKey: `task010-worklog-${suffix}`,
  };
  const firstDraft = await generateWorklogDraft(ownerAuth, generateArgs);
  assert.deepEqual(await generateWorklogDraft(ownerAuth, generateArgs), firstDraft);
  const semanticRetry = await generateWorklogDraft(ownerAuth, {
    ...generateArgs,
    expectedVersion: firstDraft.workflowVersion,
    idempotencyKey: `task010-worklog-semantic-${suffix}`,
  });
  assert.equal(semanticRetry.draftId, firstDraft.draftId);
  assert.equal((await db.select().from(worklogDrafts).where(eq(worklogDrafts.workflowId, workflow.id))).length, 1);
  assert.deepEqual(new Set(firstDraft.entries.map((entry) => entry.evidenceStatus)), new Set([
    "planned",
    "reported",
    "act_confirmed",
  ]));
  assert.ok(firstDraft.warnings.some((warning) => warning.includes("messages without normalized")));
  assert.ok(firstDraft.warnings.some((warning) => warning.includes("draft acts")));
  assert.doesNotMatch(JSON.stringify(firstDraft), /Чужой объект|Чужой пользователь|Неподтверждённый акт/);

  await db.update(messages).set({
    normalizedData: { workDescription: "Фактически смонтировано — уточнено", quantity: 2, unit: "шт", date: "2026-08-03" },
  }).where(eq(messages.id, reportedMessage.id));
  assert.equal((await getWorklogDraft(ownerAuth, workflow.id)).fresh, false);
  const freshDraft = await generateWorklogDraft(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: firstDraft.workflowVersion,
    idempotencyKey: `task010-worklog-fresh-${suffix}`,
  });
  assert.notEqual(freshDraft.draftId, firstDraft.draftId);
  assert.notEqual(freshDraft.inputHash, firstDraft.inputHash);
  assert.equal((await db.select().from(worklogDrafts).where(eq(worklogDrafts.workflowId, workflow.id))).length, 2);

  const draftPackageArgs = {
    workflowId: workflow.id,
    mode: "draft" as const,
    confirmFinal: false,
    expectedVersion: freshDraft.workflowVersion,
    idempotencyKey: `task010-package-${suffix}`,
  };
  const draftPackage = await buildExecutionPackage(ownerAuth, draftPackageArgs);
  assert.equal(draftPackage.mode, "draft");
  assert.equal(draftPackage.manifest.draft, true);
  assert.ok((draftPackage.manifest.blockers as Array<unknown>).length > 0);
  assert.deepEqual(await buildExecutionPackage(ownerAuth, draftPackageArgs), draftPackage);
  const semanticPackageRetry = await buildExecutionPackage(ownerAuth, {
    ...draftPackageArgs,
    expectedVersion: draftPackage.workflowVersion,
    idempotencyKey: `task010-package-semantic-${suffix}`,
  });
  assert.equal(semanticPackageRetry.packageId, draftPackage.packageId);
  assert.equal((await db.select().from(executionPackages).where(eq(executionPackages.workflowId, workflow.id))).length, 1);
  const ownedPackage = await getOwnedExecutionPackageFile(ownerAuth, draftPackage.packageId);
  assert.equal(ownedPackage.buffer.subarray(0, 2).toString("ascii"), "PK");
  assert.doesNotMatch(ownedPackage.buffer.toString("utf8"), /secret-like payload|Чужой объект|Чужой пользователь/);
  await assert.rejects(
    () => getOwnedExecutionPackageFile(otherAuth, draftPackage.packageId),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.PACKAGE_NOT_OWNED,
  );

  await assert.rejects(
    () => buildExecutionPackage(ownerAuth, {
      ...draftPackageArgs,
      mode: "final",
      expectedVersion: draftPackage.workflowVersion,
      idempotencyKey: `task010-final-unconfirmed-${suffix}`,
    }),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.PACKAGE_REQUIRES_CONFIRMATION,
  );
  await assert.rejects(
    () => buildExecutionPackage(ownerAuth, {
      ...draftPackageArgs,
      mode: "final",
      confirmFinal: true,
      expectedVersion: draftPackage.workflowVersion,
      idempotencyKey: `task010-final-blocked-${suffix}`,
    }),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.HANDOVER_NOT_READY,
  );

  await db.update(messages).set({
    normalizedData: { workDescription: "Новое изменение после package", date: "2026-08-04" },
  }).where(eq(messages.id, reportedMessage.id));
  const readiness = await checkHandoverReadiness(ownerAuth, workflow.id);
  assert.ok(readiness.blockers.some((blocker) => blocker.code === "WORKLOG_DRAFT_STALE"));
});
