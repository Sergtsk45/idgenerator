import { estimateAnalysisSnapshots, type ExecutionWorkflow } from "@shared/schema";
import type { McpAuthContext } from "../mcp/authContext";
import { MCP_ERROR_CODES, McpToolError } from "../mcp/errors";
import { db } from "../db";
import {
  computeEstimateAnalysis,
  ESTIMATE_ANALYSIS_SCHEMA_VERSION,
  ESTIMATE_ANALYSIS_VERSION,
  type EstimateAnalysis,
} from "./estimate-analysis/computeEstimateAnalysis";
import {
  findCurrentSnapshot,
  loadAnalysisSource,
  loadCurrentEstimateAnalysis,
} from "./estimate-analysis/currentEstimateAnalysis";
import * as workflowRepo from "./execution-workflow/workflowRepository";
import { loadOwnedWorkflow, withIdempotency } from "./execution-workflow/workflowService";

function analysisResult(workflow: ExecutionWorkflow, analysis: EstimateAnalysis) {
  return {
    workflowId: workflow.id,
    stage: workflow.stage,
    version: workflow.version,
    ...analysis,
  };
}

export async function analyzeEstimate(
  auth: McpAuthContext,
  args: { workflowId: number; expectedVersion: number; idempotencyKey: string },
) {
  return withIdempotency(auth.userId, "analyze_estimate", args.idempotencyKey, args, async (tx) => {
    const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);
    if (workflow.version !== args.expectedVersion) {
      throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
        recoverable: true,
      });
    }
    if (workflow.stage !== "estimate_imported" && workflow.stage !== "estimate_analysis_ready") {
      throw new McpToolError(
        MCP_ERROR_CODES.WORKFLOW_TRANSITION_NOT_ALLOWED,
        `Cannot analyze estimate while workflow is at "${workflow.stage}"`,
      );
    }

    const analysis = computeEstimateAnalysis(await loadAnalysisSource(tx, workflow));
    const existing = await findCurrentSnapshot(tx, workflow.id, analysis);
    if (existing && workflow.stage === "estimate_analysis_ready") {
      return analysisResult(workflow, existing.analysisJson as EstimateAnalysis);
    }

    await tx
      .insert(estimateAnalysisSnapshots)
      .values({
        workflowId: workflow.id,
        estimateId: analysis.estimateId,
        analysisVersion: ESTIMATE_ANALYSIS_VERSION,
        schemaVersion: ESTIMATE_ANALYSIS_SCHEMA_VERSION,
        inputHash: analysis.inputHash,
        analysisJson: analysis,
      })
      .onConflictDoNothing();

    const updated = workflow.stage === "estimate_imported"
      ? await workflowRepo.updateWorkflowStageIfVersionMatches(
          tx,
          workflow.id,
          args.expectedVersion,
          "estimate_analysis_ready",
        )
      : await workflowRepo.touchWorkflowIfVersionMatches(tx, workflow.id, args.expectedVersion);
    if (!updated) {
      throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
        recoverable: true,
      });
    }

    await workflowRepo.insertWorkflowEvent(tx, {
      workflowId: workflow.id,
      eventType: workflow.stage === "estimate_imported" ? "estimate_analysis_created" : "estimate_analysis_refreshed",
      actorType: "agent",
      actorId: String(auth.userId),
      payloadJson: {
        estimateId: analysis.estimateId,
        inputHash: analysis.inputHash,
        analysisVersion: ESTIMATE_ANALYSIS_VERSION,
        schemaVersion: ESTIMATE_ANALYSIS_SCHEMA_VERSION,
      },
    });
    return analysisResult(updated, analysis);
  });
}

export async function getEstimateAnalysis(auth: McpAuthContext, workflowId: number) {
  const workflow = await loadOwnedWorkflow(db, auth, workflowId);
  const analysis = await loadCurrentEstimateAnalysis(db, workflow);
  if (!analysis) {
    throw new McpToolError(MCP_ERROR_CODES.NOT_FOUND, "Current estimate analysis not found; call analyze_estimate", {
      recoverable: true,
    });
  }
  return analysisResult(workflow, analysis);
}
