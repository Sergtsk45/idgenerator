import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { requireAuth, type McpAuthResolution } from "../authContext";
import { toolError, toolSuccess, withToolLogging } from "../toolResult";
import { createUploadSession, importEstimateFromUpload } from "../../services/estimateUploadService";

const idempotencyKey = z.string().min(1).max(200);
const uploadPurposeSchema = z.enum(["estimate", "quality_document"]).optional().default("estimate");

export function registerUploadTools(server: McpServer, authResolution: McpAuthResolution): void {
  const userIdForLog = authResolution.status === "ok" ? authResolution.context.userId : 0;

  server.registerTool(
    "create_upload_session",
    {
      title: "Create upload session",
      description:
        "Creates a one-shot, 30-minute upload session for an XLSX estimate or PDF quality document. " +
        "Estimate sessions move the workflow to estimate_upload_pending; quality document sessions move it to awaiting_quality_documents.",
      inputSchema: {
        workflowId: z.number().int().positive(),
        expectedVersion: z.number().int().nonnegative(),
        idempotencyKey,
        originalFilename: z.string().min(1).max(255),
        purpose: uploadPurposeSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withToolLogging("create_upload_session", userIdForLog, async (args) => {
      try {
        return toolSuccess(await createUploadSession(requireAuth(authResolution), args));
      } catch (error) {
        return toolError(error);
      }
    }),
  );

  server.registerTool(
    "import_estimate_from_upload",
    {
      title: "Import estimate from upload",
      description:
        "Parses an uploaded XLSX, creates one estimate, attaches it to the same workflow, consumes the upload, " +
        "and moves the workflow to estimate_imported. Retrying the same idempotencyKey returns the same estimate.",
      inputSchema: {
        workflowId: z.number().int().positive(),
        uploadId: z.string().uuid(),
        expectedVersion: z.number().int().nonnegative(),
        idempotencyKey,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withToolLogging("import_estimate_from_upload", userIdForLog, async (args) => {
      try {
        return toolSuccess(await importEstimateFromUpload(requireAuth(authResolution), args));
      } catch (error) {
        return toolError(error);
      }
    }),
  );
}
