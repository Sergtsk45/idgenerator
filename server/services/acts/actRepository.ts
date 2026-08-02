import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";

import {
  actDocumentAttachments,
  actMaterialUsages,
  acts,
  documentBindings,
  documents,
  estimatePositions,
  executionWorkflows,
  objects,
  objectParties,
  objectResponsiblePersons,
  projectMaterials,
  materialBatches,
  scheduleTasks,
  schedules,
  taskMaterials,
  works,
  type Act,
  type ActWorkItem,
  type EstimatePosition,
  type Schedule,
  type ScheduleTask,
  type TaskMaterial,
  type Work,
} from "@shared/schema";
import { resolveQualityDocumentId } from "@shared/documentBinding";
import type { DbClient } from "../execution-workflow/workflowRepository";
import type { RequiredActSourceField } from "./actsReadinessCore";

export async function getOwnedObject(client: DbClient, userId: number, objectId: number) {
  const [row] = await client
    .select()
    .from(objects)
    .where(and(eq(objects.id, objectId), eq(objects.userId, userId)));
  return row;
}

export async function getSchedule(client: DbClient, scheduleId: number): Promise<Schedule | undefined> {
  const [row] = await client.select().from(schedules).where(eq(schedules.id, scheduleId));
  return row;
}

export async function loadActSourceFieldPresence(
  client: DbClient,
  objectId: number,
): Promise<Record<RequiredActSourceField, boolean>> {
  const [[object], parties, persons] = await Promise.all([
    client.select().from(objects).where(eq(objects.id, objectId)),
    client.select().from(objectParties).where(eq(objectParties.objectId, objectId)),
    client.select().from(objectResponsiblePersons).where(eq(objectResponsiblePersons.objectId, objectId)),
  ]);
  const partyByRole = new Map(parties.map((party) => [party.role, party]));
  const personByRole = new Map(persons.map((person) => [person.role, person]));
  const present = (value: string | null | undefined) => Boolean(value?.trim());
  return {
    "object.title": present(object?.title),
    "object.address": present(object?.address),
    "object.city": present(object?.city),
    "parties.customer.fullName": present(partyByRole.get("customer")?.fullName),
    "parties.builder.fullName": present(partyByRole.get("builder")?.fullName),
    "parties.designer.fullName": present(partyByRole.get("designer")?.fullName),
    "persons.rep_customer_control.personName": present(personByRole.get("rep_customer_control")?.personName),
    "persons.rep_builder.personName": present(personByRole.get("rep_builder")?.personName),
    "persons.rep_builder_control.personName": present(personByRole.get("rep_builder_control")?.personName),
    "persons.rep_designer.personName": present(personByRole.get("rep_designer")?.personName),
    "persons.rep_work_performer.personName": present(personByRole.get("rep_work_performer")?.personName),
  };
}

export async function findOwnedWorkflowIdBySchedule(
  client: DbClient,
  input: { userId: number; objectId: number; scheduleId: number },
): Promise<number | null> {
  const [row] = await client
    .select({ id: executionWorkflows.id })
    .from(executionWorkflows)
    .where(and(
      eq(executionWorkflows.userId, input.userId),
      eq(executionWorkflows.objectId, input.objectId),
      eq(executionWorkflows.scheduleId, input.scheduleId),
    ))
    .orderBy(desc(executionWorkflows.id))
    .limit(1);
  return row?.id ?? null;
}

export async function listScheduleTasks(client: DbClient, scheduleId: number): Promise<ScheduleTask[]> {
  return client
    .select()
    .from(scheduleTasks)
    .where(eq(scheduleTasks.scheduleId, scheduleId))
    .orderBy(asc(scheduleTasks.orderIndex), asc(scheduleTasks.id));
}

export async function listEstimatePositions(client: DbClient, ids: number[]): Promise<EstimatePosition[]> {
  if (ids.length === 0) return [];
  return client.select().from(estimatePositions).where(inArray(estimatePositions.id, ids));
}

export async function listWorks(client: DbClient, ids: number[]): Promise<Work[]> {
  if (ids.length === 0) return [];
  return client.select().from(works).where(inArray(works.id, ids));
}

