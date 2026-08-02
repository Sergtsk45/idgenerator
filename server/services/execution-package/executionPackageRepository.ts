import { and, asc, desc, eq } from "drizzle-orm";

import {
  actArtifacts,
  actDocumentAttachments,
  acts,
  executionPackages,
  executionWorkflowEvents,
  objects,
  scheduleDrafts,
  scheduleTasks,
  schedules,
  worklogDrafts,
  type ExecutionPackageMode,
} from "@shared/schema";
import type { DbClient } from "../execution-workflow/workflowRepository";

export async function loadPackageSources(client: DbClient, input: {
  workflowId: number;
  userId: number;
  objectId: number;
  scheduleId: number;
}) {
  const [scheduleRows, tasks, workflowActs, artifacts, attachmentRows, events, drafts, worklogs] = await Promise.all([
    client.select().from(schedules).where(and(eq(schedules.id, input.scheduleId), eq(schedules.objectId, input.objectId))),
    client.select().from(scheduleTasks).where(eq(scheduleTasks.scheduleId, input.scheduleId)).orderBy(asc(scheduleTasks.orderIndex), asc(scheduleTasks.id)),
    client.select().from(acts).where(and(eq(acts.workflowId, input.workflowId), eq(acts.objectId, input.objectId))).orderBy(asc(acts.actNumber), asc(acts.id)),
    client.select().from(actArtifacts).where(and(
      eq(actArtifacts.workflowId, input.workflowId),
      eq(actArtifacts.userId, input.userId),
      eq(actArtifacts.objectId, input.objectId),
    )).orderBy(desc(actArtifacts.createdAt), desc(actArtifacts.id)),
    client.select({ actId: actDocumentAttachments.actId }).from(actDocumentAttachments)
      .innerJoin(acts, and(eq(acts.id, actDocumentAttachments.actId), eq(acts.workflowId, input.workflowId))),
    client.select().from(executionWorkflowEvents).where(eq(executionWorkflowEvents.workflowId, input.workflowId))
      .orderBy(asc(executionWorkflowEvents.createdAt), asc(executionWorkflowEvents.id)),
    client.select().from(scheduleDrafts).where(eq(scheduleDrafts.workflowId, input.workflowId))
      .orderBy(desc(scheduleDrafts.version), desc(scheduleDrafts.id)).limit(1),
    client.select().from(worklogDrafts).where(eq(worklogDrafts.workflowId, input.workflowId))
      .orderBy(desc(worklogDrafts.createdAt), desc(worklogDrafts.id)).limit(1),
  ]);
  return {
    schedule: scheduleRows[0],
    tasks,
    acts: workflowActs,
    artifacts,
    attachmentActIds: new Set(attachmentRows.map((row) => row.actId)),
    events,
    scheduleDraft: drafts[0],
    worklogDraft: worklogs[0],
  };
}

export async function findPackageByInput(client: DbClient, workflowId: number, mode: ExecutionPackageMode, inputHash: string) {
  const [row] = await client.select().from(executionPackages).where(and(
    eq(executionPackages.workflowId, workflowId),
    eq(executionPackages.mode, mode),
    eq(executionPackages.inputHash, inputHash),
  ));
  return row;
}

export async function insertPackage(client: DbClient, input: typeof executionPackages.$inferInsert) {
  const [row] = await client.insert(executionPackages).values(input).returning();
  return row;
}

export async function loadOwnedPackage(client: DbClient, userId: number, packageId: string) {
  const [row] = await client.select({ package: executionPackages }).from(executionPackages)
    .innerJoin(objects, and(eq(objects.id, executionPackages.objectId), eq(objects.userId, userId)))
    .where(and(eq(executionPackages.id, packageId), eq(executionPackages.userId, userId)));
  return row?.package;
}
