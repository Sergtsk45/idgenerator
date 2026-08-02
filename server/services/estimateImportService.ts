/** Shared estimate import path used by REST and MCP. */
import { z } from "zod";
import { api } from "@shared/routes";
import {
  estimates,
  estimateSections,
  estimatePositions,
  positionResources,
  type InsertEstimatePosition,
  type InsertPositionResource,
} from "@shared/schema";
import { db } from "../db";
import type { DbClient } from "./execution-workflow/workflowRepository";

export type EstimateImportPayload = z.infer<typeof api.estimates.import.input>;
export type EstimateImportResult = { estimateId: number; sections: number; positions: number; resources: number };

export async function importEstimateWithClient(
  client: DbClient,
  rawPayload: unknown,
  objectId: number,
): Promise<EstimateImportResult> {
  const { estimate, sections, positions, resources } = api.estimates.import.input.parse(rawPayload);
  const [createdEstimate] = await client.insert(estimates).values({ ...estimate, objectId }).returning();

  const sectionIdByNumber = new Map<string, number>();
  for (const section of sections) {
    const [created] = await client
      .insert(estimateSections)
      .values({ ...section, estimateId: createdEstimate.id })
      .returning();
    sectionIdByNumber.set(created.number, created.id);
  }

  const positionIdByLineNo = new Map<string, number>();
  for (const position of positions) {
    const { sectionNumber, ...positionValues } = position;
    const [created] = await client
      .insert(estimatePositions)
      .values({
        ...positionValues,
        estimateId: createdEstimate.id,
        sectionId: sectionNumber ? sectionIdByNumber.get(sectionNumber) ?? null : null,
      } as InsertEstimatePosition)
      .returning();
    positionIdByLineNo.set(created.lineNo, created.id);
  }

  let resourceCount = 0;
  for (const resource of resources) {
    const { positionLineNo, ...resourceValues } = resource;
    const positionId = positionIdByLineNo.get(positionLineNo);
    if (!positionId) continue;
    await client.insert(positionResources).values({ ...resourceValues, positionId } as InsertPositionResource);
    resourceCount++;
  }

  return {
    estimateId: createdEstimate.id,
    sections: sections.length,
    positions: positions.length,
    resources: resourceCount,
  };
}

export async function importEstimate(rawPayload: unknown, objectId: number): Promise<EstimateImportResult> {
  return db.transaction((tx) => importEstimateWithClient(tx, rawPayload, objectId));
}
