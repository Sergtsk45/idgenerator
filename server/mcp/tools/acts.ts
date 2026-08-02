import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { exportActAttachments, exportActPdf } from "../../services/actArtifactService";
import { generateActs } from "../../services/acts/actGenerationService";
import {
  checkActsReadiness,
  checkActsReadinessWithClient,
} from "../../services/actsReadinessService";
import { requireAuth, type McpAuthResolution } from "../authContext";
import { toolError, toolSuccess, withToolLogging } from "../toolResult";

const actGenerationModeSchema = z.enum(["draft", "final"]);

export function registerActTools(server: McpServer, authResolution: McpAuthResolution): void {
  const userIdForLog = authResolution.status === "ok" ? authResolution.context.userId : 0;

  server.registerTool(
    "check_acts_readiness",
    {
      title: "Check acts readiness",
      description: "Returns deterministic blocking issues per act group without changing workflow state.",
      inputSchema: { workflowId: z.number().int().positive() },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    withToolLogging("check_acts_readiness", userIdForLog, async ({ workflowId }) => {
      try {
        return toolSuccess(await checkActsReadiness(requireAuth(authResolution), workflowId));
      } catch (error) {
        return toolError(error);
      }
    }),
  );

  server.registerTool(
    "generate_acts",
    {
      title: "Generate acts",
      description: "Idempotently generates explicit draft acts or confirmed final acts from the owned workflow schedule; final mode requires confirmFinal=true and no readiness blockers.",
      inputSchema: {
        workflowId: z.number().int().positive(),
        mode: actGenerationModeSchema,
        confirmFinal: z.boolean().default(false),
        expectedVersion: z.number().int().nonnegative(),
        idempotencyKey: z.string().min(1).max(200),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withToolLogging("generate_acts", userIdForLog, async (args) => {
      try {
        return toolSuccess(await generateActs(
          requireAuth(authResolution),
          {
            workflowId: args.workflowId,
            mode: args.mode,
            confirmed: args.confirmFinal,
            expectedVersion: args.expectedVersion,
            idempotencyKey: args.idempotencyKey,
          },
          { readiness: checkActsReadinessWithClient },
        ));
      } catch (error) {
        return toolError(error);
      }
    }),
  );

  server.registerTool(
    "export_act_pdf",
    {
      title: "Export act PDF",
      description: "Creates an owned draft or final PDF artifact for one workflow act without mutating act content.",
      inputSchema: {
        workflowId: z.number().int().positive(),
        actId: z.number().int().positive(),
        mode: actGenerationModeSchema,
        idempotencyKey: z.string().min(1).max(200),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withToolLogging("export_act_pdf", userIdForLog, async (args) => {
      try {
        return toolSuccess(await exportActPdf(requireAuth(authResolution), args));
      } catch (error) {
        return toolError(error);
      }
    }),
  );

  server.registerTool(
    "export_act_attachments",
    {
      title: "Export act attachments",
      description: "Creates an owned draft or final PDF package from one workflow act's attachments without changing binding state.",
      inputSchema: {
        workflowId: z.number().int().positive(),
        actId: z.number().int().positive(),
        mode: actGenerationModeSchema,
        idempotencyKey: z.string().min(1).max(200),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withToolLogging("export_act_attachments", userIdForLog, async (args) => {
      try {
        return toolSuccess(await exportActAttachments(requireAuth(authResolution), args));
      } catch (error) {
        return toolError(error);
      }
    }),
  );
}
