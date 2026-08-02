import { db } from "../db";
import type { McpAuthContext } from "../mcp/authContext";
import { MCP_ERROR_CODES, McpToolError } from "../mcp/errors";
import * as workflowRepo from "./execution-workflow/workflowRepository";
import { loadOwnedWorkflow, withIdempotency } from "./execution-workflow/workflowService";
import { buildWorklogDraft } from "./worklog/worklogDraftCore";
import * as repo from "./worklog/worklogRepository";

function result(workflow: { id: number; stage: string; version: number }, draft: Awaited<ReturnType<typeof repo.insertWorklogDraft>>, fresh = true) {
  return {
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    stage: workflow.stage,
    draftId: draft.id,
    title: "Черновик журнала работ",
    normativeCompletenessClaimed: false,
    inputHash: draft.inputHash,
    schemaVersion: draft.schemaVersion,
    entries: draft.entriesJson,
    warnings: draft.warningsJson,
    fresh,
    createdAt: draft.createdAt.toISOString(),
  };
}

export async function generateWorklogDraft(auth: McpAuthContext, args: {
  workflowId: number;
  expectedVersion: number;
  idempotencyKey: string;
}) {
  return withIdempotency(auth.userId, "generate_worklog_draft", args.idempotencyKey, args, async (tx) => {
    const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);
    if (workflow.version !== args.expectedVersion) {
      throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", { recoverable: true });
    }
    if (!workflow.scheduleId || !["acts_generated", "worklog_draft_ready", "package_ready"].includes(workflow.stage)) {
      throw new McpToolError(MCP_ERROR_CODES.WORKLOG_NOT_READY, "Generated acts and an approved schedule are required", { recoverable: true });
    }
    const built = buildWorklogDraft(await repo.loadWorklogSources(tx, {
      workflowId: workflow.id,
      userId: auth.userId,
      objectId: workflow.objectId,
      scheduleId: workflow.scheduleId,
    }));
    const existing = await repo.findWorklogDraft(tx, workflow.id, built.inputHash);
    if (existing && ["worklog_draft_ready", "package_ready"].includes(workflow.stage)) return result(workflow, existing);
    const updated = workflow.stage === "package_ready"
      ? await workflowRepo.touchWorkflowIfVersionMatches(tx, workflow.id, args.expectedVersion)
      : await workflowRepo.updateWorkflowStageIfVersionMatches(tx, workflow.id, args.expectedVersion, "worklog_draft_ready");
    if (!updated) throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", { recoverable: true });
    const draft = existing ?? await repo.insertWorklogDraft(tx, {
      workflowId: workflow.id,
      objectId: workflow.objectId,
      ...built,
    });
    await workflowRepo.insertWorkflowEvent(tx, {
      workflowId: workflow.id,
      eventType: "worklog_draft_generated",
      actorType: "agent",
      actorId: String(auth.userId),
      payloadJson: { draftId: draft.id, inputHash: draft.inputHash, entries: draft.entriesJson.length },
    });
    return result(updated, draft);
  });
}

export async function getWorklogDraft(auth: McpAuthContext, workflowId: number) {
  const workflow = await loadOwnedWorkflow(db, auth, workflowId);
  if (!workflow.scheduleId) throw new McpToolError(MCP_ERROR_CODES.WORKLOG_NOT_READY, "Workflow has no approved schedule");
  const draft = await repo.getLatestWorklogDraft(db, workflow.id);
  if (!draft) throw new McpToolError(MCP_ERROR_CODES.WORKLOG_DRAFT_NOT_FOUND, "Worklog draft has not been generated", { recoverable: true });
  const current = buildWorklogDraft(await repo.loadWorklogSources(db, {
    workflowId: workflow.id,
    userId: auth.userId,
    objectId: workflow.objectId,
    scheduleId: workflow.scheduleId,
  }));
  return result(workflow, draft, current.inputHash === draft.inputHash);
}
