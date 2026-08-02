import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  attachDocumentFromUpload,
  listMaterialDocuments,
} from "../../services/documentIngestionService";
import { requireAuth, type McpAuthResolution } from "../authContext";
import { toolError, toolSuccess, withToolLogging } from "../toolResult";

const documentTypeSchema = z.enum(["certificate", "declaration", "passport", "protocol"]);

export function registerDocumentIngestionTools(server: McpServer, authResolution: McpAuthResolution): void {
  const userIdForLog = authResolution.status === "ok" ? authResolution.context.userId : 0;

  server.registerTool(
    "attach_document_from_upload",
    {
      title: "Attach uploaded quality document",
      description: "Creates a project PDF document and binds it to one owned material, returning updated missing requirements.",
      inputSchema: {
        workflowId: z.number().int().positive(),
        uploadId: z.string().uuid(),
        projectMaterialId: z.number().int().positive(),
        docType: documentTypeSchema,
        title: z.string().trim().min(1).max(500),
        docNumber: z.string().trim().min(1).max(200).optional(),
        docDate: z.string().date().optional(),
        useInActs: z.boolean(),
        expectedVersion: z.number().int().nonnegative(),
        idempotencyKey: z.string().min(1).max(200),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withToolLogging("attach_document_from_upload", userIdForLog, async (args) => {
      try {
        return toolSuccess(await attachDocumentFromUpload(requireAuth(authResolution), args));
      } catch (error) {
        return toolError(error);
      }
    }),
  );

  server.registerTool(
    "list_material_documents",
    {
      title: "List material documents",
      description: "Lists active project documents bound to one owned material in the workflow register.",
      inputSchema: {
        workflowId: z.number().int().positive(),
        projectMaterialId: z.number().int().positive(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    withToolLogging("list_material_documents", userIdForLog, async (args) => {
      try {
        return toolSuccess(await listMaterialDocuments(requireAuth(authResolution), args.workflowId, args.projectMaterialId));
      } catch (error) {
        return toolError(error);
      }
    }),
  );
}
