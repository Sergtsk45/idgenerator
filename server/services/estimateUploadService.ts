import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { uploadSessions, type UploadSession } from "@shared/schema";
import type { McpAuthContext } from "../mcp/authContext";
import { MCP_ERROR_CODES, McpToolError } from "../mcp/errors";
import { db } from "../db";
import {
  ESTIMATE_UPLOAD_MAX_BYTES,
  ESTIMATE_XLSX_MIME,
  isXlsx,
  isXlsxFilename,
  newEstimateStorageKey,
  readEstimateUpload,
  removeEstimateUpload,
  saveEstimateUpload,
} from "../estimate-upload-files";
import { parseEstimateWorkbook } from "../../client/src/lib/estimateParser";
import { importEstimateWithClient } from "./estimateImportService";
import { assertTransitionAllowed } from "./execution-workflow/workflowStateMachine";
import * as workflowRepo from "./execution-workflow/workflowRepository";
import { loadOwnedWorkflow, withIdempotency } from "./execution-workflow/workflowService";

const UPLOAD_TTL_MS = 30 * 60 * 1000;

function uploadNotFound(): McpToolError {
  return new McpToolError(MCP_ERROR_CODES.UPLOAD_NOT_FOUND, "Upload session not found");
}

async function getOwnedUpload(auth: McpAuthContext, uploadId: string): Promise<UploadSession> {
  const [session] = await db.select().from(uploadSessions).where(eq(uploadSessions.id, uploadId));
  if (!session || session.userId !== auth.userId) throw uploadNotFound();
  return session;
}

export interface CreateUploadSessionArgs {
  workflowId: number;
  expectedVersion: number;
  idempotencyKey: string;
  originalFilename: string;
}

export async function createEstimateUploadSession(auth: McpAuthContext, args: CreateUploadSessionArgs) {
  const originalFilename = path.basename(args.originalFilename);
  if (originalFilename !== args.originalFilename || !isXlsxFilename(originalFilename)) {
    throw new McpToolError(MCP_ERROR_CODES.FILE_TYPE_NOT_ALLOWED, "Only .xlsx estimate files are allowed");
  }

  return withIdempotency(
    auth.userId,
    "create_upload_session",
    args.idempotencyKey,
    args,
    async (tx) => {
      const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);
      if (workflow.version !== args.expectedVersion) {
        throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
          recoverable: true,
        });
      }
      assertTransitionAllowed(workflow.stage, "estimate_upload_pending");

      const updated = await workflowRepo.updateWorkflowStageIfVersionMatches(
        tx,
        workflow.id,
        args.expectedVersion,
        "estimate_upload_pending",
      );
      if (!updated) {
        throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
          recoverable: true,
        });
      }

      const uploadId = randomUUID();
      const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);
      await tx.insert(uploadSessions).values({
        id: uploadId,
        userId: auth.userId,
        objectId: workflow.objectId,
        workflowId: workflow.id,
        purpose: "estimate",
        storageKey: newEstimateStorageKey(),
        originalFilename,
        expiresAt,
      });
      await workflowRepo.insertWorkflowEvent(tx, {
        workflowId: workflow.id,
        eventType: "estimate_upload_session_created",
        actorType: "agent",
        actorId: String(auth.userId),
        payloadJson: { uploadId, expiresAt: expiresAt.toISOString() },
      });

      return {
        uploadId,
        uploadUrl: `/api/mcp/uploads/${uploadId}`,
        uploadMethod: "POST" as const,
        fileField: "file" as const,
        purpose: "estimate" as const,
        allowedExtensions: [".xlsx"],
        allowedMimeTypes: [ESTIMATE_XLSX_MIME],
        maxBytes: ESTIMATE_UPLOAD_MAX_BYTES,
        expiresAt: expiresAt.toISOString(),
        workflowId: workflow.id,
        stage: updated.stage,
        version: updated.version,
      };
    },
  );
}

export async function storeEstimateUpload(
  auth: McpAuthContext,
  uploadId: string,
  file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
) {
  const session = await getOwnedUpload(auth, uploadId);
  if (session.status === "consumed") {
    throw new McpToolError(MCP_ERROR_CODES.UPLOAD_ALREADY_CONSUMED, "Upload session was already consumed");
  }
  if (session.status !== "pending") {
    throw new McpToolError(MCP_ERROR_CODES.VALIDATION_ERROR, "Upload session already contains a file");
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw new McpToolError(MCP_ERROR_CODES.UPLOAD_EXPIRED, "Upload session expired");
  }
  if (file.size > ESTIMATE_UPLOAD_MAX_BYTES) {
    throw new McpToolError(MCP_ERROR_CODES.FILE_TOO_LARGE, "Estimate file is too large");
  }
  if (
    path.basename(file.originalname) !== session.originalFilename ||
    !isXlsxFilename(file.originalname) ||
    file.mimetype !== ESTIMATE_XLSX_MIME ||
    !isXlsx(file.buffer)
  ) {
    throw new McpToolError(MCP_ERROR_CODES.FILE_TYPE_NOT_ALLOWED, "File is not an allowed XLSX estimate");
  }

  const sha256 = createHash("sha256").update(file.buffer).digest("hex");
  await saveEstimateUpload(session.storageKey, file.buffer);
  try {
    const [updated] = await db
      .update(uploadSessions)
      .set({
        status: "uploaded",
        mimeType: file.mimetype,
        sizeBytes: file.size,
        sha256,
        uploadedAt: new Date(),
      })
      .where(and(eq(uploadSessions.id, session.id), eq(uploadSessions.status, "pending")))
      .returning();
    if (!updated) throw new McpToolError(MCP_ERROR_CODES.VALIDATION_ERROR, "Upload session already contains a file");
    return { uploadId: updated.id, status: updated.status, sizeBytes: updated.sizeBytes, sha256: updated.sha256 };
  } catch (error) {
    await removeEstimateUpload(session.storageKey).catch(() => undefined);
    throw error;
  }
}

