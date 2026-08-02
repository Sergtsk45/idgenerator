/**
 * @file: workflowRepository.ts
 * @description: Data access для execution_workflows/_inputs/_events и tool_idempotency_records.
 *   Отдельный модуль (а не server/storage.ts), т.к. это самостоятельный bounded context
 *   по архитектуре MCP-MVP (01-architecture-and-boundaries.md §3).
 *
 *   Каждая функция принимает `client` явным первым аргументом (db или db.transaction(tx))
 *   вместо неявного захвата модульного `db`. Это намеренно: сервисный слой обязан явно
 *   решить, участвует ли операция в транзакции, чтобы не повторить баг "CAS и запись
 *   input выполняются отдельными запросами" (см. code review TASK-002).
 * @dependencies: drizzle-orm, server/db.ts, @shared/schema
 * @created: 2026-08-02
 */

import { and, eq } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type * as schema from "@shared/schema";
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
  type WorkflowStatus,
  type WorkflowInputSource,
} from "@shared/schema";

/**
 * Either the module-level `db` or a `tx` handed out by `db.transaction(...)`.
 * Both `NodePgDatabase` and `PgTransaction` extend `PgDatabase`, which exposes the
 * select/insert/update surface these repository functions need.
 */
export type DbClient = PgDatabase<NodePgQueryResultHKT, typeof schema>;

export async function insertWorkflow(client: DbClient, userId: number, objectId: number): Promise<ExecutionWorkflow> {
  const [row] = await client
    .insert(executionWorkflows)
    .values({ userId, objectId, stage: "created", status: "active", version: 1 })
    .returning();
  return row;
}

export async function getWorkflowById(client: DbClient, id: number): Promise<ExecutionWorkflow | undefined> {
  const [row] = await client.select().from(executionWorkflows).where(eq(executionWorkflows.id, id));
  return row;
}

/**
 * Optimistic-concurrency stage update: succeeds only if the row still has
 * `expectedVersion`. Returns undefined (no throw) when the CAS fails so callers can
 * decide how to report the conflict. Keeps `status` in sync with terminal stages so
 * `{stage: "completed", status: "active"}` can never be persisted.
 */
export async function updateWorkflowStageIfVersionMatches(
  client: DbClient,
  id: number,
  expectedVersion: number,
  nextStage: WorkflowStage,
): Promise<ExecutionWorkflow | undefined> {
  const nextStatus: WorkflowStatus =
    nextStage === "completed" ? "completed" : nextStage === "failed" ? "failed" : "active";

  const [row] = await client
    .update(executionWorkflows)
    .set({ stage: nextStage, status: nextStatus, version: expectedVersion + 1, updatedAt: new Date() })
    .where(and(eq(executionWorkflows.id, id), eq(executionWorkflows.version, expectedVersion)))
    .returning();
  return row;
}

/**
 * Bumps the workflow version without changing stage (used by set_workflow_input).
 * Same optimistic-concurrency contract as updateWorkflowStageIfVersionMatches.
 * Callers MUST perform this (or updateWorkflowStageIfVersionMatches) as the FIRST write
 * of a mutating operation and inside the same transaction as any subsequent writes: it
 * is the concurrency gate, and any write issued before a successful CAS can survive a
 * losing request's rollback-free path (see code review TASK-002, issue #1).
 */
export async function touchWorkflowIfVersionMatches(
  client: DbClient,
  id: number,
  expectedVersion: number,
): Promise<ExecutionWorkflow | undefined> {
  const [row] = await client
    .update(executionWorkflows)
    .set({ version: expectedVersion + 1, updatedAt: new Date() })
    .where(and(eq(executionWorkflows.id, id), eq(executionWorkflows.version, expectedVersion)))
    .returning();
  return row;
}

export async function getWorkflowInputs(client: DbClient, workflowId: number): Promise<ExecutionWorkflowInput[]> {
  return client.select().from(executionWorkflowInputs).where(eq(executionWorkflowInputs.workflowId, workflowId));
}

export async function upsertWorkflowInput(
  client: DbClient,
  workflowId: number,
  key: string,
  valueJson: unknown,
  source: WorkflowInputSource,
  confirmed: boolean,
): Promise<ExecutionWorkflowInput> {
  const [row] = await client
    .insert(executionWorkflowInputs)
    .values({ workflowId, key, valueJson, source, confirmed })
    .onConflictDoUpdate({
      target: [executionWorkflowInputs.workflowId, executionWorkflowInputs.key],
      set: { valueJson, source, confirmed, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function insertWorkflowEvent(
  client: DbClient,
  event: {
    workflowId: number;
    eventType: string;
    actorType: "user" | "agent" | "system";
    actorId: string | null;
    payloadJson: Record<string, unknown>;
  },
): Promise<ExecutionWorkflowEvent> {
  const [row] = await client.insert(executionWorkflowEvents).values(event).returning();
  return row;
}

export async function getWorkflowEvents(client: DbClient, workflowId: number): Promise<ExecutionWorkflowEvent[]> {
  return client
    .select()
    .from(executionWorkflowEvents)
    .where(eq(executionWorkflowEvents.workflowId, workflowId))
    .orderBy(executionWorkflowEvents.createdAt);
}

export async function findIdempotencyRecord(
  client: DbClient,
  userId: number,
  toolName: string,
  idempotencyKey: string,
): Promise<ToolIdempotencyRecord | undefined> {
  const [row] = await client
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
 * Atomically claims the (userId, toolName, idempotencyKey) slot by inserting a row with
 * `resultJson = NULL`. Must be called inside the transaction that will also perform the
 * mutation and later finalizeIdempotencyRecord — this is the concurrency guard.
 *
 * Postgres semantics we rely on: if a concurrent, not-yet-committed transaction already
 * inserted the same unique key, this INSERT ... ON CONFLICT DO NOTHING blocks until that
 * transaction finishes, then re-checks the conflict. So two concurrent callers with the
 * same key are naturally serialized by the unique index — only one of them gets a row
 * back from `claimIdempotencyRecord`; the other must look up the (by then committed,
 * or absent if the winner rolled back) record via findIdempotencyRecord.
 */
export async function claimIdempotencyRecord(
  client: DbClient,
  record: { userId: number; toolName: string; idempotencyKey: string; requestHash: string },
): Promise<ToolIdempotencyRecord | undefined> {
  const [row] = await client
    .insert(toolIdempotencyRecords)
    .values({ ...record, resultJson: null })
    .onConflictDoNothing()
    .returning();
  return row;
}

export async function finalizeIdempotencyRecord(
  client: DbClient,
  id: number,
  resultJson: unknown,
): Promise<void> {
  await client.update(toolIdempotencyRecords).set({ resultJson }).where(eq(toolIdempotencyRecords.id, id));
}
