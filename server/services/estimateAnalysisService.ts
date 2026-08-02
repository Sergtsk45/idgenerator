import { and, asc, eq, inArray } from "drizzle-orm";
import {
  estimateAnalysisSnapshots,
  estimatePositions,
  estimateSections,
  estimates,
  positionResources,
  type ExecutionWorkflow,
} from "@shared/schema";
import type { McpAuthContext } from "../mcp/authContext";
import { MCP_ERROR_CODES, McpToolError } from "../mcp/errors";
import { db } from "../db";
import {
  computeEstimateAnalysis,
  ESTIMATE_ANALYSIS_SCHEMA_VERSION,
  ESTIMATE_ANALYSIS_VERSION,
  type EstimateAnalysis,
  type HydratedEstimate,
} from "./estimate-analysis/computeEstimateAnalysis";
import type { DbClient } from "./execution-workflow/workflowRepository";
import * as workflowRepo from "./execution-workflow/workflowRepository";
import { loadOwnedWorkflow, withIdempotency } from "./execution-workflow/workflowService";

async function loadAnalysisSource(client: DbClient, workflow: ExecutionWorkflow): Promise<HydratedEstimate> {
  if (!workflow.estimateId) {
    throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_ESTIMATE_NOT_SET, "Workflow has no imported estimate");
  }

  const [estimate] = await client.select().from(estimates).where(eq(estimates.id, workflow.estimateId));
  if (!estimate || estimate.objectId !== workflow.objectId) {
    throw new McpToolError(MCP_ERROR_CODES.ESTIMATE_NOT_FOUND, "Estimate not found");
  }

  const [sections, positions] = await Promise.all([
    client
      .select()
      .from(estimateSections)
      .where(eq(estimateSections.estimateId, estimate.id))
      .orderBy(asc(estimateSections.orderIndex), asc(estimateSections.id)),
    client
      .select()
      .from(estimatePositions)
      .where(eq(estimatePositions.estimateId, estimate.id))
      .orderBy(asc(estimatePositions.orderIndex), asc(estimatePositions.id)),
  ]);
  const resources = positions.length
    ? await client
        .select()
        .from(positionResources)
        .where(inArray(positionResources.positionId, positions.map((position) => position.id)))
        .orderBy(asc(positionResources.orderIndex), asc(positionResources.id))
    : [];

  const resourcesByPosition = new Map<number, typeof resources>();
  for (const resource of resources) {
    const list = resourcesByPosition.get(resource.positionId) ?? [];
    list.push(resource);
    resourcesByPosition.set(resource.positionId, list);
  }
  const positionsBySection = new Map<number | null, Array<(typeof positions)[number] & { resources: typeof resources }>>();
  for (const position of positions) {
    const sectionId = position.sectionId ?? null;
    const list = positionsBySection.get(sectionId) ?? [];
    list.push({ ...position, resources: resourcesByPosition.get(position.id) ?? [] });
    positionsBySection.set(sectionId, list);
  }

  const hydratedSections = sections.map((section) => ({
    ...section,
    positions: positionsBySection.get(section.id) ?? [],
  }));
  const unsectioned = positionsBySection.get(null);
  if (unsectioned?.length) {
    hydratedSections.unshift({
      id: 0,
      estimateId: estimate.id,
      number: "0",
      title: "Без раздела",
      orderIndex: -1,
      positions: unsectioned,
    });
  }

  return { estimate, sections: hydratedSections };
}

function analysisResult(workflow: ExecutionWorkflow, analysis: EstimateAnalysis) {
  return {
    workflowId: workflow.id,
    stage: workflow.stage,
    version: workflow.version,
    ...analysis,
  };
}

async function findCurrentSnapshot(client: DbClient, workflowId: number, analysis: EstimateAnalysis) {
  const [snapshot] = await client
    .select()
    .from(estimateAnalysisSnapshots)
    .where(
      and(
        eq(estimateAnalysisSnapshots.workflowId, workflowId),
        eq(estimateAnalysisSnapshots.inputHash, analysis.inputHash),
        eq(estimateAnalysisSnapshots.analysisVersion, ESTIMATE_ANALYSIS_VERSION),
        eq(estimateAnalysisSnapshots.schemaVersion, ESTIMATE_ANALYSIS_SCHEMA_VERSION),
      ),
    );
  return snapshot;
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
  const analysis = computeEstimateAnalysis(await loadAnalysisSource(db, workflow));
  const snapshot = await findCurrentSnapshot(db, workflow.id, analysis);
  if (!snapshot) {
    throw new McpToolError(MCP_ERROR_CODES.NOT_FOUND, "Current estimate analysis not found; call analyze_estimate", {
      recoverable: true,
    });
  }
  return analysisResult(workflow, snapshot.analysisJson as EstimateAnalysis);
}
