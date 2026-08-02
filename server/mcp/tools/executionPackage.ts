import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { buildExecutionPackage, checkHandoverReadiness } from "../../services/executionPackageService";
import { requireAuth, type McpAuthResolution } from "../authContext";
import { toolError, toolSuccess, withToolLogging } from "../toolResult";

export function registerExecutionPackageTools(server: McpServer, authResolution: McpAuthResolution): void {
  const userIdForLog = authResolution.status === "ok" ? authResolution.context.userId : 0;
  server.registerTool("check_handover_readiness", {
    title: "Check handover readiness",
    description: "Returns final-package blockers, warnings, assumptions and expected artifact manifest.",
    inputSchema: { workflowId: z.number().int().positive() },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, withToolLogging("check_handover_readiness", userIdForLog, async ({ workflowId }) => {
    try { return toolSuccess(await checkHandoverReadiness(requireAuth(authResolution), workflowId)); }
    catch (error) { return toolError(error); }
  }));

  server.registerTool("build_execution_package", {
    title: "Build execution package",
    description: "Builds an idempotent size-limited draft or explicitly confirmed final ZIP package.",
    inputSchema: {
      workflowId: z.number().int().positive(),
      mode: z.enum(["draft", "final"]),
      confirmFinal: z.boolean().default(false),
      expectedVersion: z.number().int().nonnegative(),
      idempotencyKey: z.string().min(1).max(200),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, withToolLogging("build_execution_package", userIdForLog, async (args) => {
    try { return toolSuccess(await buildExecutionPackage(requireAuth(authResolution), args)); }
    catch (error) { return toolError(error); }
  }));
}
