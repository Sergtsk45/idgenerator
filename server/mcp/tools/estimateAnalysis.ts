import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { requireAuth, type McpAuthResolution } from "../authContext";
import { toolError, toolSuccess, withToolLogging } from "../toolResult";
import { analyzeEstimate, getEstimateAnalysis } from "../../services/estimateAnalysisService";

export function registerEstimateAnalysisTools(server: McpServer, authResolution: McpAuthResolution): void {
  const userIdForLog = authResolution.status === "ok" ? authResolution.context.userId : 0;

  server.registerTool(
    "analyze_estimate",
    {
      title: "Analyze imported estimate",
      description:
        "Deterministically classifies the workflow estimate, stores a content-hashed snapshot, and moves " +
        "estimate_imported to estimate_analysis_ready. Re-analysis refreshes only when source rows changed.",
      inputSchema: {
        workflowId: z.number().int().positive(),
        expectedVersion: z.number().int().nonnegative(),
        idempotencyKey: z.string().min(1).max(200),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withToolLogging("analyze_estimate", userIdForLog, async (args) => {
      try {
        return toolSuccess(await analyzeEstimate(requireAuth(authResolution), args));
      } catch (error) {
        return toolError(error);
      }
    }),
  );

  server.registerTool(
    "get_estimate_analysis",
    {
      title: "Get current estimate analysis",
      description:
        "Returns the current content-hashed analysis snapshot without changing data. Refuses stale snapshots.",
      inputSchema: { workflowId: z.number().int().positive() },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    withToolLogging("get_estimate_analysis", userIdForLog, async (args) => {
      try {
        return toolSuccess(await getEstimateAnalysis(requireAuth(authResolution), args.workflowId));
      } catch (error) {
        return toolError(error);
      }
    }),
  );
}