export async function listTaskMaterials(client: DbClient, taskIds: number[]): Promise<TaskMaterial[]> {
  if (taskIds.length === 0) return [];
  return client
    .select()
    .from(taskMaterials)
    .where(inArray(taskMaterials.taskId, taskIds))
    .orderBy(asc(taskMaterials.orderIndex), asc(taskMaterials.id));
}

export async function projectMaterialsBelongToObject(
  client: DbClient,
  projectMaterialIds: number[],
  objectId: number,
): Promise<boolean> {
  if (projectMaterialIds.length === 0) return true;
  const rows = await client
    .select({ id: projectMaterials.id })
    .from(projectMaterials)
    .where(and(
      inArray(projectMaterials.id, projectMaterialIds),
      eq(projectMaterials.objectId, objectId),
      isNull(projectMaterials.deletedAt),
    ));
  return rows.length === new Set(projectMaterialIds).size;
}

export async function explicitQualityDocumentsAreValid(
  client: DbClient,
  rows: Array<Pick<TaskMaterial, "projectMaterialId" | "batchId" | "qualityDocumentId">>,
  objectId: number,
): Promise<boolean> {
  const batchIds = Array.from(new Set(rows.flatMap((row) => row.batchId === null ? [] : [Number(row.batchId)])));
  if (batchIds.length > 0) {
    const batches = await client.select({
      id: materialBatches.id,
      objectId: materialBatches.objectId,
      projectMaterialId: materialBatches.projectMaterialId,
    }).from(materialBatches).where(inArray(materialBatches.id, batchIds));
    if (!rows.every((row) => row.batchId === null || batches.some((batch) =>
      Number(batch.id) === Number(row.batchId)
        && batch.objectId === objectId
        && Number(batch.projectMaterialId) === Number(row.projectMaterialId),
    ))) return false;
  }
  const explicit = rows.filter((row) => row.qualityDocumentId !== null);
  if (explicit.length === 0) return true;
  const today = new Date().toISOString().slice(0, 10);
  const documentIds = Array.from(new Set(explicit.map((row) => Number(row.qualityDocumentId))));
  const bindings = await client
    .select({ binding: documentBindings, document: documents })
    .from(documentBindings)
    .innerJoin(documents, and(eq(documents.id, documentBindings.documentId), isNull(documents.deletedAt)))
    .where(and(
      inArray(documentBindings.documentId, documentIds),
      eq(documentBindings.useInActs, true),
      inArray(documentBindings.bindingRole, ["quality", "passport", "protocol"]),
      or(eq(documents.scope, "global"), and(eq(documents.scope, "project"), eq(documents.objectId, objectId))),
      or(isNull(documents.validFrom), lte(documents.validFrom, today)),
      or(isNull(documents.validTo), gte(documents.validTo, today)),
    ));
  return explicit.every((row) => bindings.some(({ binding }) =>
    Number(binding.documentId) === Number(row.qualityDocumentId)
      && (Number(binding.projectMaterialId) === Number(row.projectMaterialId)
        || (row.batchId !== null && Number(binding.batchId) === Number(row.batchId))),
  ));
}

export async function documentsAreVisibleForObject(
  client: DbClient,
  documentIds: number[],
  objectId: number,
): Promise<boolean> {
  if (documentIds.length === 0) return true;
  const ids = Array.from(new Set(documentIds));
  const rows = await client.select({ id: documents.id }).from(documents).where(and(
    inArray(documents.id, ids),
    isNull(documents.deletedAt),
    or(eq(documents.scope, "global"), and(eq(documents.scope, "project"), eq(documents.objectId, objectId))),
  ));
  return rows.length === ids.length;
}

