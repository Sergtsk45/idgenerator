import test from "node:test";
import assert from "node:assert/strict";

test("material register service: provenance, rebuilds, manual classification, documents and ownership", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL not set; skipping DB-backed material register integration test");
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
    taskMaterials,
    projectMaterials,
    materialRegisterStates,
    materialRegisterItems,
    materialRegisterSourceLinks,
    documents,
    documentBindings,
  } = await import("../shared/schema.ts");
  const { analyzeEstimate } = await import("../server/services/estimateAnalysisService.ts");
  const {
    buildMaterialRegister,
    confirmMaterialClassification,
    getMaterialRegister,
    getMissingQualityDocuments,
  } = await import("../server/services/materialRegisterService.ts");
  const { McpToolError, MCP_ERROR_CODES } = await import("../server/mcp/errors.ts");

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [owner, other] = await db
    .insert(users)
    .values([
      { displayName: "TASK-007 owner", email: `task007-owner-${suffix}@test.local` },
      { displayName: "TASK-007 other", email: `task007-other-${suffix}@test.local` },
    ])
    .returning();
  const [object] = await db
    .insert(objects)
    .values({ title: `TASK-007 object ${suffix}`, userId: owner.id })
    .returning();
  const [estimate] = await db
    .insert(estimates)
    .values({ objectId: object.id, code: "ЛСР-TASK-007", name: `TASK-007 estimate ${suffix}` })
    .returning();

  t.after(async () => {
    await db.transaction(async (tx) => {
      await tx.delete(executionWorkflows).where(eq(executionWorkflows.objectId, object.id));
      const ownedSchedules = await tx
        .select({ id: schedules.id })
        .from(schedules)
        .where(eq(schedules.objectId, object.id));
      const scheduleIds = ownedSchedules.map((schedule) => schedule.id);
      if (scheduleIds.length) {
        const tasks = await tx
          .select({ id: scheduleTasks.id })
          .from(scheduleTasks)
          .where(inArray(scheduleTasks.scheduleId, scheduleIds));
        const taskIds = tasks.map((task) => task.id);
        if (taskIds.length) await tx.delete(taskMaterials).where(inArray(taskMaterials.taskId, taskIds));
        await tx.delete(scheduleTasks).where(inArray(scheduleTasks.scheduleId, scheduleIds));
        await tx.delete(schedules).where(inArray(schedules.id, scheduleIds));
      }
      await tx.delete(documentBindings).where(eq(documentBindings.objectId, object.id));
      await tx.delete(documents).where(eq(documents.objectId, object.id));
      await tx.delete(projectMaterials).where(eq(projectMaterials.objectId, object.id));
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
  const [firstPosition, auxiliaryPosition, secondPosition] = await db
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
        lineNo: "1.1",
        code: "ФССЦ-101-0001",
        name: "Песок строительный",
        unit: "м3",
        quantity: "3",
        orderIndex: 2,
      },
      {
        estimateId: estimate.id,
        sectionId: section.id,
        lineNo: "2",
        code: "ФЕР01-01-002",
        name: "Second work",
        unit: "м2",
        quantity: "20",
        orderIndex: 3,
      },
    ])
    .returning();
  const [cementOne, pumpSmall, unknown, cementTwo, pumpLarge] = await db
    .insert(positionResources)
    .values([
      {
        positionId: firstPosition.id,
        resourceType: "М",
        name: "  Цемент   М500 ",
        unit: "кг.",
        quantityTotal: "10",
        orderIndex: 1,
      },
      {
        positionId: firstPosition.id,
        resourceType: "ЭМ",
        name: "Насос UPS 25-40",
        unit: "шт",
        quantityTotal: "1",
        orderIndex: 2,
      },
      {
        positionId: firstPosition.id,
        resourceType: "UNKNOWN",
        name: "Неясный ресурс",
        unit: "компл.",
        quantityTotal: "1",
        orderIndex: 3,
      },
      {
        positionId: secondPosition.id,
        resourceType: "М",
        name: "цемент м500",
        unit: "кг",
        quantityTotal: "20",
        orderIndex: 1,
      },
      {
        positionId: secondPosition.id,
        resourceType: "ЭМ",
        name: "Насос UPS 25-60",
        unit: "шт",
        quantityTotal: "1",
        orderIndex: 2,
      },
    ])
    .returning();
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
    idempotencyKey: `task007-analyze-${suffix}`,
  });
  const [schedule] = await db
    .insert(schedules)
    .values({
      objectId: object.id,
      title: `TASK-007 schedule ${suffix}`,
      calendarStart: "2026-09-01",
      sourceType: "estimate",
      estimateId: estimate.id,
    })
    .returning();
  const [firstTask, secondTask] = await db
    .insert(scheduleTasks)
    .values([
      {
        scheduleId: schedule.id,
        estimatePositionId: firstPosition.id,
        startDate: "2026-09-01",
        durationDays: 1,
        orderIndex: 0,
      },
      {
        scheduleId: schedule.id,
        estimatePositionId: secondPosition.id,
        startDate: "2026-09-02",
        durationDays: 1,
        orderIndex: 1,
      },
    ])
    .returning();
  const approvedVersion = analyzed.version + 1;
  await db
    .update(executionWorkflows)
    .set({ scheduleId: schedule.id, stage: "schedule_approved", version: approvedVersion })
    .where(eq(executionWorkflows.id, workflow.id));

  const [existingCement] = await db
    .insert(projectMaterials)
    .values({ objectId: object.id, nameOverride: "ЦЕМЕНТ М500", baseUnitOverride: "кг.", paramsOverride: {} })
    .returning();

  const buildArgs = {
    workflowId: workflow.id,
    expectedVersion: approvedVersion,
    idempotencyKey: `task007-build-${suffix}`,
  };
  const built = await buildMaterialRegister(ownerAuth, buildArgs);
  let currentVersion = built.workflowVersion;
  assert.equal(built.stage, "materials_register_ready");
  assert.equal(built.items.length, 5);
  assert.equal(built.ready, false);
  assert.equal(built.blockingIssues.length, 1);

  const cement = built.items.find((item) => item.normalizedName === "цемент м500");
  const smallPump = built.items.find((item) => item.normalizedName === "насос ups 25-40");
  const largePump = built.items.find((item) => item.normalizedName === "насос ups 25-60");
  const unclassified = built.items.find((item) => item.normalizedName === "неясный ресурс");
  const positionMaterial = built.items.find((item) => item.normalizedName === "песок строительный");
  assert.ok(cement && smallPump && largePump && unclassified && positionMaterial);
  assert.equal(cement.projectMaterialId, existingCement.id, "a single exact manual project material should be reused");
  assert.deepEqual(positionMaterial.sourceLinks.map((link) => ({
    sourceType: link.sourceType,
    sourceId: link.sourceId,
    estimateResourceId: link.estimateResourceId,
    scheduleTaskId: link.scheduleTaskId,
  })), [{ sourceType: "position", sourceId: auxiliaryPosition.id, estimateResourceId: null, scheduleTaskId: firstTask.id }]);
  assert.notEqual(smallPump.registerItemId, largePump.registerItemId, "different models must not be merged");
  assert.deepEqual(
    cement.sourceLinks.map((link) => link.estimateResourceId).sort((left, right) => left! - right!),
    [cementOne.id, cementTwo.id].sort((left, right) => left - right),
  );
  assert.deepEqual(
    cement.sourceLinks.map((link) => link.scheduleTaskId).sort((left, right) => left! - right!),
    [firstTask.id, secondTask.id].sort((left, right) => left - right),
  );
  assert.deepEqual(smallPump.sourceLinks.map((link) => link.estimateResourceId), [pumpSmall.id]);
  assert.deepEqual(largePump.sourceLinks.map((link) => link.estimateResourceId), [pumpLarge.id]);
  assert.deepEqual(unclassified.sourceLinks.map((link) => link.estimateResourceId), [unknown.id]);

  const generatedLinks = await db
    .select()
    .from(taskMaterials)
    .where(inArray(taskMaterials.taskId, [firstTask.id, secondTask.id]));
  assert.equal(generatedLinks.length, 6);
  assert.ok(generatedLinks.every((link) => link.source === "material_register"));
  assert.deepEqual(
    generatedLinks
      .filter((link) => link.projectMaterialId === cement.projectMaterialId)
      .map((link) => link.taskId)
      .sort((left, right) => left - right),
    [firstTask.id, secondTask.id],
  );

  assert.deepEqual(await buildMaterialRegister(ownerAuth, buildArgs), built);
  const rebuiltNoop = await buildMaterialRegister(ownerAuth, {
    ...buildArgs,
    expectedVersion: currentVersion,
    idempotencyKey: `task007-build-again-${suffix}`,
  });
  assert.deepEqual(rebuiltNoop, built);
  assert.equal(
    (await db.select().from(materialRegisterItems).where(eq(materialRegisterItems.workflowId, workflow.id))).length,
    5,
  );
  assert.equal(
    (await db.select().from(materialRegisterSourceLinks).where(eq(materialRegisterSourceLinks.workflowId, workflow.id))).length,
    6,
  );
  assert.equal(
    (await db.select().from(projectMaterials).where(eq(projectMaterials.objectId, object.id))).length,
    5,
  );
  assert.equal(
    (await db.select().from(taskMaterials).where(inArray(taskMaterials.taskId, [firstTask.id, secondTask.id]))).length,
    6,
  );

  await assert.rejects(
    () => getMaterialRegister(otherAuth, workflow.id),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
  );
  await assert.rejects(
    () => getMissingQualityDocuments(otherAuth, workflow.id),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
  );
  await assert.rejects(
    () => confirmMaterialClassification(otherAuth, {
      workflowId: workflow.id,
      registerItemId: unclassified.registerItemId,
      classification: "material",
      expectedVersion: currentVersion,
      idempotencyKey: `task007-other-confirm-${suffix}`,
    }),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
  );

  const confirmedPosition = await confirmMaterialClassification(ownerAuth, {
    workflowId: workflow.id,
    registerItemId: positionMaterial.registerItemId,
    classification: "product",
    expectedVersion: currentVersion,
    idempotencyKey: `task007-confirm-position-${suffix}`,
  });
  currentVersion = confirmedPosition.workflowVersion;
  assert.equal(
    confirmedPosition.items.find((item) => item.registerItemId === positionMaterial.registerItemId)?.classification.method,
    "manual",
  );
  const [manualPositionRow] = await db
    .select({ fingerprint: materialRegisterItems.fingerprint })
    .from(materialRegisterItems)
    .where(eq(materialRegisterItems.id, positionMaterial.registerItemId));
  assert.equal(manualPositionRow.fingerprint, `manual:${positionMaterial.registerItemId}`);

  const confirmed = await confirmMaterialClassification(ownerAuth, {
    workflowId: workflow.id,
    registerItemId: unclassified.registerItemId,
    classification: "material",
    expectedVersion: currentVersion,
    idempotencyKey: `task007-confirm-${suffix}`,
  });
  currentVersion = confirmed.workflowVersion;
  const confirmedItem = confirmed.items.find((item) => item.registerItemId === unclassified.registerItemId);
  assert.deepEqual(confirmedItem?.classification, {
    category: "material",
    method: "manual",
    confidence: "high",
    confirmed: true,
    ruleId: null,
    reason: "Classification was confirmed or corrected manually",
  });
  assert.equal(confirmed.ready, true);

  await db
    .update(materialRegisterStates)
    .set({ inputHash: `force-rebuild-${suffix}` })
    .where(eq(materialRegisterStates.workflowId, workflow.id));
  const rebuilt = await buildMaterialRegister(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: currentVersion,
    idempotencyKey: `task007-forced-rebuild-${suffix}`,
  });
  currentVersion = rebuilt.workflowVersion;
  const manualAfterRebuild = rebuilt.items.find((item) => item.registerItemId === unclassified.registerItemId);
  assert.equal(manualAfterRebuild?.classification.category, "material");
  assert.equal(manualAfterRebuild?.classification.method, "manual");
  assert.equal(manualAfterRebuild?.classification.confirmed, true);
  assert.equal(manualAfterRebuild?.projectMaterialId, unclassified.projectMaterialId);
  const positionAfterRebuild = rebuilt.items.find((item) => item.registerItemId === positionMaterial.registerItemId);
  assert.equal(positionAfterRebuild?.projectMaterialId, positionMaterial.projectMaterialId);
  assert.equal(positionAfterRebuild?.classification.category, "product");
  assert.equal(positionAfterRebuild?.classification.method, "manual");
  assert.equal(rebuilt.items.length, 5);
  assert.equal(
    (await db.select().from(materialRegisterSourceLinks).where(eq(materialRegisterSourceLinks.workflowId, workflow.id))).length,
    6,
  );
  assert.equal(
    (await db.select().from(projectMaterials).where(eq(projectMaterials.objectId, object.id))).length,
    5,
  );
  assert.equal(
    (await db.select().from(taskMaterials).where(inArray(taskMaterials.taskId, [firstTask.id, secondTask.id]))).length,
    6,
  );

  const initiallyMissing = await getMissingQualityDocuments(ownerAuth, workflow.id);
  assert.equal(initiallyMissing.ready, false);
  assert.equal(initiallyMissing.blockingIssues.length, 0);
  assert.equal(initiallyMissing.missingRequirements.length, 5);

  const [unrelatedMaterial] = await db
    .insert(projectMaterials)
    .values({ objectId: object.id, nameOverride: "Unrelated", baseUnitOverride: "шт", paramsOverride: {} })
    .returning();
  const [wrongMaterialDoc, disabledDoc, deletedDoc, wrongRoleDoc] = await db
    .insert(documents)
    .values([
      { docType: "passport", scope: "project", objectId: object.id, title: "Wrong material passport" },
      { docType: "passport", scope: "project", objectId: object.id, title: "Disabled passport" },
      {
        docType: "passport",
        scope: "project",
        objectId: object.id,
        title: "Deleted passport",
        deletedAt: new Date(),
      },
      { docType: "passport", scope: "project", objectId: object.id, title: "Wrong role passport" },
    ])
    .returning();
  await db.insert(documentBindings).values([
    {
      documentId: wrongMaterialDoc.id,
      objectId: object.id,
      projectMaterialId: unrelatedMaterial.id,
      bindingRole: "passport",
      useInActs: true,
    },
    {
      documentId: disabledDoc.id,
      objectId: object.id,
      projectMaterialId: smallPump.projectMaterialId,
      bindingRole: "passport",
      useInActs: false,
    },
    {
      documentId: deletedDoc.id,
      objectId: object.id,
      projectMaterialId: smallPump.projectMaterialId,
      bindingRole: "passport",
      useInActs: true,
    },
    {
      documentId: wrongRoleDoc.id,
      objectId: object.id,
      projectMaterialId: smallPump.projectMaterialId,
      bindingRole: "other",
      useInActs: true,
    },
  ]);
  assert.equal((await getMissingQualityDocuments(ownerAuth, workflow.id)).missingRequirements.length, 5);

  const [pumpPassport, cementCertificate] = await db
    .insert(documents)
    .values([
      { docType: "passport", scope: "project", objectId: object.id, title: "Pump passport" },
      { docType: "certificate", scope: "project", objectId: object.id, title: "Cement certificate" },
    ])
    .returning();
  await db.insert(documentBindings).values([
    {
      documentId: pumpPassport.id,
      objectId: object.id,
      projectMaterialId: smallPump.projectMaterialId,
      bindingRole: "passport",
      useInActs: true,
    },
    {
      documentId: cementCertificate.id,
      objectId: object.id,
      projectMaterialId: cement.projectMaterialId,
      bindingRole: "quality",
      useInActs: true,
    },
  ]);
  const remaining = await getMissingQualityDocuments(ownerAuth, workflow.id);
  assert.equal(remaining.missingRequirements.length, 3);
  assert.ok(!remaining.missingRequirements.some((requirement) => requirement.projectMaterialId === smallPump.projectMaterialId));
  assert.ok(!remaining.missingRequirements.some((requirement) => requirement.projectMaterialId === cement.projectMaterialId));
  assert.deepEqual(
    remaining.missingRequirements
      .flatMap((requirement) => requirement.usedInTaskIds)
      .filter((taskId, index, all) => all.indexOf(taskId) === index)
      .sort((left, right) => left - right),
    [firstTask.id, secondTask.id],
  );

  await db
    .update(projectMaterials)
    .set({ deletedAt: new Date() })
    .where(eq(projectMaterials.id, largePump.projectMaterialId));
  await assert.rejects(
    () => getMaterialRegister(ownerAuth, workflow.id),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.MATERIAL_REGISTER_STALE,
  );
  const repaired = await buildMaterialRegister(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: currentVersion,
    idempotencyKey: `task007-repair-deleted-pm-${suffix}`,
  });
  currentVersion = repaired.workflowVersion;
  assert.notEqual(
    repaired.items.find((item) => item.normalizedName === "насос ups 25-60")?.projectMaterialId,
    largePump.projectMaterialId,
  );

  const [duplicateTask] = await db.insert(scheduleTasks).values({
    scheduleId: schedule.id,
    estimatePositionId: firstPosition.id,
    workId: null,
    startDate: "2026-09-02",
    durationDays: 1,
    orderIndex: 2,
  }).returning();
  await assert.rejects(
    () => getMaterialRegister(ownerAuth, workflow.id),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.MATERIAL_REGISTER_STALE,
  );
  await db.delete(scheduleTasks).where(eq(scheduleTasks.id, duplicateTask.id));
  assert.equal((await getMaterialRegister(ownerAuth, workflow.id)).items.length, 5);

  await db.delete(scheduleTasks).where(eq(scheduleTasks.id, secondTask.id));
  await assert.rejects(
    () => getMaterialRegister(ownerAuth, workflow.id),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.MATERIAL_REGISTER_STALE,
  );
});
