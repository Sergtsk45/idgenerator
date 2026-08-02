import { and, asc, eq, inArray } from "drizzle-orm";

import {
  estimateAnalysisSnapshots,
  estimatePositions,
  estimateSections,
  estimates,
  positionResources,
  type EstimateAnalysisSnapshot,
  type ExecutionWorkflow,
} from "@shared/schema";
import { MCP_ERROR_CODES, McpToolError } from "../../mcp/errors";
import type { DbClient } from "../execution-workflow/workflowRepository";
import {
  computeEstimateAnalysis,
  ESTIMATE_ANALYSIS_SCHEMA_VERSION,
  ESTIMATE_ANALYSIS_VERSION,
  type EstimateAnalysis,
  type HydratedEstimate,
} from "./computeEstimateAnalysis";

export async function loadAnalysisSource(
  client: DbClient,
  workflow: ExecutionWorkflow,
): Promise<HydratedEstimate> {
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

export async function findCurrentSnapshot(
  client: DbClient,
  workflowId: number,
  analysis: EstimateAnalysis,
): Promise<EstimateAnalysisSnapshot | undefined> {
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

/** Returns the persisted analysis only when its source and contract hashes are still current. */
export async function loadCurrentEstimateAnalysis(
  client: DbClient,
  workflow: ExecutionWorkflow,
): Promise<EstimateAnalysis | undefined> {
  const analysis = computeEstimateAnalysis(await loadAnalysisSource(client, workflow));
  const snapshot = await findCurrentSnapshot(client, workflow.id, analysis);
  return snapshot?.analysisJson as EstimateAnalysis | undefined;
}
