import type { ExecutionWorkflow } from "@shared/schema";
import {
  bindingRoleFromDocType,
  type AttachableQualityDocumentType,
} from "@shared/documentBinding";
import { db } from "../db";
import {
  documentFileUrl,
  documentFilename,
  removeDocumentFile,
  saveDocumentFile,
} from "../document-files";
import type { McpAuthContext } from "../mcp/authContext";
import { MCP_ERROR_CODES, McpToolError } from "../mcp/errors";
import {
  readQualityDocumentUpload,
  removeQualityDocumentUpload,
} from "../quality-document-upload-files";
import { getMissingQualityDocumentsWithClient } from "./materialRegisterService";
import * as documentRepo from "./document/documentRepository";
import * as workflowRepo from "./execution-workflow/workflowRepository";
import { loadOwnedWorkflow, withIdempotency } from "./execution-workflow/workflowService";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface AttachDocumentFromUploadArgs {
  workflowId: number;
  uploadId: string;
  projectMaterialId: number;
  docType: AttachableQualityDocumentType;
  title: string;
  docNumber?: string;
  docDate?: string;
  useInActs: boolean;
  expectedVersion: number;
  idempotencyKey: string;
}

function validateMetadata(args: AttachDocumentFromUploadArgs) {
  const title = args.title.trim();
  const docNumber = args.docNumber?.trim() || undefined;
  if (!title) throw new McpToolError(MCP_ERROR_CODES.VALIDATION_ERROR, "Document title is required");
  const parsedDate = args.docDate ? new Date(`${args.docDate}T00:00:00Z`) : undefined;
  if (args.docDate && (!ISO_DATE.test(args.docDate)
    || Number.isNaN(parsedDate!.getTime())
    || parsedDate!.toISOString().slice(0, 10) !== args.docDate)) {
    throw new McpToolError(MCP_ERROR_CODES.VALIDATION_ERROR, "docDate must be a real YYYY-MM-DD date");
  }
  return { title, docNumber, docDate: args.docDate };
}

function workflowConflict(): McpToolError {
  return new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
    recoverable: true,
  });
}

async function attachmentResult(
  client: workflowRepo.DbClient,
  workflow: ExecutionWorkflow,
  projectMaterialId: number,
  documentId: number,
  bindingId: number,
  uploadId: string,
  missingBefore?: Awaited<ReturnType<typeof getMissingQualityDocumentsWithClient>>,
  tolerateStaleReadiness = false,
) {
  const attachment = {
    workflowId: workflow.id,
    stage: workflow.stage,
    version: workflow.version,
    uploadId,
    projectMaterialId,
    documentId,
    bindingId,
  };
  let missingAfter: Awaited<ReturnType<typeof getMissingQualityDocumentsWithClient>>;
  try {
    missingAfter = await getMissingQualityDocumentsWithClient(client, workflow);
  } catch (error) {
    if (tolerateStaleReadiness && error instanceof McpToolError
      && (error.code === MCP_ERROR_CODES.MATERIAL_REGISTER_NOT_FOUND
        || error.code === MCP_ERROR_CODES.MATERIAL_REGISTER_STALE)) {
      return {
        ...attachment,
        missingDocumentDelta: null,
        missingQualityDocuments: null,
        readinessUnavailable: { code: error.code, message: error.message },
      };
    }
    throw error;
  }
  const before = missingBefore ?? missingAfter;
  const remaining = new Set(missingAfter.missingRequirements.map((item) => `${item.registerItemId}:${item.ruleId}`));
  const resolvedRequirements = before.missingRequirements
    .filter((item) => !remaining.has(`${item.registerItemId}:${item.ruleId}`))
    .map((item) => ({ registerItemId: item.registerItemId, projectMaterialId: item.projectMaterialId, ruleId: item.ruleId }));
  return {
    ...attachment,
    missingDocumentDelta: {
      beforeCount: before.missingRequirements.length,
      afterCount: missingAfter.missingRequirements.length,
      resolvedRequirements,
    },
    missingQualityDocuments: missingAfter,
  };
}