export interface ImportEstimateFromUploadArgs {
  workflowId: number;
  uploadId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export async function importEstimateFromUpload(auth: McpAuthContext, args: ImportEstimateFromUploadArgs) {
  const initialSession = await getOwnedUpload(auth, args.uploadId);
  if (initialSession.status !== "consumed") {
    if (initialSession.expiresAt.getTime() <= Date.now()) {
      throw new McpToolError(MCP_ERROR_CODES.UPLOAD_EXPIRED, "Upload session expired");
    }
    if (initialSession.status !== "uploaded") {
      throw new McpToolError(MCP_ERROR_CODES.VALIDATION_ERROR, "Upload has no completed file");
    }
  }
  let parsed: unknown;
  try {
    const contents = await readEstimateUpload(initialSession.storageKey);
    const workbook = XLSX.read(contents, { type: "buffer" });
    parsed = parseEstimateWorkbook(workbook, { fileName: initialSession.originalFilename });
  } catch {
    throw new McpToolError(MCP_ERROR_CODES.ESTIMATE_IMPORT_FAILED, "Failed to parse estimate XLSX", {
      recoverable: true,
    });
  }

  try {
    return await withIdempotency(
      auth.userId,
      "import_estimate_from_upload",
      args.idempotencyKey,
      args,
      async (tx) => {
        const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);
        const [session] = await tx.select().from(uploadSessions).where(eq(uploadSessions.id, args.uploadId));
        if (
          !session ||
          session.userId !== auth.userId ||
          session.objectId !== workflow.objectId ||
          session.workflowId !== workflow.id ||
          session.purpose !== "estimate"
        ) {
          throw uploadNotFound();
        }
        if (session.status === "consumed") {
          throw new McpToolError(MCP_ERROR_CODES.UPLOAD_ALREADY_CONSUMED, "Upload session was already consumed");
        }
        if (session.expiresAt.getTime() <= Date.now()) {
          throw new McpToolError(MCP_ERROR_CODES.UPLOAD_EXPIRED, "Upload session expired");
        }
        if (session.status !== "uploaded") {
          throw new McpToolError(MCP_ERROR_CODES.VALIDATION_ERROR, "Upload has no completed file");
        }
        if (workflow.version !== args.expectedVersion) {
          throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
            recoverable: true,
          });
        }
        if (workflow.stage !== "estimate_upload_pending") {
          throw new McpToolError(
            MCP_ERROR_CODES.WORKFLOW_TRANSITION_NOT_ALLOWED,
            `Cannot import estimate while workflow is at "${workflow.stage}"`,
          );
        }
        assertTransitionAllowed(workflow.stage, "estimate_imported");

        const imported = await importEstimateWithClient(tx, parsed, workflow.objectId);
        const updatedWorkflow = await workflowRepo.attachEstimateAndUpdateStageIfVersionMatches(
          tx,
          workflow.id,
          args.expectedVersion,
          imported.estimateId,
          "estimate_imported",
        );
        if (!updatedWorkflow) {
          throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
            recoverable: true,
          });
        }
        await tx
          .update(uploadSessions)
          .set({ status: "consumed", consumedAt: new Date(), estimateId: imported.estimateId })
          .where(eq(uploadSessions.id, session.id));
        await workflowRepo.insertWorkflowEvent(tx, {
          workflowId: workflow.id,
          eventType: "estimate_imported",
          actorType: "agent",
          actorId: String(auth.userId),
          payloadJson: { uploadId: session.id, estimateId: imported.estimateId, sha256: session.sha256 },
        });

        return {
          ...imported,
          workflowId: workflow.id,
          stage: updatedWorkflow.stage,
          version: updatedWorkflow.version,
          uploadId: session.id,
        };
      },
    );
  } catch (error) {
    if (error instanceof McpToolError) throw error;
    throw new McpToolError(MCP_ERROR_CODES.ESTIMATE_IMPORT_FAILED, "Estimate import failed", { recoverable: true });
  }
}
