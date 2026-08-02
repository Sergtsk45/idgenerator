import { and, asc, desc, eq, isNull, max } from "drizzle-orm";

import {
  scheduleDrafts,
  schedules,
  scheduleTasks,
  type InsertScheduleTask,
  type Schedule,
  type ScheduleDraft,
  type ScheduleTask,
} from "@shared/schema";
import type { DbClient } from "../execution-workflow/workflowRepository";

export async function getScheduleDraftById(
  client: DbClient,
  id: number,
): Promise<ScheduleDraft | undefined> {
  const [row] = await client.select().from(scheduleDrafts).where(eq(scheduleDrafts.id, id));
  return row;
}

export async function getScheduleDraftByVersion(
  client: DbClient,
  workflowId: number,
  version: number,
): Promise<ScheduleDraft | undefined> {
  const [row] = await client
    .select()
    .from(scheduleDrafts)
    .where(and(eq(scheduleDrafts.workflowId, workflowId), eq(scheduleDrafts.version, version)));
  return row;
}

export async function getLatestScheduleDraft(
  client: DbClient,
  workflowId: number,
): Promise<ScheduleDraft | undefined> {
  const [row] = await client
    .select()
    .from(scheduleDrafts)
    .where(eq(scheduleDrafts.workflowId, workflowId))
    .orderBy(desc(scheduleDrafts.version), desc(scheduleDrafts.id))
    .limit(1);
  return row;
}

export async function findScheduleDraftByInputHash(
  client: DbClient,
  args: { workflowId: number; inputHash: string; plannerVersion: string; schemaVersion: number },
): Promise<ScheduleDraft | undefined> {
  const [row] = await client
    .select()
    .from(scheduleDrafts)
    .where(and(
      eq(scheduleDrafts.workflowId, args.workflowId),
      eq(scheduleDrafts.inputHash, args.inputHash),
      eq(scheduleDrafts.plannerVersion, args.plannerVersion),
      eq(scheduleDrafts.schemaVersion, args.schemaVersion),
    ));
  return row;
}

/** Safe after the caller has won the workflow-version CAS in the same transaction. */
export async function getNextScheduleDraftVersion(client: DbClient, workflowId: number): Promise<number> {
  const [row] = await client
    .select({ value: max(scheduleDrafts.version) })
    .from(scheduleDrafts)
    .where(eq(scheduleDrafts.workflowId, workflowId));
  return Number(row?.value ?? 0) + 1;
}

export async function insertScheduleDraft(
  client: DbClient,
  draft: {
    workflowId: number;
    estimateId: number;
    version: number;
    plannerVersion: string;
    schemaVersion: number;
    inputHash: string;
    draftJson: unknown;
  },
): Promise<ScheduleDraft> {
  const [row] = await client.insert(scheduleDrafts).values(draft).returning();
  return row;
}

/** One-way approval marker; undefined means another transaction already approved it. */
export async function markScheduleDraftApproved(
  client: DbClient,
  draftId: number,
  scheduleId: number,
): Promise<ScheduleDraft | undefined> {
  const [row] = await client
    .update(scheduleDrafts)
    .set({ approvedScheduleId: scheduleId, approvedAt: new Date() })
    .where(and(eq(scheduleDrafts.id, draftId), isNull(scheduleDrafts.approvedScheduleId)))
    .returning();
  return row;
}

export async function getScheduleById(client: DbClient, id: number): Promise<Schedule | undefined> {
  const [row] = await client.select().from(schedules).where(eq(schedules.id, id));
  return row;
}

export async function getScheduleTasks(client: DbClient, scheduleId: number): Promise<ScheduleTask[]> {
  return client
    .select()
    .from(scheduleTasks)
    .where(eq(scheduleTasks.scheduleId, scheduleId))
    .orderBy(asc(scheduleTasks.orderIndex), asc(scheduleTasks.id));
}

export async function createScheduleFromDraft(
  client: DbClient,
  args: { objectId: number; estimateId: number; title: string; calendarStart: string },
): Promise<Schedule> {
  const [row] = await client
    .insert(schedules)
    .values({
      objectId: args.objectId,
      estimateId: args.estimateId,
      title: args.title,
      calendarStart: args.calendarStart,
      sourceType: "estimate",
      workCollectionId: null,
    })
    .returning();
  return row;
}

export async function insertScheduleTasks(
  client: DbClient,
  tasks: InsertScheduleTask[],
): Promise<ScheduleTask[]> {
  if (tasks.length === 0) return [];
  return client.insert(scheduleTasks).values(tasks).returning();
}