export async function attachDocumentFromUpload(auth: McpAuthContext, args: AttachDocumentFromUploadArgs) {
  const metadata = validateMetadata(args);
  let finalFileUrl: string | undefined;
  let consumedStorageKey: string | undefined;

  try {
    const result = await withIdempotency(auth.userId, "attach_document_from_upload", args.idempotencyKey, args, async (tx) => {
      const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);
      const session = await documentRepo.loadOwnedUploadSession(tx, auth.userId, args.uploadId, workflow.id);
      if (!session || session.objectId !== workflow.objectId || session.purpose !== "quality_document") {
        throw new McpToolError(MCP_ERROR_CODES.DOCUMENT_UPLOAD_INVALID, "Quality document upload not found");
      }

      if (session.status === "consumed") {
        const existing = session.documentId === null
          ? undefined
          : await documentRepo.getOwnedConsumedMaterialDocument(
              tx,
              auth.userId,
              workflow.id,
              args.projectMaterialId,
              session.documentId,
            );
        const sameAttachment = session.projectMaterialId === args.projectMaterialId
          && existing?.document.docType === args.docType
          && existing.document.title === metadata.title
          && (existing.document.docNumber ?? undefined) === metadata.docNumber
          && (existing.document.docDate ?? undefined) === metadata.docDate
          && existing.binding.useInActs === args.useInActs
          && existing.binding.bindingRole === bindingRoleFromDocType(args.docType);
        if (!sameAttachment || !existing || session.documentId === null) {
          throw new McpToolError(
            MCP_ERROR_CODES.DOCUMENT_ALREADY_ATTACHED,
            "This upload was already attached to a document",
          );
        }
        return attachmentResult(
          tx,
          workflow,
          args.projectMaterialId,
          existing.document.id,
          existing.binding.id,
          session.id,
          undefined,
          true,
        );
      }

      const ownedItem = await documentRepo.loadOwnedActiveRegisterItem(
        tx,
        auth.userId,
        workflow.id,
        args.projectMaterialId,
      );
      if (!ownedItem) {
        throw new McpToolError(MCP_ERROR_CODES.MATERIAL_NOT_OWNED, "Material does not belong to this workflow");
      }

      if (session.expiresAt.getTime() <= Date.now() || session.status !== "uploaded") {
        throw new McpToolError(MCP_ERROR_CODES.DOCUMENT_UPLOAD_INVALID, "Quality document upload is not ready");
      }
      if (workflow.version !== args.expectedVersion) throw workflowConflict();
      if (!["materials_register_ready", "awaiting_quality_documents", "acts_blocked"].includes(workflow.stage)) {
        throw new McpToolError(
          MCP_ERROR_CODES.WORKFLOW_TRANSITION_NOT_ALLOWED,
          `Cannot attach a quality document while workflow is at "${workflow.stage}"`,
        );
      }

      const missingBefore = await getMissingQualityDocumentsWithClient(tx, workflow);

      const updatedWorkflow = workflow.stage === "materials_register_ready"
        ? await workflowRepo.updateWorkflowStageIfVersionMatches(
            tx,
            workflow.id,
            args.expectedVersion,
            "awaiting_quality_documents",
          )
        : await workflowRepo.touchWorkflowIfVersionMatches(tx, workflow.id, args.expectedVersion);
      if (!updatedWorkflow) throw workflowConflict();

      let contents: Buffer;
      try {
        contents = await readQualityDocumentUpload(session.storageKey);
      } catch {
        throw new McpToolError(MCP_ERROR_CODES.DOCUMENT_UPLOAD_INVALID, "Uploaded PDF is unavailable");
      }
      const document = await documentRepo.createDocument(tx, workflow.objectId, auth.userId, {
        docType: args.docType,
        scope: "project",
        title: metadata.title,
        docNumber: metadata.docNumber,
        docDate: metadata.docDate,
        meta: { source: "mcp_upload", uploadId: session.id, sha256: session.sha256 },
      });
      const filename = documentFilename(document.id, session.originalFilename);
      await saveDocumentFile(workflow.objectId, filename, contents);
      finalFileUrl = documentFileUrl(workflow.objectId, filename);
      const updatedDocument = await documentRepo.updateDocument(
        tx,
        document.id,
        auth.userId,
        workflow.objectId,
        { fileUrl: finalFileUrl },
      );
      if (!updatedDocument) throw new McpToolError(MCP_ERROR_CODES.INTERNAL_ERROR, "Failed to persist document file");
      const binding = await documentRepo.createBinding(tx, {
        documentId: document.id,
        objectId: workflow.objectId,
        projectMaterialId: args.projectMaterialId,
        bindingRole: bindingRoleFromDocType(args.docType),
        useInActs: args.useInActs,
        isPrimary: false,
      });
      const consumed = await documentRepo.consumeQualityDocumentUpload(tx, {
        uploadId: session.id,
        userId: auth.userId,
        workflowId: workflow.id,
        documentId: document.id,
        projectMaterialId: args.projectMaterialId,
      });
      if (!consumed) {
        throw new McpToolError(MCP_ERROR_CODES.DOCUMENT_ALREADY_ATTACHED, "This upload was already attached");
      }
      await workflowRepo.insertWorkflowEvent(tx, {
        workflowId: workflow.id,
        eventType: "quality_document_attached",
        actorType: "agent",
        actorId: String(auth.userId),
        payloadJson: {
          uploadId: session.id,
          documentId: document.id,
          projectMaterialId: args.projectMaterialId,
          docType: args.docType,
          useInActs: args.useInActs,
          sha256: session.sha256,
        },
      });
      consumedStorageKey = session.storageKey;
      return attachmentResult(
        tx,
        updatedWorkflow,
        args.projectMaterialId,
        document.id,
        binding.id,
        session.id,
        missingBefore,
      );
    });

    if (consumedStorageKey) await removeQualityDocumentUpload(consumedStorageKey).catch(() => undefined);
    return result;
  } catch (error) {
    // ponytail: filesystem and PostgreSQL cannot commit atomically; rollback compensation
    // covers ordinary failures, while a process crash can leave an unreferenced file for cleanup.
    if (finalFileUrl) await removeDocumentFile(finalFileUrl).catch(() => undefined);
    throw error;
  }
}

export async function listMaterialDocuments(auth: McpAuthContext, workflowId: number, projectMaterialId: number) {
  const workflow = await loadOwnedWorkflow(db, auth, workflowId);
  const ownedItem = await documentRepo.loadOwnedActiveRegisterItem(
    db,
    auth.userId,
    workflow.id,
    projectMaterialId,
  );
  if (!ownedItem) throw new McpToolError(MCP_ERROR_CODES.MATERIAL_NOT_OWNED, "Material does not belong to this workflow");
  const rows = await documentRepo.listMaterialDocuments(db, auth.userId, workflow.id, projectMaterialId);
  return {
    workflowId: workflow.id,
    projectMaterialId,
    documents: rows.map(({ document, binding }) => ({
      documentId: document.id,
      bindingId: binding.id,
      docType: document.docType,
      title: document.title,
      docNumber: document.docNumber,
      docDate: document.docDate,
      fileUrl: document.fileUrl,
      bindingRole: binding.bindingRole,
      useInActs: binding.useInActs,
      isPrimary: binding.isPrimary,
    })),
  };
}
