import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  buildMaterialRegister,
  confirmMaterialClassification,
  getMaterialRegister,
  getMissingQualityDocuments,
} from "../../services/materialRegisterService";
import { requireAuth, type McpAuthResolution } from "../authContext";
import { toolError, toolSuccess, withToolLogging } from "../toolResult";

const classificationSchema = z.enum(["material", "equipment", "product", "unclassified"]);

export function registerMaterialRegisterTools(server: McpServer, authResolution: McpAuthResolution): void {
  const userIdForLog = authResolution.status === "ok" ? authResolution.context.userId : 0;

  server.registerTool(
    "build_material_register",
    {
      title: "Build material register",
      description: "Builds or safely rebuilds the traceable project material register from the current estimate.",
      inputSchema: {
        workflowId: z.number().int().positive(),
        expectedVersion: z.number().int().nonnegative(),
        idempotencyKey: z.string().min(1).max(200),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withToolLogging("build_material_register", userIdForLog, async (args) => {
      try {
        return toolSuccess(await buildMaterialRegister(requireAuth(authResolution), args));
      } catch (error) {
        return toolError(error);
      }
    }),
  );

  server.registerTool(
    "get_material_register",
    {
      title: "Get material register",
      description: "Returns the current register, classifications, source links, requirements and blockers.",
      inputSchema: { workflowId: z.number().int().positive() },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    withToolLogging("get_material_register", userIdForLog, async (args) => {
      try {
        return toolSuccess(await getMaterialRegister(requireAuth(authResolution), args.workflowId));
      } catch (error) {
        return toolError(error);
      }
    }),
  );

  server.registerTool(
    "confirm_material_classification",
    {
      title: "Confirm material classification",
      description: "Confirms or corrects one register item classification without changing the global catalog.",
      inputSchema: {
        workflowId: z.number().int().positive(),
        registerItemId: z.number().int().positive(),
        classification: classificationSchema,
        expectedVersion: z.number().int().nonnegative(),
        idempotencyKey: z.string().min(1).max(200),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withToolLogging("confirm_material_classification", userIdForLog, async (args) => {
      try {
        return toolSuccess(await confirmMaterialClassification(requireAuth(authResolution), args));
      } catch (error) {
        return toolError(error);
      }
    }),
  );

  server.registerTool(
    "get_missing_quality_documents",
    {
      title: "Get missing quality documents",
      description: "Returns unsatisfied MVP document requirements and unclassified blockers without claiming normative sufficiency.",
      inputSchema: { workflowId: z.number().int().positive() },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    withToolLogging("get_missing_quality_documents", userIdForLog, async (args) => {
      try {
        return toolSuccess(await getMissingQualityDocuments(requireAuth(authResolution), args.workflowId));
      } catch (error) {
        return toolError(error);
      }
    }),
  );
}
