/**
 * @file: workflowRepository.ts
 * @description: Data access для execution_workflows/_inputs/_events и tool_idempotency_records.
 *   Отдельный модуль (а не server/storage.ts), т.к. это самостоятельный bounded context
 *   по архитектуре MCP-MVP (01-architecture-and-boundaries.md §3).
 * @dependencies: drizzle-orm, server/db.ts, @shared/schema
 * @created: 2026-08-02
 */

import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  executionWorkflows,
  executionWorkflowInputs,
  executionWorkflowEvents,
  toolIdempotencyRecords,
  type ExecutionWorkflow,
  type ExecutionWorkflowInput,
  type ExecutionWorkflowEvent,
  type ToolIdempotencyRecord,
  type WorkflowStage,
  type WorkflowInputSource,
} from "@shared/schema";

export async function insertWorkflow(userId: number, objectId: number): Promise<ExecutionWorkflow> {
  const [row] = await db
    .insert(executionWorkflows)
    .values({ userId, objectId, stage: "created", status: "active", version: 1 })
    .returning();
  return row;
}

export async function getWorkflowById(id: number): Promise<ExecutionWorkflow | undefined> {
  const [row] = await db.select().from(executionWorkflows).where(eq(executionWorkflows.id, id));
  return row;
}

/**
 * Optimistic-concurrency stage update: succeeds only if the row still has
 * `expectedVersion`. Returns undefined (no throw) when the CAS fails so callers can
 * decide how to report the conflict.
 */
export async function updateWorkflowStageIfVersionMatches(
  id: number,
  expectedVersion: number,
  nextStage: WorkflowStage,
): Promise<ExecutionWorkflow | undefined> {
  const [row] = await db
    .update(executionWorkflows)
    .set({ stage: nextStage, version: expectedVersion + 1, updatedAt: new Date() })
    .where(and(eq(executionWorkflows.id, id), eq(executionWorkflows.version, expectedVersion)))
    .returning();
  return row;
}

/**
 * Bumps the workflow version without changing stage (used by set_workflow_input).
 * Same optimistic-concurrency contract as updateWorkflowStageIfVersionMatches.
 */
export async function touchWorkflowIfVersionMatches(
  id: number,
  expectedVersion: number,
): Promise<ExecutionWorkflow | undefined> {
  const [row] = await db
    .update(executionWorkflows)
    .set({ version: expectedVersion + 1, updatedAt: new Date() })
    .where(and(eq(executionWorkflows.id, id), eq(executionWorkflows.version, expectedVersion)))
    .returning();
  return row;
}

export async function getWorkflowInputs(workflowId: number): Promise<ExecutionWorkflowInput[]> {
  return db.select().from(executionWorkflowInputs).where(eq(executionWorkflowInputs.workflowId, workflowId));
}

export async function upsertWorkflowInput(
  workflowId: number,
  key: string,
  valueJson: unknown,
  source: WorkflowInputSource,
  confirmed: boolean,
): Promise<ExecutionWorkflowInput> {
  const [row] = await db
    .insert(executionWorkflowInputs)
    .values({ workflowId, key, valueJson, source, confirmed })
    .onConflictDoUpdate({
      target: [executionWorkflowInputs.workflowId, executionWorkflowInputs.key],
      set: { valueJson, source, confirmed, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function insertWorkflowEvent(event: {
  workflowId: number;
  eventType: string;
  actorType: "user" | "agent" | "system";
  actorId: string | null;
  payloadJson: Record<string, unknown>;
}): Promise<ExecutionWorkflowEvent> {
  const [row] = await db.insert(executionWorkflowEvents).values(event).returning();
  return row;
}

export async function getWorkflowEvents(workflowId: number): Promise<ExecutionWorkflowEvent[]> {
  return db
    .select()
    .from(executionWorkflowEvents)
    .where(eq(executionWorkflowEvents.workflowId, workflowId))
    .orderBy(executionWorkflowEvents.createdAt);
}

export async function findIdempotencyRecord(
  userId: number,
  toolName: string,
  idempotencyKey: string,
): Promise<ToolIdempotencyRecord | undefined> {
  const [row] = await db
    .select()
    .from(toolIdempotencyRecords)
    .where(
      and(
        eq(toolIdempotencyRecords.userId, userId),
        eq(toolIdempotencyRecords.toolName, toolName),
        eq(toolIdempotencyRecords.idempotencyKey, idempotencyKey),
      ),
    );
  return row;
}

/**
 * Persists the idempotency record. Relies on the DB unique index
 * (user_id, tool_name, idempotency_key) to guard against a race where two concurrent
 * requests with the same key both pass findIdempotencyRecord before either writes.
 */
export async function saveIdempotencyRecord(record: {
  userId: number;
  toolName: string;
  idempotencyKey: string;
  requestHash: string;
  resultJson: unknown;
}): Promise<void> {
  await db.insert(toolIdempotencyRecords).values(record).onConflictDoNothing();
}
