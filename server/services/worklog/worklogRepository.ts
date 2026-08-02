import { and, desc, eq } from "drizzle-orm";

import {
  acts,
  estimatePositions,
  messages,
  scheduleTasks,
  worklogDrafts,
  works,
  type WorklogDraftEntry,
} from "@shared/schema";
import type { DbClient } from "../execution-workflow/workflowRepository";

export async function loadWorklogSources(client: DbClient, input: {
  workflowId: number;
  userId: number;
  objectId: number;
  scheduleId: number;
}) {
  const [taskRows, messageRows, actRows] = await Promise.all([
    client.select({ task: scheduleTasks, positionName: estimatePositions.name, workDescription: works.description })
      .from(scheduleTasks)
      .leftJoin(estimatePositions, eq(estimatePositions.id, scheduleTasks.estimatePositionId))
      .leftJoin(works, eq(works.id, scheduleTasks.workId))
      .where(eq(scheduleTasks.scheduleId, input.scheduleId)),
    client.select().from(messages).where(and(eq(messages.userId, input.userId), eq(messages.objectId, input.objectId))),
    client.select().from(acts).where(and(eq(acts.workflowId, input.workflowId), eq(acts.objectId, input.objectId))),
  ]);
  const normalizedMessages = messageRows.filter((message) => message.isProcessed && message.normalizedData?.workDescription);
  return {
    scheduleTasks: taskRows.map(({ task, positionName, workDescription }) => ({
      id: task.id,
      date: String(task.startDate),
      description: task.titleOverride?.trim() || positionName?.trim() || workDescription?.trim() || `Работа #${task.id}`,
      quantity: task.quantity === null ? null : Number(task.quantity),
      unit: task.unit ?? null,
      sourceType: task.estimatePositionId === null ? "works" as const : "estimate" as const,
      sourceId: task.estimatePositionId ?? task.workId,
    })),
    messages: normalizedMessages.map((message) => ({
      id: message.id,
      date: message.normalizedData?.date || message.createdAt?.toISOString().slice(0, 10) || "",
      description: message.normalizedData!.workDescription!,
      quantity: message.normalizedData?.quantity ?? null,
      unit: message.normalizedData?.unit ?? null,
    })).filter((message) => message.date),
    acts: actRows.map((act) => ({
      id: act.id,
      date: String(act.dateEnd ?? act.dateStart ?? ""),
      status: act.status,
      works: Array.isArray(act.worksData) ? act.worksData : [],
    })).filter((act) => act.date),
    ignoredMessages: messageRows.length - normalizedMessages.length,
    ignoredDraftActs: actRows.filter((act) => act.status !== "generated" && act.status !== "signed").length,
  };
}

export async function findWorklogDraft(client: DbClient, workflowId: number, inputHash: string) {
  const [row] = await client.select().from(worklogDrafts).where(and(
    eq(worklogDrafts.workflowId, workflowId),
    eq(worklogDrafts.inputHash, inputHash),
    eq(worklogDrafts.schemaVersion, 1),
  ));
  return row;
}

export async function getLatestWorklogDraft(client: DbClient, workflowId: number) {
  const [row] = await client.select().from(worklogDrafts)
    .where(eq(worklogDrafts.workflowId, workflowId))
    .orderBy(desc(worklogDrafts.createdAt), desc(worklogDrafts.id)).limit(1);
  return row;
}

export async function insertWorklogDraft(client: DbClient, input: {
  workflowId: number;
  objectId: number;
  inputHash: string;
  schemaVersion: number;
  entries: WorklogDraftEntry[];
  warnings: string[];
}) {
  const [row] = await client.insert(worklogDrafts).values({
    workflowId: input.workflowId,
    objectId: input.objectId,
    inputHash: input.inputHash,
    schemaVersion: input.schemaVersion,
    entriesJson: input.entries,
    warningsJson: input.warnings,
  }).returning();
  return row;
}
