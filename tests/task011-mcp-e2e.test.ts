import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

function parseJsonRpcResponse(text: string): any {
  const trimmed = text.trim();
  if (trimmed.startsWith("data:")) {
    const payload = trimmed
      .split("\n")
      .map((line) => line.startsWith("data:") ? line.slice("data:".length).trimStart() : "")
      .filter(Boolean)
      .join("");
    return JSON.parse(payload);
  }
  return JSON.parse(trimmed);
}

async function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function callMcp(url: string, body: unknown, bearer?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  return { status: res.status, text: await res.text() };
}

test("TASK-011 MCP discovery and end-to-end workflow smoke", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL not set; skipping DB-backed TASK-011 integration test");
    return;
  }

  const { db, pool } = await import("../server/db.ts");
  const { eq, inArray } = await import("drizzle-orm");
  const {
    users,
    objects,
    objectParties,
    objectResponsiblePersons,
    estimates,
    estimateSections,
    estimatePositions,
    positionResources,
    actTemplates,
    schedules,
    scheduleTasks,
    acts,
    executionWorkflows,
    uploadSessions,
    projectMaterials,
    documents,
    toolIdempotencyRecords,
    actArtifacts,
    executionPackages,
  } = await import("../shared/schema.ts");
  const { authService } = await import("../server/auth-service.ts");
  const { handleMcpRequest, mcpBodyErrorHandler, mcpBodyParser, mcpRateLimiter } = await import("../server/mcp/httpTransport.ts");
  const { createUploadSession, storeMcpUpload } = await import("../server/services/estimateUploadService.ts");
  const { analyzeEstimate } = await import("../server/services/estimateAnalysisService.ts");
  const { setWorkflowInput } = await import("../server/services/execution-workflow/workflowService.ts");
  const { calculateScheduleDraft, approveSchedule } = await import("../server/services/schedulePlanningService.ts");
  const { buildMaterialRegister } = await import("../server/services/materialRegisterService.ts");
  const { attachDocumentFromUpload } = await import("../server/services/documentIngestionService.ts");
  const { checkActsReadiness, checkActsReadinessWithClient } = await import("../server/services/actsReadinessService.ts");
  const { generateActs } = await import("../server/services/acts/actGenerationService.ts");
  const { exportActPdf, exportActAttachments } = await import("../server/services/actArtifactService.ts");
  const { generateWorklogDraft } = await import("../server/services/worklogDraftService.ts");
  const { buildExecutionPackage } = await import("../server/services/executionPackageService.ts");
  const { removeExecutionPackageFile } = await import("../server/services/execution-package/executionPackageFiles.ts");
  const { removeActArtifactFile } = await import("../server/act-artifact-files.ts");
  const { removeDocumentFile } = await import("../server/document-files.ts");
  const { removeQualityDocumentUpload } = await import("../server/quality-document-upload-files.ts");

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const uploadsRoot = await mkdtemp(path.join(os.tmpdir(), "task011-uploads-"));
  const packageRoot = await mkdtemp(path.join(os.tmpdir(), "task011-packages-"));
  const previousUploadsRoot = process.env.ESTIMATE_UPLOAD_DIR;
  const previousPackagesRoot = process.env.EXECUTION_PACKAGES_DIR;
  process.env.ESTIMATE_UPLOAD_DIR = uploadsRoot;
  process.env.EXECUTION_PACKAGES_DIR = packageRoot;

  const app = express();
  app.all("/mcp", mcpRateLimiter, mcpBodyParser, mcpBodyErrorHandler, handleMcpRequest);
  const { server, baseUrl } = await listen(app);
  const mcpUrl = `${baseUrl}/mcp`;

  const [owner, other] = await db.insert(users).values([
    { displayName: "TASK-011 owner", email: `task011-owner-${suffix}@test.local` },
    { displayName: "TASK-011 other", email: `task011-other-${suffix}@test.local` },
  ]).returning();
  const ownerAuth = { userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role };
  const otherAuth = { userId: other.id, displayName: other.displayName, email: other.email, role: other.role };
  const ownerToken = await authService.generateJWT(owner.id, owner.role);

  const [object] = await db.insert(objects).values({
    title: `TASK-011 object ${suffix}`,
    address: "ул. Промышленная, 1",
    city: "Якутск",
    userId: owner.id,
  }).returning();
  const [estimate] = await db.insert(estimates).values({
    objectId: object.id,
    code: `TASK-011-${suffix}`,
    name: "TASK-011 estimate",
  }).returning();
  await db.insert(objectParties).values(["customer", "builder", "designer"].map((role) => ({
    objectId: object.id,
    role,
    fullName: `${role} TASK-011`,
  })));
  await db.insert(objectResponsiblePersons).values([
    "rep_customer_control",
    "rep_builder",
    "rep_builder_control",
    "rep_designer",
    "rep_work_performer",
  ].map((role) => ({ objectId: object.id, role, personName: `${role} Иванов И.И.`, position: "Инженер" })));

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
    name: "Монтаж насоса",
    unit: "шт",
    quantity: "1",
    orderIndex: 1,
  }).returning();
  await db.insert(positionResources).values({
    positionId: position.id,
    resourceType: "ОТ",
    name: "Монтажник",
    unit: "чел.-ч",
    quantityTotal: "8",
    orderIndex: 1,
  });

  const [workflow] = await db.insert(executionWorkflows).values({
    userId: owner.id,
    objectId: object.id,
    estimateId: estimate.id,
    stage: "estimate_imported",
    status: "active",
    version: 1,
  }).returning();

  const [actTemplate] = await db.insert(actTemplates).values({
    templateId: `task011-${suffix}`,
    code: `AOSR-${suffix}`,
    category: "general",
    title: "TASK-011 act template",
  }).returning();

  t.after(async () => {
    const packageRows = await db.select({ storageKey: executionPackages.storageKey }).from(executionPackages).where(eq(executionPackages.workflowId, workflow.id));
    const artifactRows = await db.select({ storageKey: actArtifacts.storageKey }).from(actArtifacts).where(eq(actArtifacts.workflowId, workflow.id));
    const documentRows = await db.select({ fileUrl: documents.fileUrl }).from(documents).where(eq(documents.objectId, object.id));
    const qualityUploads = await db.select({ storageKey: uploadSessions.storageKey }).from(uploadSessions).where(eq(uploadSessions.workflowId, workflow.id));

    await Promise.all([
      ...packageRows.map(({ storageKey }) => removeExecutionPackageFile(storageKey).catch(() => undefined)),
      ...artifactRows.map(({ storageKey }) => removeActArtifactFile(storageKey).catch(() => undefined)),
      ...documentRows.filter(({ fileUrl }) => Boolean(fileUrl)).map(({ fileUrl }) => removeDocumentFile(fileUrl!).catch(() => undefined)),
      ...qualityUploads.filter(({ storageKey }) => Boolean(storageKey)).map(({ storageKey }) => removeQualityDocumentUpload(storageKey!).catch(() => undefined)),
    ]);

    await db.transaction(async (tx) => {
      await tx.delete(executionWorkflows).where(eq(executionWorkflows.id, workflow.id));
      await tx.delete(scheduleTasks).where(eq(scheduleTasks.scheduleId, approved.scheduleId));
      await tx.delete(schedules).where(eq(schedules.id, approved.scheduleId));
      await tx.delete(estimatePositions).where(eq(estimatePositions.estimateId, estimate.id));
      await tx.delete(estimateSections).where(eq(estimateSections.estimateId, estimate.id));
      await tx.delete(estimates).where(eq(estimates.id, estimate.id));
      await tx.delete(objectResponsiblePersons).where(eq(objectResponsiblePersons.objectId, object.id));
      await tx.delete(objectParties).where(eq(objectParties.objectId, object.id));
      await tx.delete(objects).where(eq(objects.id, object.id));
      await tx.delete(actTemplates).where(eq(actTemplates.id, actTemplate.id));
      await tx.delete(projectMaterials).where(eq(projectMaterials.objectId, object.id));
      await tx.delete(documents).where(eq(documents.objectId, object.id));
      await tx.delete(toolIdempotencyRecords).where(inArray(toolIdempotencyRecords.userId, [owner.id, other.id]));
      await tx.delete(users).where(inArray(users.id, [owner.id, other.id]));
    });

    if (previousUploadsRoot === undefined) delete process.env.ESTIMATE_UPLOAD_DIR;
    else process.env.ESTIMATE_UPLOAD_DIR = previousUploadsRoot;
    if (previousPackagesRoot === undefined) delete process.env.EXECUTION_PACKAGES_DIR;
    else process.env.EXECUTION_PACKAGES_DIR = previousPackagesRoot;
    await rm(uploadsRoot, { recursive: true, force: true });
    await rm(packageRoot, { recursive: true, force: true });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  });

  const analyzed = await analyzeEstimate(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: workflow.version,
    idempotencyKey: `task011-analyze-${suffix}`,
  });
  let currentVersion = analyzed.version;
  const setInput = async (key: "projectStartDate" | "workingCalendar" | "planningMode" | "targetDurationDays", value: string | number) => {
    const result = await setWorkflowInput(ownerAuth, {
      workflowId: workflow.id,
      expectedVersion: currentVersion,
      idempotencyKey: `task011-input-${key}-${suffix}`,
      key,
      value,
      source: "user",
      confirmed: true,
    });
    currentVersion = result.version;
    return result;
  };
  await setInput("projectStartDate", "2026-08-05");
  await setInput("workingCalendar", "5x2");
  await setInput("planningMode", "target_duration");
  await setInput("targetDurationDays", 3);
  const scheduleDraft = await calculateScheduleDraft(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: currentVersion,
    idempotencyKey: `task011-calculate-${suffix}`,
  });
  currentVersion = scheduleDraft.workflowVersion;
  const approved = await approveSchedule(ownerAuth, {
    workflowId: workflow.id,
    draftVersion: scheduleDraft.draftVersion,
    expectedVersion: currentVersion,
    idempotencyKey: `task011-approve-${suffix}`,
  });
  currentVersion = approved.workflowVersion;
  const scheduleId = approved.scheduleId;

  await db.update(scheduleTasks).set({
    actNumber: 1,
    actTemplateId: actTemplate.id,
    projectDrawings: "РД-1",
    normativeRefs: "СП 1.1",
    executiveSchemes: [{ title: "ИС-1" }],
  }).where(eq(scheduleTasks.scheduleId, scheduleId));

  const builtRegister = await buildMaterialRegister(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: currentVersion,
    idempotencyKey: `task011-register-${suffix}`,
  });
  currentVersion = builtRegister.workflowVersion;
  const registerItem = builtRegister.items[0];
  assert.ok(registerItem);

  const pdf = Buffer.from("%PDF-1.7\nTASK-011 fixture\n%%EOF");
  const uploadSession = await createUploadSession(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: currentVersion,
    idempotencyKey: `task011-upload-${suffix}`,
    originalFilename: "passport.pdf",
    purpose: "quality_document",
  });
  await storeMcpUpload(ownerAuth, uploadSession.uploadId, {
    originalname: "passport.pdf",
    mimetype: "application/pdf",
    buffer: pdf,
    size: pdf.length,
  });
  const attached = await attachDocumentFromUpload(ownerAuth, {
    workflowId: workflow.id,
    uploadId: uploadSession.uploadId,
    projectMaterialId: registerItem.projectMaterialId,
    docType: "passport",
    title: "Паспорт изделия",
    docNumber: "P-011",
    docDate: "2026-08-05",
    useInActs: true,
    expectedVersion: uploadSession.version,
    idempotencyKey: `task011-attach-${suffix}`,
  });
  currentVersion = attached.version;

  const readiness = await checkActsReadiness(ownerAuth, workflow.id);
  assert.equal(readiness.ready, true);

  const generatedActs = await generateActs(ownerAuth, {
    workflowId: workflow.id,
    mode: "final",
    confirmed: true,
    expectedVersion: currentVersion,
    idempotencyKey: `task011-acts-${suffix}`,
  }, { readiness: checkActsReadinessWithClient });
  currentVersion = generatedActs.workflowVersion;
  assert.equal(generatedActs.stage, "acts_generated");
  assert.equal(generatedActs.actNumbers[0], 1);

  const act = (await db.select().from(acts).where(eq(acts.workflowId, workflow.id))).at(0)!;
  const actPdf = await exportActPdf(ownerAuth, {
    workflowId: workflow.id,
    actId: act.id,
    mode: "final",
    idempotencyKey: `task011-act-pdf-${suffix}`,
  });
  const actAttachments = await exportActAttachments(ownerAuth, {
    workflowId: workflow.id,
    actId: act.id,
    mode: "final",
    idempotencyKey: `task011-act-attachments-${suffix}`,
  });

  const worklog = await generateWorklogDraft(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: currentVersion,
    idempotencyKey: `task011-worklog-${suffix}`,
  });
  currentVersion = worklog.workflowVersion;
  const packageResult = await buildExecutionPackage(ownerAuth, {
    workflowId: workflow.id,
    mode: "final",
    confirmFinal: true,
    expectedVersion: currentVersion,
    idempotencyKey: `task011-package-${suffix}`,
  });
  assert.equal(packageResult.mode, "final");
  assert.equal(packageResult.manifest.readyForFinal, true);
  assert.equal(packageResult.stage, "package_ready");
  assert.ok(actPdf.sizeBytes > 0);
  assert.ok(actAttachments.sizeBytes > 0);

  const initialize = await callMcp(mcpUrl, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "task011", version: "0" } },
  });
  assert.equal(initialize.status, 200);

  const resourcesList = await callMcp(mcpUrl, {
    jsonrpc: "2.0",
    id: 2,
    method: "resources/list",
    params: {},
  }, ownerToken);
  const resources = parseJsonRpcResponse(resourcesList.text).result.resources;
  assert.ok(resources.some((resource: any) => resource.uri === `idgenerator://workflow/${workflow.id}/status`));
  assert.ok(resources.some((resource: any) => resource.uri === `idgenerator://workflow/${workflow.id}/schedule-draft`));
  assert.ok(resources.some((resource: any) => resource.uri === `idgenerator://workflow/${workflow.id}/material-readiness`));
  assert.ok(resources.some((resource: any) => resource.uri === `idgenerator://workflow/${workflow.id}/acts-readiness`));

  const promptList = await callMcp(mcpUrl, {
    jsonrpc: "2.0",
    id: 3,
    method: "prompts/list",
    params: {},
  }, ownerToken);
  const prompts = parseJsonRpcResponse(promptList.text).result.prompts;
  assert.ok(prompts.some((prompt: any) => prompt.name === "execution_documentation_workflow"));

  const promptGet = await callMcp(mcpUrl, {
    jsonrpc: "2.0",
    id: 4,
    method: "prompts/get",
    params: { name: "execution_documentation_workflow", arguments: { workflowId: workflow.id } },
  }, ownerToken);
  const prompt = parseJsonRpcResponse(promptGet.text).result;
  assert.equal(prompt.messages[0].role, "user");
  assert.match(prompt.messages[0].content.text, /execution_documentation_workflow v1/);
  assert.match(prompt.messages[1].content.text, new RegExp(`"workflowId":\\s*${workflow.id}`));

  const statusRead = await callMcp(mcpUrl, {
    jsonrpc: "2.0",
    id: 5,
    method: "resources/read",
    params: { uri: `idgenerator://workflow/${workflow.id}/status` },
  }, ownerToken);
  const statusPayload = JSON.parse(parseJsonRpcResponse(statusRead.text).result.contents[0].text);
  assert.equal(statusPayload.content.stage, "package_ready");
  assert.equal(statusPayload.content.ready, true);

  const actsRead = await callMcp(mcpUrl, {
    jsonrpc: "2.0",
    id: 6,
    method: "resources/read",
    params: { uri: `idgenerator://workflow/${workflow.id}/acts-readiness` },
  }, ownerToken);
  const actsPayload = JSON.parse(parseJsonRpcResponse(actsRead.text).result.contents[0].text);
  assert.equal(actsPayload.content.ready, true);
  assert.equal(actsPayload.content.workflow.stage, "package_ready");

  await assert.rejects(
    () => buildExecutionPackage(otherAuth, {
      workflowId: workflow.id,
      mode: "final",
      confirmFinal: true,
      expectedVersion: currentVersion,
      idempotencyKey: `task011-foreign-package-${suffix}`,
    }),
    (error: unknown) => error instanceof Error,
  );
});
