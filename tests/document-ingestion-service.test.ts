import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("quality document ingestion: ownership, retry, multiple documents, missing delta and visibility", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL not set; skipping DB-backed quality document ingestion test");
    return;
  }

  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "task008-staging-"));
  const documentsRoot = await mkdtemp(path.join(os.tmpdir(), "task008-documents-"));
  const previousStagingRoot = process.env.QUALITY_DOCUMENT_UPLOAD_DIR;
  const previousDocumentsRoot = process.env.DOCUMENTS_UPLOAD_DIR;
  process.env.QUALITY_DOCUMENT_UPLOAD_DIR = stagingRoot;
  process.env.DOCUMENTS_UPLOAD_DIR = documentsRoot;

  const { db } = await import("../server/db.ts");
  const { eq, inArray } = await import("drizzle-orm");
  const {
    documentBindings,
    documents,
    estimates,
    estimatePositions,
    estimateSections,
    executionWorkflows,
    objects,
    positionResources,
    projectMaterials,
    schedules,
    scheduleTasks,
    taskMaterials,
    toolIdempotencyRecords,
    uploadSessions,
    users,
  } = await import("../shared/schema.ts");
  const { analyzeEstimate } = await import("../server/services/estimateAnalysisService.ts");
  const { createUploadSession, storeMcpUpload } = await import("../server/services/estimateUploadService.ts");
  const { attachDocumentFromUpload, listMaterialDocuments } = await import("../server/services/documentIngestionService.ts");
  const { buildMaterialRegister, getMissingQualityDocuments } = await import("../server/services/materialRegisterService.ts");
  const { QUALITY_DOCUMENT_PDF_MIME } = await import("../server/quality-document-upload-files.ts");
  const { resolveDocumentFile } = await import("../server/document-files.ts");
  const { storage } = await import("../server/storage.ts");
  const { McpToolError, MCP_ERROR_CODES } = await import("../server/mcp/errors.ts");

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [owner, other] = await db.insert(users).values([
    { displayName: "TASK-008 owner", email: `task008-owner-${suffix}@test.local` },
    { displayName: "TASK-008 other", email: `task008-other-${suffix}@test.local` },
  ]).returning();
  const [ownedObject, otherObject] = await db.insert(objects).values([
    { title: `TASK-008 object ${suffix}`, userId: owner.id },
    { title: `TASK-008 foreign object ${suffix}`, userId: other.id },
  ]).returning();
  const [estimate] = await db.insert(estimates).values({
    objectId: ownedObject.id,
    code: `TASK008-${suffix}`,
    name: "TASK-008 fixture",
  }).returning();
  const [section] = await db.insert(estimateSections).values({
    estimateId: estimate.id,
    number: "1",
    title: "Main works",
    orderIndex: 1,
  }).returning();
  const [position] = await db.insert(estimatePositions).values({
    estimateId: estimate.id,
    sectionId: section.id,
    lineNo: "1",
    code: "ГЭСН01-01-001",
    name: "Concrete work",
    unit: "м3",
    quantity: "10",
    orderIndex: 1,
  }).returning();
  await db.insert(positionResources).values({
    positionId: position.id,
    resourceType: "М",
    name: "Цемент",
    unit: "кг",
    quantityTotal: "10",
    orderIndex: 1,
  });
  const [workflow] = await db.insert(executionWorkflows).values({
    userId: owner.id,
    objectId: ownedObject.id,
    estimateId: estimate.id,
    stage: "estimate_imported",
    status: "active",
    version: 1,
  }).returning();
  const [secondMaterial, foreignMaterial] = await db.insert(projectMaterials).values([
    { objectId: ownedObject.id, nameOverride: "Песок", baseUnitOverride: "м3", paramsOverride: {} },
    { objectId: otherObject.id, nameOverride: "Чужой материал", baseUnitOverride: "шт", paramsOverride: {} },
  ]).returning();

  const ownerAuth = { userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role };
  const otherAuth = { userId: other.id, displayName: other.displayName, email: other.email, role: other.role };

  const analyzed = await analyzeEstimate(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: workflow.version,
    idempotencyKey: `task008-analyze-${suffix}`,
  });
  const [schedule] = await db.insert(schedules).values({
    objectId: ownedObject.id,
    title: `TASK-008 schedule ${suffix}`,
    calendarStart: "2026-08-01",
    sourceType: "estimate",
    estimateId: estimate.id,
  }).returning();
  const [scheduleTask] = await db.insert(scheduleTasks).values({
    scheduleId: schedule.id,
    estimatePositionId: position.id,
    startDate: "2026-08-01",
    durationDays: 1,
    orderIndex: 0,
  }).returning();
  const approvedVersion = analyzed.version + 1;
  await db.update(executionWorkflows).set({
    scheduleId: schedule.id,
    stage: "schedule_approved",
    version: approvedVersion,
  }).where(eq(executionWorkflows.id, workflow.id));
  const built = await buildMaterialRegister(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: approvedVersion,
    idempotencyKey: `task008-build-${suffix}`,
  });
  assert.equal(built.items.length, 1);
  const material = built.items[0];
  assert.ok(material);

  t.after(async () => {
    await db.transaction(async (tx) => {
      await tx.delete(executionWorkflows).where(eq(executionWorkflows.id, workflow.id));
      await tx.delete(documentBindings).where(eq(documentBindings.objectId, ownedObject.id));
      await tx.delete(documents).where(eq(documents.objectId, ownedObject.id));
      await tx.delete(taskMaterials).where(eq(taskMaterials.taskId, scheduleTask.id));
      await tx.delete(scheduleTasks).where(eq(scheduleTasks.scheduleId, schedule.id));
      await tx.delete(schedules).where(eq(schedules.id, schedule.id));
      await tx.delete(projectMaterials).where(inArray(projectMaterials.id, [material.projectMaterialId, secondMaterial.id, foreignMaterial.id]));
      await tx.delete(positionResources).where(eq(positionResources.positionId, position.id));
      await tx.delete(estimatePositions).where(eq(estimatePositions.estimateId, estimate.id));
      await tx.delete(estimateSections).where(eq(estimateSections.estimateId, estimate.id));
      await tx.delete(estimates).where(eq(estimates.id, estimate.id));
      await tx.delete(objects).where(inArray(objects.id, [ownedObject.id, otherObject.id]));
      await tx.delete(toolIdempotencyRecords).where(inArray(toolIdempotencyRecords.userId, [owner.id, other.id]));
      await tx.delete(users).where(inArray(users.id, [owner.id, other.id]));
    });
    if (previousStagingRoot === undefined) delete process.env.QUALITY_DOCUMENT_UPLOAD_DIR;
    else process.env.QUALITY_DOCUMENT_UPLOAD_DIR = previousStagingRoot;
    if (previousDocumentsRoot === undefined) delete process.env.DOCUMENTS_UPLOAD_DIR;
    else process.env.DOCUMENTS_UPLOAD_DIR = previousDocumentsRoot;
    await rm(stagingRoot, { recursive: true, force: true });
    await rm(documentsRoot, { recursive: true, force: true });
  });

  const missingBefore = await getMissingQualityDocuments(ownerAuth, workflow.id);
  assert.equal(missingBefore.missingRequirements.length, 1);

  const pdf = Buffer.from("%PDF-1.7\nTASK-008 fixture\n%%EOF");
  const firstSession = await createUploadSession(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: built.workflowVersion,
    idempotencyKey: `task008-session-1-${suffix}`,
    originalFilename: "passport-one.pdf",
    purpose: "quality_document",
  });
  const firstFile = {
    originalname: "passport-one.pdf",
    mimetype: QUALITY_DOCUMENT_PDF_MIME,
    buffer: pdf,
    size: pdf.length,
  };
  await assert.rejects(
    () => storeMcpUpload(otherAuth, firstSession.uploadId, firstFile),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.UPLOAD_NOT_FOUND,
  );
  await storeMcpUpload(ownerAuth, firstSession.uploadId, firstFile);

  const firstArgs = {
    workflowId: workflow.id,
    uploadId: firstSession.uploadId,
    projectMaterialId: material.projectMaterialId,
    docType: "passport" as const,
    title: "Паспорт №1",
    docNumber: "P-1",
    docDate: "2026-08-01",
    useInActs: true,
    expectedVersion: firstSession.version,
    idempotencyKey: `task008-attach-1-${suffix}`,
  };
  await assert.rejects(
    () => attachDocumentFromUpload(otherAuth, firstArgs),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
  );
  const firstAttached = await attachDocumentFromUpload(ownerAuth, firstArgs);
  const firstRetry = await attachDocumentFromUpload(ownerAuth, firstArgs);
  const semanticRetry = await attachDocumentFromUpload(ownerAuth, {
    ...firstArgs,
    idempotencyKey: `task008-attach-1-semantic-retry-${suffix}`,
  });
  assert.equal(firstRetry.documentId, firstAttached.documentId);
  assert.equal(semanticRetry.documentId, firstAttached.documentId);
  assert.deepEqual(firstAttached.missingDocumentDelta, {
    beforeCount: 1,
    afterCount: 0,
    resolvedRequirements: [{
      registerItemId: material.registerItemId,
      projectMaterialId: material.projectMaterialId,
      ruleId: "mvp-material-quality-document-v1",
    }],
  });
  assert.equal(firstAttached.missingQualityDocuments.missingRequirements.length, 0);
  assert.equal((await db.select().from(documents).where(eq(documents.objectId, ownedObject.id))).length, 1);
  assert.equal((await db.select().from(documentBindings).where(eq(documentBindings.projectMaterialId, material.projectMaterialId))).length, 1);

  await assert.rejects(
    () => attachDocumentFromUpload(ownerAuth, {
      ...firstArgs,
      projectMaterialId: secondMaterial.id,
      expectedVersion: firstAttached.version,
      idempotencyKey: `task008-rebind-${suffix}`,
    }),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.DOCUMENT_ALREADY_ATTACHED,
  );

  const secondSession = await createUploadSession(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: firstAttached.version,
    idempotencyKey: `task008-session-2-${suffix}`,
    originalFilename: "passport-two.pdf",
    purpose: "quality_document",
  });
  await storeMcpUpload(ownerAuth, secondSession.uploadId, {
    originalname: "passport-two.pdf",
    mimetype: QUALITY_DOCUMENT_PDF_MIME,
    buffer: pdf,
    size: pdf.length,
  });
  await attachDocumentFromUpload(ownerAuth, {
    ...firstArgs,
    uploadId: secondSession.uploadId,
    title: "Паспорт №2",
    docNumber: "P-2",
    expectedVersion: secondSession.version,
    idempotencyKey: `task008-attach-2-${suffix}`,
  });

  const listed = await listMaterialDocuments(ownerAuth, workflow.id, material.projectMaterialId);
  assert.equal(listed.documents.length, 2, "multiple passports on one material remain valid");
  assert.equal((await getMissingQualityDocuments(ownerAuth, workflow.id)).missingRequirements.length, 0);
  await assert.rejects(
    () => listMaterialDocuments(otherAuth, workflow.id, material.projectMaterialId),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
  );

  const visibleDocument = await storage.getProjectDocument(firstAttached.documentId, owner.id, ownedObject.id);
  const hiddenDocument = await storage.getProjectDocument(firstAttached.documentId, other.id, ownedObject.id);
  assert.ok(visibleDocument?.fileUrl);
  assert.equal(hiddenDocument, undefined);
  const fileMatch = /^\/api\/documents\/files\/(\d+)\/([^/]+)$/.exec(visibleDocument.fileUrl!);
  assert.ok(fileMatch);
  assert.equal(await readFile(resolveDocumentFile(Number(fileMatch[1]), fileMatch[2]), "utf8"), pdf.toString("utf8"));

  const consumed = await db.select().from(uploadSessions).where(eq(uploadSessions.id, firstSession.uploadId));
  assert.equal(consumed[0]?.documentId, firstAttached.documentId);
  assert.equal(consumed[0]?.projectMaterialId, material.projectMaterialId);
});