/** Resolves the same primary/use-in-acts quality fallback as the legacy storage path, in one batch. */
export async function qualityDocumentFallbacks(
  client: DbClient,
  projectMaterialIds: number[],
): Promise<Map<number, number>> {
  if (projectMaterialIds.length === 0) return new Map();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await client
    .select({ binding: documentBindings, documentId: documents.id })
    .from(documentBindings)
    .innerJoin(projectMaterials, eq(projectMaterials.id, documentBindings.projectMaterialId))
    .innerJoin(documents, and(eq(documents.id, documentBindings.documentId), isNull(documents.deletedAt)))
    .where(and(
      inArray(documentBindings.projectMaterialId, projectMaterialIds),
      eq(documentBindings.useInActs, true),
      inArray(documentBindings.bindingRole, ["quality", "passport", "protocol"]),
      or(eq(documents.scope, "global"), eq(documents.objectId, projectMaterials.objectId)),
      or(isNull(documents.validFrom), lte(documents.validFrom, today)),
      or(isNull(documents.validTo), gte(documents.validTo, today)),
    ))
    .orderBy(desc(documentBindings.createdAt), desc(documentBindings.id));

  const byMaterial = new Map<number, typeof rows>();
  for (const row of rows) {
    if (row.binding.projectMaterialId === null) continue;
    const materialId = Number(row.binding.projectMaterialId);
    const list = byMaterial.get(materialId) ?? [];
    list.push(row);
    byMaterial.set(materialId, list);
  }
  const result = new Map<number, number>();
  for (const [materialId, bindings] of Array.from(byMaterial.entries())) {
    const documentId = resolveQualityDocumentId(bindings.map((row) => row.binding));
    if (documentId !== null) result.set(materialId, documentId);
  }
  return result;
}

export interface ActUpsertInput {
  objectId: number;
  workflowId: number | null;
  scheduleId: number;
  actNumber: number;
  actTemplateId: number | null;
  dateStart: string | null;
  dateEnd: string | null;
  status: "draft" | "generated";
  worksData: ActWorkItem[];
  projectDrawingsAgg: string | null;
  normativeRefsAgg: string | null;
  executiveSchemesAgg: Array<{ title: string; fileUrl?: string }> | null;
}

export async function upsertScopedAct(
  client: DbClient,
  input: ActUpsertInput,
): Promise<{ act: Act; created: boolean; preservedSigned: boolean }> {
  const scope = input.workflowId === null
    ? and(eq(acts.objectId, input.objectId), isNull(acts.workflowId), eq(acts.actNumber, input.actNumber))
    : and(eq(acts.workflowId, input.workflowId), eq(acts.actNumber, input.actNumber));
  const [existing] = await client.select().from(acts).where(scope);
  if (existing) {
    if (existing.status === "signed") return { act: existing, created: false, preservedSigned: true };
    const [updated] = await client
      .update(acts)
      .set({
        objectId: input.objectId,
        workflowId: input.workflowId,
        scheduleId: input.scheduleId,
        actTemplateId: input.actTemplateId ?? existing.actTemplateId ?? null,
        dateStart: input.dateStart,
        dateEnd: input.dateEnd,
        status: input.status,
        worksData: input.worksData,
        projectDrawingsAgg: input.projectDrawingsAgg,
        normativeRefsAgg: input.normativeRefsAgg,
        executiveSchemesAgg: input.executiveSchemesAgg,
      })
      .where(eq(acts.id, existing.id))
      .returning();
    return { act: updated, created: false, preservedSigned: false };
  }

  const [created] = await client.insert(acts).values(input).returning();
  return { act: created, created: true, preservedSigned: false };
}

export async function replaceActMaterialUsages(
  client: DbClient,
  actId: number,
  items: Array<{
    projectMaterialId: number;
    workId: number | null;
    batchId: number | null;
    qualityDocumentId: number | null;
    note: string | null;
    orderIndex: number;
  }>,
): Promise<void> {
  await client.delete(actMaterialUsages).where(eq(actMaterialUsages.actId, actId));
  if (items.length > 0) await client.insert(actMaterialUsages).values(items.map((item) => ({ ...item, actId })));
}

/** Manual appendix edits are immutable from schedule regeneration. */
export async function replaceAutomaticActAttachments(
  client: DbClient,
  act: Act,
  documentIds: number[],
): Promise<void> {
  if (act.attachmentsManual) return;
  await client.delete(actDocumentAttachments).where(eq(actDocumentAttachments.actId, act.id));
  if (documentIds.length > 0) {
    await client.insert(actDocumentAttachments).values(
      documentIds.map((documentId, orderIndex) => ({ actId: act.id, documentId, orderIndex })),
    );
  }
}

export async function listScopedActs(
  client: DbClient,
  input: { objectId: number; workflowId: number | null },
): Promise<Act[]> {
  const scope = input.workflowId === null
    ? and(eq(acts.objectId, input.objectId), isNull(acts.workflowId))
    : eq(acts.workflowId, input.workflowId);
  return client.select().from(acts).where(scope).orderBy(asc(acts.actNumber), asc(acts.id));
}
