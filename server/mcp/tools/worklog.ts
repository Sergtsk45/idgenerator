import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { generateWorklogDraft, getWorklogDraft } from "../../services/worklogDraftService";
import { requireAuth, type McpAuthResolution } from "../authContext";
import { toolError, toolSuccess, withToolLogging } from "../toolResult";

export function registerWorklogTools(server: McpServer, authResolution: McpAuthResolution): void {
  const userIdForLog = authResolution.status === "ok" ? authResolution.context.userId : 0;
  server.registerTool("get_worklog_draft", {
    title: "Get worklog draft",
    description: "Returns the latest owned draft worklog and whether it is fresh.",
    inputSchema: { workflowId: z.number().int().positive() },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, withToolLogging("get_worklog_draft", userIdForLog, async ({ workflowId }) => {
    try { return toolSuccess(await getWorklogDraft(requireAuth(authResolution), workflowId)); }
    catch (error) { return toolError(error); }
  }));

  server.registerTool("generate_worklog_draft", {
    title: "Generate worklog draft",
    description: "Idempotently stores a traceable draft; planned rows are never represented as factual.",
    inputSchema: {
      workflowId: z.number().int().positive(),
      expectedVersion: z.number().int().nonnegative(),
      idempotencyKey: z.string().min(1).max(200),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, withToolLogging("generate_worklog_draft", userIdForLog, async (args) => {
    try { return toolSuccess(await generateWorklogDraft(requireAuth(authResolution), args)); }
    catch (error) { return toolError(error); }
  }));
}
