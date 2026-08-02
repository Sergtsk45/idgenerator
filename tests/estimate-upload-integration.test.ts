import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import * as XLSX from "xlsx";

test("estimate upload/import: ownership, expiry, consumption and idempotency", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL not set; skipping DB-backed estimate upload integration test");
    return;
  }

  const uploadRoot = await mkdtemp(path.join(os.tmpdir(), "mcp-estimate-integration-"));
  const previousRoot = process.env.ESTIMATE_UPLOAD_DIR;
  process.env.ESTIMATE_UPLOAD_DIR = uploadRoot;
  try {
    const { db } = await import("../server/db.ts");
    const { users, objects, uploadSessions, estimates } = await import("../shared/schema.ts");
    const { eq } = await import("drizzle-orm");
    const workflowService = await import("../server/services/execution-workflow/workflowService.ts");
    const uploadService = await import("../server/services/estimateUploadService.ts");
    const { ESTIMATE_XLSX_MIME } = await import("../server/estimate-upload-files.ts");
    const { McpToolError, MCP_ERROR_CODES } = await import("../server/mcp/errors.ts");

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [owner] = await db.insert(users).values({ displayName: "Upload owner", email: `upload-owner-${suffix}@test.local` }).returning();
    const [other] = await db.insert(users).values({ displayName: "Upload other", email: `upload-other-${suffix}@test.local` }).returning();
    const [object] = await db.insert(objects).values({ title: `Upload object ${suffix}`, userId: owner.id }).returning();
    const ownerAuth = { userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role };
    const otherAuth = { userId: other.id, displayName: other.displayName, email: other.email, role: other.role };

    const workflow = await workflowService.createExecutionWorkflow(ownerAuth, {
      objectId: object.id,
      idempotencyKey: `workflow-${suffix}`,
    });
    const createArgs = {
      workflowId: workflow.workflowId,
      expectedVersion: workflow.version,
      idempotencyKey: `upload-${suffix}`,
      originalFilename: "fixture.xlsx",
    };
    const session = await uploadService.createEstimateUploadSession(ownerAuth, createArgs);
    const sessionRetry = await uploadService.createEstimateUploadSession(ownerAuth, createArgs);
    assert.equal(sessionRetry.uploadId, session.uploadId);
    assert.equal(session.stage, "estimate_upload_pending");

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["№ п/п", "Обоснование", "Наименование работ и затрат"],
        ["1", "ГЭСН01-01-001-01", "Разработка грунта"],
      ]),
      "ЛСР",
    );
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const file = { originalname: "fixture.xlsx", mimetype: ESTIMATE_XLSX_MIME, buffer, size: buffer.length };

    await assert.rejects(
      () => uploadService.storeEstimateUpload(otherAuth, session.uploadId, file),
      (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.UPLOAD_NOT_FOUND,
    );
    const uploaded = await uploadService.storeEstimateUpload(ownerAuth, session.uploadId, file);
    assert.equal(uploaded.status, "uploaded");

    const importArgs = {
      workflowId: workflow.workflowId,
      uploadId: session.uploadId,
      expectedVersion: session.version,
      idempotencyKey: `import-${suffix}`,
    };
    await assert.rejects(
      () => uploadService.importEstimateFromUpload(otherAuth, importArgs),
      (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.UPLOAD_NOT_FOUND,
    );
    const imported = await uploadService.importEstimateFromUpload(ownerAuth, importArgs);
    const retried = await uploadService.importEstimateFromUpload(ownerAuth, importArgs);
    assert.equal(retried.estimateId, imported.estimateId);
    assert.equal(imported.stage, "estimate_imported");
    assert.equal((await db.select().from(estimates).where(eq(estimates.objectId, object.id))).length, 1);
    assert.equal((await db.select().from(uploadSessions).where(eq(uploadSessions.id, session.uploadId)))[0].status, "consumed");

    await assert.rejects(
      () => uploadService.importEstimateFromUpload(ownerAuth, { ...importArgs, idempotencyKey: `second-${suffix}` }),
      (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.UPLOAD_ALREADY_CONSUMED,
    );

    const workflow2 = await workflowService.createExecutionWorkflow(ownerAuth, {
      objectId: object.id,
      idempotencyKey: `workflow-expired-${suffix}`,
    });
    const expired = await uploadService.createEstimateUploadSession(ownerAuth, {
      workflowId: workflow2.workflowId,
      expectedVersion: workflow2.version,
      idempotencyKey: `upload-expired-${suffix}`,
      originalFilename: "expired.xlsx",
    });
    await db.update(uploadSessions).set({ expiresAt: new Date(0) }).where(eq(uploadSessions.id, expired.uploadId));
    await assert.rejects(
      () => uploadService.storeEstimateUpload(ownerAuth, expired.uploadId, { ...file, originalname: "expired.xlsx" }),
      (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.UPLOAD_EXPIRED,
    );
  } finally {
    if (previousRoot === undefined) delete process.env.ESTIMATE_UPLOAD_DIR;
    else process.env.ESTIMATE_UPLOAD_DIR = previousRoot;
    await rm(uploadRoot, { recursive: true, force: true });
  }
});
