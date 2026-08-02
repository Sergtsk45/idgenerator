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
import {
  QUALITY_DOCUMENT_PDF_MIME,
  QUALITY_DOCUMENT_UPLOAD_MAX_BYTES,
  isPdfFilename,
  isQualityDocumentPdf,
  newQualityDocumentStorageKey,
  removeQualityDocumentUpload,
  saveQualityDocumentUpload,
} from "../quality-document-upload-files";
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
  purpose?: "estimate" | "quality_document";
}

export async function createUploadSession(auth: McpAuthContext, args: CreateUploadSessionArgs) {
  const purpose = args.purpose ?? "estimate";
  const { purpose: _requestedPurpose, ...legacyRequest } = args;
  const originalFilename = path.basename(args.originalFilename);
  const validFilename = purpose === "estimate" ? isXlsxFilename(originalFilename) : isPdfFilename(originalFilename);
  if (originalFilename !== args.originalFilename || !validFilename) {
    throw new McpToolError(
      MCP_ERROR_CODES.FILE_TYPE_NOT_ALLOWED,
      purpose === "estimate" ? "Only .xlsx estimate files are allowed" : "Only .pdf quality documents are allowed",
    );
  }

  return withIdempotency(
    auth.userId,
    "create_upload_session",
    args.idempotencyKey,
    purpose === "estimate" ? legacyRequest : { ...legacyRequest, purpose },
    async (tx) => {
      const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);
      if (workflow.version !== args.expectedVersion) {
        throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
          recoverable: true,
        });
      }
      if (purpose === "estimate") {
        assertTransitionAllowed(workflow.stage, "estimate_upload_pending");
      } else if (workflow.stage !== "materials_register_ready" && workflow.stage !== "awaiting_quality_documents") {
        throw new McpToolError(
          MCP_ERROR_CODES.WORKFLOW_TRANSITION_NOT_ALLOWED,
          `Cannot create a quality document upload while workflow is at "${workflow.stage}"`,
        );
      }

      const updated = await workflowRepo.updateWorkflowStageIfVersionMatches(
        tx,
        workflow.id,
        args.expectedVersion,
        purpose === "estimate" ? "estimate_upload_pending" : "awaiting_quality_documents",
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
        purpose,
        storageKey: purpose === "estimate" ? newEstimateStorageKey() : newQualityDocumentStorageKey(),
        originalFilename,
        expiresAt,
      });
      await workflowRepo.insertWorkflowEvent(tx, {
        workflowId: workflow.id,
        eventType: purpose === "estimate" ? "estimate_upload_session_created" : "quality_document_upload_session_created",
        actorType: "agent",
        actorId: String(auth.userId),
        payloadJson: { uploadId, expiresAt: expiresAt.toISOString() },
      });

      const uploadContract = purpose === "estimate"
        ? {
            allowedExtensions: [".xlsx"],
            allowedMimeTypes: [ESTIMATE_XLSX_MIME],
            maxBytes: ESTIMATE_UPLOAD_MAX_BYTES,
          }
        : {
            allowedExtensions: [".pdf"],
            allowedMimeTypes: [QUALITY_DOCUMENT_PDF_MIME],
            maxBytes: QUALITY_DOCUMENT_UPLOAD_MAX_BYTES,
          };
      return {
        uploadId,
        uploadUrl: `/api/mcp/uploads/${uploadId}`,
        uploadMethod: "POST" as const,
        fileField: "file" as const,
        purpose,
        ...uploadContract,
        expiresAt: expiresAt.toISOString(),
        workflowId: workflow.id,
        stage: updated.stage,
        version: updated.version,
      };
    },
  );
}

export const createEstimateUploadSession = createUploadSession;

export async function storeEstimateUpload(
  auth: McpAuthContext,
  uploadId: string,
  file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
) {
  const session = await getOwnedUpload(auth, uploadId);
  if (session.purpose !== "estimate") throw uploadNotFound();
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

export async function storeQualityDocumentUpload(
  auth: McpAuthContext,
  uploadId: string,
  file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
) {
  const session = await getOwnedUpload(auth, uploadId);
  if (session.purpose !== "quality_document") {
    throw new McpToolError(MCP_ERROR_CODES.DOCUMENT_UPLOAD_INVALID, "Upload session is not for a quality document");
  }
  if (session.status === "consumed") {
    throw new McpToolError(MCP_ERROR_CODES.UPLOAD_ALREADY_CONSUMED, "Upload session was already consumed");
  }
  if (session.status !== "pending") {
    throw new McpToolError(MCP_ERROR_CODES.DOCUMENT_UPLOAD_INVALID, "Upload session already contains a file");
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw new McpToolError(MCP_ERROR_CODES.UPLOAD_EXPIRED, "Upload session expired");
  }
  if (file.size > QUALITY_DOCUMENT_UPLOAD_MAX_BYTES) {
    throw new McpToolError(MCP_ERROR_CODES.FILE_TOO_LARGE, "Quality document is too large");
  }
  if (
    path.basename(file.originalname) !== session.originalFilename ||
    !isPdfFilename(file.originalname) ||
    file.mimetype !== QUALITY_DOCUMENT_PDF_MIME ||
    !isQualityDocumentPdf(file.buffer)
  ) {
    throw new McpToolError(MCP_ERROR_CODES.DOCUMENT_UPLOAD_INVALID, "File is not an allowed PDF quality document");
  }

  const sha256 = createHash("sha256").update(file.buffer).digest("hex");
  await saveQualityDocumentUpload(session.storageKey, file.buffer);
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
    if (!updated) {
      throw new McpToolError(MCP_ERROR_CODES.DOCUMENT_UPLOAD_INVALID, "Upload session already contains a file");
    }
    return { uploadId: updated.id, status: updated.status, sizeBytes: updated.sizeBytes, sha256: updated.sha256 };
  } catch (error) {
    await removeQualityDocumentUpload(session.storageKey).catch(() => undefined);
    throw error;
  }
}

export async function storeMcpUpload(
  auth: McpAuthContext,
  uploadId: string,
  file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
) {
  const session = await getOwnedUpload(auth, uploadId);
  if (session.purpose === "estimate") return storeEstimateUpload(auth, uploadId, file);
  if (session.purpose === "quality_document") return storeQualityDocumentUpload(auth, uploadId, file);
  throw uploadNotFound();
}

export const storeUpload = storeMcpUpload;

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
