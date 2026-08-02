import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("act services: real readiness, draft/final gates, manual attachments, idempotency and owned PDF", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL not set; skipping DB-backed act generation integration test");
    return;
  }

  const { createHash } = await import("node:crypto");
  const { eq, inArray } = await import("drizzle-orm");
  const { db } = await import("../server/db.ts");
  const schema = await import("../shared/schema.ts");
  const {
    users,
    objects,
    objectParties,
    objectResponsiblePersons,
    estimates,
    estimateSections,
    estimatePositions,
    positionResources,
    estimateAnalysisSnapshots,
    schedules,
    scheduleTasks,
    executionWorkflows,
    actTemplates,
    acts,
    actMaterialUsages,
    actDocumentAttachments,
    actArtifacts,
    documents,
    documentBindings,
    projectMaterials,
    materialBatches,
    taskMaterials,
    toolIdempotencyRecords,
  } = schema;
  const {
    computeEstimateAnalysis,
    ESTIMATE_ANALYSIS_SCHEMA_VERSION,
    ESTIMATE_ANALYSIS_VERSION,
  } = await import("../server/services/estimate-analysis/computeEstimateAnalysis.ts");
  const { buildMaterialRegister } = await import("../server/services/materialRegisterService.ts");
  const { createUploadSession } = await import("../server/services/estimateUploadService.ts");
  const {
    checkActsReadiness,
    checkActsReadinessWithClient,
  } = await import("../server/services/actsReadinessService.ts");
  const { generateActs } = await import("../server/services/acts/actGenerationService.ts");
  const { exportActPdf, getOwnedArtifactFile } = await import("../server/services/actArtifactService.ts");
  const { removeActArtifactFile } = await import("../server/act-artifact-files.ts");
  const { MCP_ERROR_CODES, McpToolError } = await import("../server/mcp/errors.ts");

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const artifactRoot = await mkdtemp(path.join(os.tmpdir(), "task009-artifacts-"));
  const previousArtifactRoot = process.env.ACT_ARTIFACTS_DIR;
  process.env.ACT_ARTIFACTS_DIR = artifactRoot;

  const [owner, other] = await db.insert(users).values([
    { displayName: "TASK-009 owner", email: `task009-owner-${suffix}@test.local` },
    { displayName: "TASK-009 other", email: `task009-other-${suffix}@test.local` },
  ]).returning();
  const [object] = await db.insert(objects).values({
    title: `TASK-009 object ${suffix}`,
    address: "ул. Проверочная, 9",
    city: "Якутск",
    userId: owner.id,
  }).returning();
  const [otherObject] = await db.insert(objects).values({
    title: `TASK-009 foreign object ${suffix}`,
    address: "ул. Чужая, 1",
    city: "Якутск",
    userId: other.id,
  }).returning();
  const [estimate] = await db.insert(estimates).values({
    objectId: object.id,
    code: `TASK-009-${suffix}`,
    name: "Смета TASK-009",
  }).returning();

  t.after(async () => {
    const artifactRows = await db.select({ storageKey: actArtifacts.storageKey })
      .from(actArtifacts)
      .where(eq(actArtifacts.objectId, object.id));
    await Promise.all(artifactRows.map(({ storageKey }) => removeActArtifactFile(storageKey)));
    await db.transaction(async (tx) => {
      await tx.delete(executionWorkflows).where(inArray(executionWorkflows.objectId, [object.id, otherObject.id]));
      await tx.delete(documentBindings).where(eq(documentBindings.objectId, object.id));
      const ownedTasks = await tx.select({ id: scheduleTasks.id })
        .from(scheduleTasks)
        .innerJoin(schedules, eq(schedules.id, scheduleTasks.scheduleId))
        .where(eq(schedules.objectId, object.id));
      if (ownedTasks.length) await tx.delete(taskMaterials).where(inArray(taskMaterials.taskId, ownedTasks.map(({ id }) => id)));
      await tx.delete(documents).where(inArray(documents.objectId, [object.id, otherObject.id]));
      await tx.delete(scheduleTasks).where(inArray(scheduleTasks.id, ownedTasks.map(({ id }) => id)));
      await tx.delete(schedules).where(eq(schedules.objectId, object.id));
      await tx.delete(materialBatches).where(inArray(materialBatches.objectId, [object.id, otherObject.id]));
      await tx.delete(projectMaterials).where(inArray(projectMaterials.objectId, [object.id, otherObject.id]));
      await tx.delete(positionResources).where(inArray(
        positionResources.positionId,
        (await tx.select({ id: estimatePositions.id }).from(estimatePositions).where(eq(estimatePositions.estimateId, estimate.id))).map(({ id }) => id),
      ));
      await tx.delete(estimatePositions).where(eq(estimatePositions.estimateId, estimate.id));
      await tx.delete(estimateSections).where(eq(estimateSections.estimateId, estimate.id));
      await tx.delete(estimates).where(eq(estimates.id, estimate.id));
      await tx.delete(objectResponsiblePersons).where(eq(objectResponsiblePersons.objectId, object.id));
      await tx.delete(objectParties).where(eq(objectParties.objectId, object.id));
      await tx.delete(objects).where(eq(objects.id, object.id));
      await tx.delete(objects).where(eq(objects.id, otherObject.id));
      await tx.delete(actTemplates).where(eq(actTemplates.templateId, `task009-${suffix}`));
      await tx.delete(toolIdempotencyRecords).where(inArray(toolIdempotencyRecords.userId, [owner.id, other.id]));
      await tx.delete(users).where(inArray(users.id, [owner.id, other.id]));
    });
    if (previousArtifactRoot === undefined) delete process.env.ACT_ARTIFACTS_DIR;
    else process.env.ACT_ARTIFACTS_DIR = previousArtifactRoot;
    await rm(artifactRoot, { recursive: true, force: true });
  });

  await db.insert(objectParties).values(["customer", "builder", "designer"].map((role) => ({
    objectId: object.id,
    role,
    fullName: `${role} TASK-009`,
  })));
  await db.insert(objectResponsiblePersons).values([
    "rep_customer_control",
    "rep_builder",
    "rep_builder_control",
    "rep_designer",
    "rep_work_performer",
  ].map((role) => ({ objectId: object.id, role, personName: `${role} Иванов И.И.`, position: "Инженер" })));
  const [foreignDocument] = await db.insert(documents).values({
    docType: "passport",
    scope: "project",
    objectId: otherObject.id,
    title: "Чужой паспорт",
    createdByUserId: other.id,
    updatedByUserId: other.id,
  }).returning();

  const [section] = await db.insert(estimateSections).values({
    estimateId: estimate.id,
    number: "1",
    title: "Работы",
    orderIndex: 1,
  }).returning();
  const [position] = await db.insert(estimatePositions).values({
    estimateId: estimate.id,
    sectionId: section.id,
    lineNo: "1",
    code: "ГЭСН01-01-001",
    name: "Монтаж насоса",
    unit: "шт",
    quantity: "1",
    orderIndex: 1,
  }).returning();
  const [resource] = await db.insert(positionResources).values({
    positionId: position.id,
    resourceType: "М",
    resourceCode: "НАСОС-01",
    name: "Насос циркуляционный",
    unit: "шт",
    quantityTotal: "1",
    orderIndex: 1,
  }).returning();
  const [template] = await db.insert(actTemplates).values({
    templateId: `task009-${suffix}`,
    code: `AOSR-${suffix}`,
    category: "general",
    title: "Тестовый АОСР",
  }).returning();
  const [schedule] = await db.insert(schedules).values({
    objectId: object.id,
    title: "TASK-009 schedule",
    calendarStart: "2026-08-03",
    sourceType: "estimate",
    estimateId: estimate.id,
  }).returning();
  const [task] = await db.insert(scheduleTasks).values({
    scheduleId: schedule.id,
    estimatePositionId: position.id,
    actNumber: 1,
    actTemplateId: template.id,
    projectDrawings: "РД-1",
    normativeRefs: "СП 1.1",
    executiveSchemes: [{ title: "ИС-1" }],
    quantity: "1",
    unit: "шт",
    startDate: "2026-08-03",
    durationDays: 1,
    orderIndex: 1,
  }).returning();
  const [workflow] = await db.insert(executionWorkflows).values({
    userId: owner.id,
    objectId: object.id,
    estimateId: estimate.id,
    scheduleId: schedule.id,
    stage: "schedule_approved",
    status: "active",
    version: 7,
  }).returning();
  const [foreignWorkflow] = await db.insert(executionWorkflows).values({
    userId: other.id,
    objectId: otherObject.id,
    stage: "created",
    status: "active",
    version: 1,
  }).returning();
  const [foreignAct] = await db.insert(acts).values({
    objectId: otherObject.id,
    workflowId: foreignWorkflow.id,
    actNumber: 1,
    status: "draft",
    worksData: [],
  }).returning();

  const analysis = computeEstimateAnalysis({
    estimate,
    sections: [{ ...section, positions: [{ ...position, resources: [resource] }] }],
  });
  await db.insert(estimateAnalysisSnapshots).values({
    workflowId: workflow.id,
    estimateId: estimate.id,
    analysisVersion: ESTIMATE_ANALYSIS_VERSION,
    schemaVersion: ESTIMATE_ANALYSIS_SCHEMA_VERSION,
    inputHash: analysis.inputHash,
    analysisJson: analysis,
  });

  const ownerAuth = { userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role };
  const otherAuth = { userId: other.id, displayName: other.displayName, email: other.email, role: other.role };
  const register = await buildMaterialRegister(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: workflow.version,
    idempotencyKey: `task009-register-${suffix}`,
  });
  assert.equal(register.items.length, 1);
  assert.deepEqual(register.items[0].sourceLinks.map((link) => link.scheduleTaskId), [task.id]);
  const material = register.items[0];
  const [wrongOwnerMaterial, foreignMaterial] = await db.insert(projectMaterials).values([
    { objectId: object.id, nameOverride: "Другой материал владельца", baseUnitOverride: "шт" },
    { objectId: otherObject.id, nameOverride: "Чужой материал", baseUnitOverride: "шт" },
  ]).returning();
  const [wrongMaterialBatch, foreignBatch] = await db.insert(materialBatches).values([
    { objectId: object.id, projectMaterialId: wrongOwnerMaterial.id, batchNumber: "WRONG-MATERIAL" },
    { objectId: otherObject.id, projectMaterialId: foreignMaterial.id, batchNumber: "FOREIGN-OBJECT" },
  ]).returning();
  const upload = await createUploadSession(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: register.workflowVersion,
    idempotencyKey: `task009-awaiting-${suffix}`,
    originalFilename: "passport.pdf",
    purpose: "quality_document",
  });

  await assert.rejects(
    () => checkActsReadiness(otherAuth, workflow.id),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
  );
  const blocked = await checkActsReadiness(ownerAuth, workflow.id);
  assert.equal(blocked.ready, false);
  assert.ok(blocked.blockingIssues.some((issue) =>
    issue.code === "QUALITY_DOCUMENT_MISSING"
      && issue.entityId === material.projectMaterialId
      && (issue.details?.acceptableDocTypes as string[]).includes("passport"),
  ));

  for (const [batchId, key] of [
    [wrongMaterialBatch.id, "wrong-material"],
    [foreignBatch.id, "foreign-object"],
  ] as const) {
    await db.update(taskMaterials).set({ batchId }).where(eq(taskMaterials.taskId, task.id));
    await assert.rejects(
      () => generateActs(ownerAuth, {
        workflowId: workflow.id,
        mode: "draft",
        confirmed: false,
        expectedVersion: upload.version,
        idempotencyKey: `task009-${key}-batch-${suffix}`,
      }, { readiness: checkActsReadinessWithClient }),
      (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
    );
  }
  await db.update(taskMaterials).set({ batchId: null }).where(eq(taskMaterials.taskId, task.id));

  await db.update(taskMaterials)
    .set({ qualityDocumentId: foreignDocument.id })
    .where(eq(taskMaterials.taskId, task.id));
  await assert.rejects(
    () => generateActs(ownerAuth, {
      workflowId: workflow.id,
      mode: "draft",
      confirmed: false,
      expectedVersion: upload.version,
      idempotencyKey: `task009-foreign-explicit-doc-${suffix}`,
    }, { readiness: checkActsReadinessWithClient }),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
  );
  await db.update(taskMaterials)
    .set({ qualityDocumentId: null })
    .where(eq(taskMaterials.taskId, task.id));

  const draftArgs = {
    workflowId: workflow.id,
    mode: "draft" as const,
    confirmed: false,
    expectedVersion: upload.version,
    idempotencyKey: `task009-draft-${suffix}`,
  };
  const draft = await generateActs(ownerAuth, draftArgs, { readiness: checkActsReadinessWithClient });
  assert.equal(draft.stage, "acts_blocked");
  assert.equal(draft.acts[0].status, "draft");
  const actId = draft.acts[0].actId;

  await assert.rejects(
    () => generateActs(ownerAuth, {
      ...draftArgs,
      mode: "final",
      expectedVersion: draft.workflowVersion,
      idempotencyKey: `task009-final-unconfirmed-${suffix}`,
    }, { readiness: checkActsReadinessWithClient }),
    (error: unknown) => error instanceof McpToolError
      && error.code === MCP_ERROR_CODES.ACT_GENERATION_REQUIRES_CONFIRMATION,
  );
  await assert.rejects(
    () => generateActs(ownerAuth, {
      ...draftArgs,
      mode: "final",
      confirmed: true,
      expectedVersion: draft.workflowVersion,
      idempotencyKey: `task009-final-blocked-${suffix}`,
    }, { readiness: checkActsReadinessWithClient }),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.ACTS_NOT_READY,
  );

  const [passport] = await db.insert(documents).values({
    docType: "passport",
    scope: "project",
    objectId: object.id,
    title: "Паспорт насоса",
    docNumber: "P-009",
    fileUrl: null,
    createdByUserId: owner.id,
    updatedByUserId: owner.id,
  }).returning();
  await db.insert(documentBindings).values({
    documentId: passport.id,
    objectId: object.id,
    projectMaterialId: material.projectMaterialId,
    bindingRole: "passport",
    useInActs: true,
    isPrimary: true,
  });
  await db.insert(actDocumentAttachments).values({ actId, documentId: passport.id, orderIndex: 0 });
  await db.update(acts).set({ attachmentsManual: true }).where(eq(acts.id, actId));

  const ready = await checkActsReadiness(ownerAuth, workflow.id);
  assert.equal(ready.ready, true);
  const finalArgs = {
    workflowId: workflow.id,
    mode: "final" as const,
    confirmed: true,
    expectedVersion: draft.workflowVersion,
    idempotencyKey: `task009-final-${suffix}`,
  };
  const generated = await generateActs(ownerAuth, finalArgs, { readiness: checkActsReadinessWithClient });
  const retry = await generateActs(ownerAuth, finalArgs, { readiness: checkActsReadinessWithClient });
  assert.deepEqual(retry, generated);
  assert.equal(generated.stage, "acts_generated");
  assert.equal(generated.acts[0].status, "generated");
  assert.equal(generated.acts[0].attachmentsPreserved, true);
  assert.equal((await db.select().from(acts).where(eq(acts.workflowId, workflow.id))).length, 1);
  assert.equal((await db.select().from(actDocumentAttachments).where(eq(actDocumentAttachments.actId, actId))).length, 1);
  assert.equal((await db.select().from(actMaterialUsages).where(eq(actMaterialUsages.actId, actId))).length, 1);

  await db.update(objects).set({ address: "" }).where(eq(objects.id, object.id));
  await assert.rejects(
    () => exportActPdf(ownerAuth, {
      workflowId: workflow.id,
      actId,
      mode: "final",
      idempotencyKey: `task009-stale-readiness-pdf-${suffix}`,
    }),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.ACTS_NOT_READY,
  );
  assert.equal((await db.select().from(actArtifacts).where(eq(actArtifacts.workflowId, workflow.id))).length, 0);
  await db.update(objects).set({ address: "ул. Проверочная, 9" }).where(eq(objects.id, object.id));

  await db.update(acts).set({ status: "signed", projectDrawingsAgg: "SIGNED-IMMUTABLE" }).where(eq(acts.id, actId));
  await db.update(actMaterialUsages).set({ note: "signed-immutable" }).where(eq(actMaterialUsages.actId, actId));
  const signedAttachments = await db.select().from(actDocumentAttachments).where(eq(actDocumentAttachments.actId, actId));
  const signed = await generateActs(ownerAuth, {
    ...finalArgs,
    expectedVersion: generated.workflowVersion,
    idempotencyKey: `task009-signed-regeneration-${suffix}`,
  }, { readiness: checkActsReadinessWithClient });
  const [signedAct] = await db.select().from(acts).where(eq(acts.id, actId));
  const signedUsages = await db.select().from(actMaterialUsages).where(eq(actMaterialUsages.actId, actId));
  assert.equal(signed.acts[0].status, "signed");
  assert.equal(signedAct.status, "signed");
  assert.equal(signedAct.projectDrawingsAgg, "SIGNED-IMMUTABLE");
  assert.equal(signedUsages[0]?.note, "signed-immutable");
  assert.deepEqual(
    await db.select().from(actDocumentAttachments).where(eq(actDocumentAttachments.actId, actId)),
    signedAttachments,
  );

  const exportArgs = {
    workflowId: workflow.id,
    actId,
    mode: "final" as const,
    idempotencyKey: `task009-pdf-${suffix}`,
  };
  const artifact = await exportActPdf(ownerAuth, exportArgs);
  assert.deepEqual(await exportActPdf(ownerAuth, exportArgs), artifact);
  assert.equal((await db.select().from(actArtifacts).where(eq(actArtifacts.workflowId, workflow.id))).length, 1);
  const ownedFile = await getOwnedArtifactFile(ownerAuth, artifact.artifactId);
  assert.equal(ownedFile.buffer.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.equal(createHash("sha256").update(ownedFile.buffer).digest("hex"), artifact.sha256);
  await assert.rejects(
    () => getOwnedArtifactFile(otherAuth, artifact.artifactId),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.ARTIFACT_NOT_OWNED,
  );
  await assert.rejects(
    () => exportActPdf(ownerAuth, {
      ...exportArgs,
      actId: foreignAct.id,
      mode: "draft",
      idempotencyKey: `task009-foreign-act-pdf-${suffix}`,
    }),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.ARTIFACT_NOT_OWNED,
  );
});
