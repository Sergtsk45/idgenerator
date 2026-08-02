import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { approveSchedule, calculateScheduleDraft, getScheduleDraft } from "../../services/schedulePlanningService";
import { requireAuth, type McpAuthResolution } from "../authContext";
import { toolError, toolSuccess, withToolLogging } from "../toolResult";

export function registerSchedulePlanningTools(server: McpServer, authResolution: McpAuthResolution): void {
  const userIdForLog = authResolution.status === "ok" ? authResolution.context.userId : 0;

  server.registerTool(
    "calculate_schedule_draft",
    {
      title: "Calculate schedule draft",
      description: "Calculates and stores a deterministic versioned linear schedule draft from the current confirmed inputs, updating the workflow draft stage only when the draft changes.",
      inputSchema: {
        workflowId: z.number().int().positive(),
        expectedVersion: z.number().int().nonnegative(),
        idempotencyKey: z.string().min(1).max(200),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withToolLogging("calculate_schedule_draft", userIdForLog, async (args) => {
      try {
        return toolSuccess(await calculateScheduleDraft(requireAuth(authResolution), args));
      } catch (error) {
        return toolError(error);
      }
    }),
  );

  server.registerTool(
    "get_schedule_draft",
    {
      title: "Get schedule draft",
      description: "Returns the latest versioned schedule draft owned by the current workflow user.",
      inputSchema: { workflowId: z.number().int().positive() },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    withToolLogging("get_schedule_draft", userIdForLog, async (args) => {
      try {
        return toolSuccess(await getScheduleDraft(requireAuth(authResolution), args.workflowId));
      } catch (error) {
        return toolError(error);
      }
    }),
  );

  server.registerTool(
    "approve_schedule",
    {
      title: "Approve schedule",
      description: "Approves one fresh draft version, changes workflow stage to approved, and atomically creates the schedule with linked estimate tasks.",
      inputSchema: {
        workflowId: z.number().int().positive(),
        draftVersion: z.number().int().positive(),
        expectedVersion: z.number().int().nonnegative(),
        idempotencyKey: z.string().min(1).max(200),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withToolLogging("approve_schedule", userIdForLog, async (args) => {
      try {
        return toolSuccess(await approveSchedule(requireAuth(authResolution), args));
      } catch (error) {
        return toolError(error);
      }
    }),
  );
}
