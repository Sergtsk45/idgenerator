import { and, asc, eq, inArray, isNull, notInArray, or, sql } from "drizzle-orm";

import {
  documentBindings,
  documents,
  materialBatches,
  materialRegisterItems,
  materialRegisterRequirements,
  materialRegisterSourceLinks,
  materialRegisterStates,
  projectMaterials,
  scheduleTasks,
  taskMaterials,
  type MaterialClassificationConfidence,
  type MaterialClassificationMethod,
  type MaterialRegisterClassification,
  type MaterialRegisterItem,
  type MaterialRequirementDocumentType,
  type MaterialRegisterRequirement,
  type MaterialRegisterSourceLink,
  type MaterialRegisterSourceType,
  type MaterialRegisterState,
  type ProjectMaterial,
  type ScheduleTask,
} from "@shared/schema";
import type { DbClient } from "../execution-workflow/workflowRepository";

export async function getMaterialRegisterState(
  client: DbClient,
  workflowId: number,
): Promise<MaterialRegisterState | undefined> {
  const [row] = await client
    .select()
    .from(materialRegisterStates)
    .where(eq(materialRegisterStates.workflowId, workflowId));
  return row;
}

export async function upsertMaterialRegisterState(
  client: DbClient,
  state: { workflowId: number; estimateId: number; inputHash: string; rulesVersion: string },
): Promise<MaterialRegisterState> {
  const [row] = await client
    .insert(materialRegisterStates)
    .values(state)
    .onConflictDoUpdate({
      target: materialRegisterStates.workflowId,
      set: {
        estimateId: state.estimateId,
        inputHash: state.inputHash,
        rulesVersion: state.rulesVersion,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function listMaterialRegisterItems(
  client: DbClient,
  workflowId: number,
  options: { activeOnly?: boolean } = { activeOnly: true },
): Promise<MaterialRegisterItem[]> {
  const condition = options.activeOnly === false
    ? eq(materialRegisterItems.workflowId, workflowId)
    : and(eq(materialRegisterItems.workflowId, workflowId), eq(materialRegisterItems.active, true));
  return client
    .select()
    .from(materialRegisterItems)
    .where(condition)
    .orderBy(asc(materialRegisterItems.id));
}

export async function getMaterialRegisterItem(
  client: DbClient,
  workflowId: number,
  itemId: number,
): Promise<MaterialRegisterItem | undefined> {
  const [row] = await client
    .select()
    .from(materialRegisterItems)
    .where(and(eq(materialRegisterItems.id, itemId), eq(materialRegisterItems.workflowId, workflowId)));
  return row;
}

export async function replaceMaterialRegisterItemProjectMaterial(
  client: DbClient,
  workflowId: number,
  itemId: number,
  projectMaterialId: number,
): Promise<MaterialRegisterItem | undefined> {
  const [row] = await client
    .update(materialRegisterItems)
    .set({ projectMaterialId, active: true, updatedAt: new Date() })
    .where(and(eq(materialRegisterItems.id, itemId), eq(materialRegisterItems.workflowId, workflowId)))
    .returning();
  return row;
}

export async function findMaterialRegisterItemByFingerprint(
  client: DbClient,
  workflowId: number,
  fingerprint: string,
): Promise<MaterialRegisterItem | undefined> {
  const [row] = await client
    .select()
    .from(materialRegisterItems)
    .where(and(eq(materialRegisterItems.workflowId, workflowId), eq(materialRegisterItems.fingerprint, fingerprint)));
  return row;
}

export async function createGeneratedProjectMaterial(
  client: DbClient,
  args: { objectId: number; name: string; unit: string | null },
): Promise<ProjectMaterial> {
  const [row] = await client
    .insert(projectMaterials)
    .values({
      objectId: args.objectId,
      catalogMaterialId: null,
      nameOverride: args.name,
      baseUnitOverride: args.unit,
      paramsOverride: {},
    })
    .returning();
  return row;
}

export async function listActiveProjectMaterials(client: DbClient, objectId: number): Promise<ProjectMaterial[]> {
  return client
    .select()
    .from(projectMaterials)
    .where(and(eq(projectMaterials.objectId, objectId), isNull(projectMaterials.deletedAt)))
    .orderBy(asc(projectMaterials.id));
}

export interface GeneratedMaterialRegisterItem {
  workflowId: number;
  projectMaterialId: number;
  fingerprint: string;
  normalizedName: string;
  normalizedUnit: string | null;
  classification: MaterialRegisterClassification;
  classificationMethod: Exclude<MaterialClassificationMethod, "manual">;
  confidence: MaterialClassificationConfidence;
  confirmed: boolean;
  classificationRuleId: string | null;
}

/** Rebuild helper: a persisted manual classification is never overwritten. */
export async function upsertGeneratedMaterialRegisterItem(
  client: DbClient,
  item: GeneratedMaterialRegisterItem,
): Promise<MaterialRegisterItem> {
  const [existing] = await client
    .select()
    .from(materialRegisterItems)
    .where(and(
      eq(materialRegisterItems.workflowId, item.workflowId),
      eq(materialRegisterItems.projectMaterialId, item.projectMaterialId),
    ));

  if (!existing) {
    const [created] = await client.insert(materialRegisterItems).values({ ...item, active: true }).returning();
    return created;
  }

  const preserveManual = existing.classificationMethod === "manual";
  const [updated] = await client
    .update(materialRegisterItems)
    .set({
      normalizedName: item.normalizedName,
      normalizedUnit: item.normalizedUnit,
      active: true,
      updatedAt: new Date(),
      ...(!preserveManual ? {
        fingerprint: item.fingerprint,
        classification: item.classification,
        classificationMethod: item.classificationMethod,
        confidence: item.confidence,
        confirmed: item.confirmed,
        classificationRuleId: item.classificationRuleId,
      } : {}),
    })
    .where(eq(materialRegisterItems.id, existing.id))
    .returning();
  return updated;
}

export async function confirmMaterialRegisterClassification(
  client: DbClient,
  args: {
    workflowId: number;
    itemId: number;
    classification: MaterialRegisterClassification;
    confidence?: MaterialClassificationConfidence;
  },
): Promise<MaterialRegisterItem | undefined> {
  const [row] = await client
    .update(materialRegisterItems)
    .set({
      fingerprint: `manual:${args.itemId}`,
      classification: args.classification,
      classificationMethod: "manual",
      confidence: args.confidence ?? "high",
      confirmed: true,
      classificationRuleId: null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(materialRegisterItems.id, args.itemId),
      eq(materialRegisterItems.workflowId, args.workflowId),
    ))
    .returning();
  return row;
}

export async function deactivateMaterialRegisterItemsExcept(
  client: DbClient,
  workflowId: number,
  activeItemIds: number[],
): Promise<number[]> {
  const condition = activeItemIds.length
    ? and(
        eq(materialRegisterItems.workflowId, workflowId),
        eq(materialRegisterItems.active, true),
        notInArray(materialRegisterItems.id, activeItemIds),
      )
    : and(eq(materialRegisterItems.workflowId, workflowId), eq(materialRegisterItems.active, true));
  const rows = await client
    .update(materialRegisterItems)
    .set({ active: false, updatedAt: new Date() })
    .where(condition)
    .returning({ id: materialRegisterItems.id });
  return rows.map((row) => row.id);
}

export async function listMaterialRegisterSourceLinks(
  client: DbClient,
  workflowId: number,
): Promise<MaterialRegisterSourceLink[]> {
  return client
    .select()
    .from(materialRegisterSourceLinks)
    .where(eq(materialRegisterSourceLinks.workflowId, workflowId))
    .orderBy(asc(materialRegisterSourceLinks.id));
}

export interface MaterialRegisterSourceInput {
  workflowId: number;
  itemId: number;
  estimateId: number;
  estimatePositionId: number;
  positionResourceId: number | null;
  scheduleTaskId: number | null;
  sourceType: MaterialRegisterSourceType;
  sourceName: string;
  sourceUnit: string | null;
  sourceQuantity: string | null;
  normalizedName: string;
  normalizedUnit: string | null;
}

export async function upsertMaterialRegisterSourceLink(
  client: DbClient,
  source: MaterialRegisterSourceInput,
): Promise<MaterialRegisterSourceLink> {
  const sourceCondition = source.positionResourceId === null
    ? and(
        eq(materialRegisterSourceLinks.workflowId, source.workflowId),
        eq(materialRegisterSourceLinks.estimatePositionId, source.estimatePositionId),
        isNull(materialRegisterSourceLinks.positionResourceId),
      )
    : and(
        eq(materialRegisterSourceLinks.workflowId, source.workflowId),
        eq(materialRegisterSourceLinks.positionResourceId, source.positionResourceId),
      );
  const [existing] = await client.select().from(materialRegisterSourceLinks).where(sourceCondition);
  if (!existing) {
    const [created] = await client.insert(materialRegisterSourceLinks).values(source).returning();
    return created;
  }
  const [updated] = await client
    .update(materialRegisterSourceLinks)
    .set({ ...source, updatedAt: new Date() })
    .where(eq(materialRegisterSourceLinks.id, existing.id))
    .returning();
  return updated;
}

export async function deleteMaterialRegisterSourceLinksExcept(
  client: DbClient,
  workflowId: number,
  activeLinkIds: number[],
): Promise<number[]> {
  const condition = activeLinkIds.length
    ? and(
        eq(materialRegisterSourceLinks.workflowId, workflowId),
        notInArray(materialRegisterSourceLinks.id, activeLinkIds),
      )
    : eq(materialRegisterSourceLinks.workflowId, workflowId);
  const rows = await client
    .delete(materialRegisterSourceLinks)
    .where(condition)
    .returning({ id: materialRegisterSourceLinks.id });
  return rows.map((row) => row.id);
}

export async function listMaterialRegisterRequirements(
  client: DbClient,
  itemIds: number[],
): Promise<MaterialRegisterRequirement[]> {
  if (itemIds.length === 0) return [];
  return client
    .select()
    .from(materialRegisterRequirements)
    .where(inArray(materialRegisterRequirements.itemId, itemIds))
    .orderBy(asc(materialRegisterRequirements.itemId), asc(materialRegisterRequirements.id));
}

export async function replaceMaterialRegisterRequirements(
  client: DbClient,
  itemId: number,
  requirements: Array<{ ruleId: string; documentType: MaterialRequirementDocumentType; reason: string }>,
): Promise<MaterialRegisterRequirement[]> {
  await client.delete(materialRegisterRequirements).where(eq(materialRegisterRequirements.itemId, itemId));
  if (requirements.length === 0) return [];
  return client
    .insert(materialRegisterRequirements)
    .values(requirements.map((requirement) => ({ itemId, ...requirement })))
    .returning();
}

export async function listScheduleTasksForMaterialRegister(
  client: DbClient,
  scheduleId: number,
): Promise<ScheduleTask[]> {
  return client
    .select()
    .from(scheduleTasks)
    .where(eq(scheduleTasks.scheduleId, scheduleId))
    .orderBy(asc(scheduleTasks.orderIndex), asc(scheduleTasks.id));
}

/** Reconciles only generated rows; any manual/document-bearing row for the pair wins. */
export async function reconcileGeneratedTaskMaterialLinks(
  client: DbClient,
  scheduleId: number,
  desired: Array<{ taskId: number; projectMaterialId: number }>,
): Promise<{ created: number; removed: number }> {
  const scheduleTaskRows = await client
    .select({ id: scheduleTasks.id })
    .from(scheduleTasks)
    .where(eq(scheduleTasks.scheduleId, scheduleId));
  const scheduleTaskIds = scheduleTaskRows.map((row) => row.id);
  if (scheduleTaskIds.length === 0) return { created: 0, removed: 0 };
  const allowedTaskIds = new Set(scheduleTaskIds);
  const desiredPairs = new Map<string, { taskId: number; projectMaterialId: number }>();
  for (const pair of desired) {
    if (!allowedTaskIds.has(pair.taskId)) continue;
    desiredPairs.set(`${pair.taskId}:${pair.projectMaterialId}`, pair);
  }

  const existing = await client
    .select()
    .from(taskMaterials)
    .where(inArray(taskMaterials.taskId, scheduleTaskIds));
  const manualPairs = new Set(existing
    .filter((row) => row.source !== "material_register")
    .map((row) => `${row.taskId}:${row.projectMaterialId}`));
  const generatedToDelete = existing.filter((row) => {
    if (row.source !== "material_register") return false;
    const key = `${row.taskId}:${row.projectMaterialId}`;
    return !desiredPairs.has(key) || manualPairs.has(key);
  });
  if (generatedToDelete.length) {
    await client.delete(taskMaterials).where(inArray(taskMaterials.id, generatedToDelete.map((row) => row.id)));
  }

  const deletedIds = new Set(generatedToDelete.map((row) => row.id));
  const remainingPairs = new Set(existing
    .filter((row) => !deletedIds.has(row.id))
    .map((row) => `${row.taskId}:${row.projectMaterialId}`));
  let created = 0;
  for (const [key, pair] of Array.from(desiredPairs)) {
    if (remainingPairs.has(key)) continue;
    const [order] = await client
      .select({ value: sql<number>`COALESCE(MAX(${taskMaterials.orderIndex}), -1)` })
      .from(taskMaterials)
      .where(eq(taskMaterials.taskId, pair.taskId));
    const inserted = await client.insert(taskMaterials).values({
      taskId: pair.taskId,
      projectMaterialId: pair.projectMaterialId,
      batchId: null,
      qualityDocumentId: null,
      source: "material_register",
      orderIndex: Number(order?.value ?? -1) + 1,
    }).onConflictDoNothing().returning({ id: taskMaterials.id });
    remainingPairs.add(key);
    created += inserted.length;
  }
  return { created, removed: generatedToDelete.length };
}

export async function generatedTaskMaterialLinksMatch(
  client: DbClient,
  scheduleId: number,
  desired: Array<{ taskId: number; projectMaterialId: number }>,
): Promise<boolean> {
  const scheduleTaskRows = await client
    .select({ id: scheduleTasks.id })
    .from(scheduleTasks)
    .where(eq(scheduleTasks.scheduleId, scheduleId));
  const taskIds = scheduleTaskRows.map((row) => row.id);
  if (taskIds.length === 0) return desired.length === 0;
  const rows = await client.select().from(taskMaterials).where(inArray(taskMaterials.taskId, taskIds));
  const manual = new Set(rows
    .filter((row) => row.source !== "material_register")
    .map((row) => `${row.taskId}:${row.projectMaterialId}`));
  const expected = new Set(desired
    .map((row) => `${row.taskId}:${row.projectMaterialId}`)
    .filter((key) => !manual.has(key)));
  const actual = new Set(rows
    .filter((row) => row.source === "material_register")
    .map((row) => `${row.taskId}:${row.projectMaterialId}`));
  return expected.size === actual.size && Array.from(expected).every((key) => actual.has(key));
}

/** Flat rows; the service groups them per requirement and applies validity/readiness policy. */
export async function listMaterialRequirementDocumentMatches(client: DbClient, workflowId: number) {
  return client
    .select({
      itemId: materialRegisterItems.id,
      projectMaterialId: materialRegisterItems.projectMaterialId,
      requirementId: materialRegisterRequirements.id,
      ruleId: materialRegisterRequirements.ruleId,
      documentType: materialRegisterRequirements.documentType,
      reason: materialRegisterRequirements.reason,
      bindingId: documentBindings.id,
      bindingProjectMaterialId: documentBindings.projectMaterialId,
      bindingBatchId: documentBindings.batchId,
      bindingUseInActs: documentBindings.useInActs,
      bindingRole: documentBindings.bindingRole,
      documentId: documents.id,
      documentScope: documents.scope,
      documentObjectId: documents.objectId,
      documentValidFrom: documents.validFrom,
      documentValidTo: documents.validTo,
    })
    .from(materialRegisterItems)
    .innerJoin(materialRegisterRequirements, eq(materialRegisterRequirements.itemId, materialRegisterItems.id))
    .leftJoin(materialBatches, eq(materialBatches.projectMaterialId, materialRegisterItems.projectMaterialId))
    .leftJoin(
      documentBindings,
      or(
        eq(documentBindings.projectMaterialId, materialRegisterItems.projectMaterialId),
        eq(documentBindings.batchId, materialBatches.id),
      ),
    )
    .leftJoin(
      documents,
      and(
        eq(documents.id, documentBindings.documentId),
        eq(documents.docType, materialRegisterRequirements.documentType),
        isNull(documents.deletedAt),
      ),
    )
    .where(and(eq(materialRegisterItems.workflowId, workflowId), eq(materialRegisterItems.active, true)))
    .orderBy(asc(materialRegisterItems.id), asc(materialRegisterRequirements.id));
}
