/**
 * @file: workflowService.ts
 * @description: Бизнес-логика execution workflow: создание, чтение, приём входных данных,
 *   ownership, optimistic concurrency и idempotency для write-инструментов MCP.
 *
 *   Каждая write-операция (createExecutionWorkflow, setWorkflowInput,
 *   transitionWorkflowStage) выполняется целиком в одной DB-транзакции:
 *   idempotency-claim → CAS по version → доменная мутация → event → idempotency-finalize.
 *   Если CAS не проходит или что-либо внутри бросает исключение, вся транзакция
 *   откатывается — прочие изменения (в т.ч. записанный input) не остаются в БД.
 *   Это устраняет гонки, описанные в code review TASK-002 (input сохраняется несмотря
 *   на WORKFLOW_VERSION_CONFLICT; idempotency допускает дубли; частичная запись событий).
 * @dependencies: server/db.ts, workflowRepository.ts, workflowStateMachine.ts, workflowInputs.ts
 * @created: 2026-08-02
 */

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { objects, type ExecutionWorkflow, type WorkflowInputSource, type WorkflowStage } from "@shared/schema";
import { db } from "../../db";
import type { McpAuthContext } from "../../mcp/authContext";
import { McpToolError, MCP_ERROR_CODES } from "../../mcp/errors";
import * as repo from "./workflowRepository";
import type { DbClient } from "./workflowRepository";
import { assertTransitionAllowed } from "./workflowStateMachine";
import { computeMissingInputs, VALID_INPUT_SOURCES, type MissingInput } from "./workflowInputs";

export interface WorkflowSnapshot {
  workflowId: number;
  objectId: number;
  stage: WorkflowStage;
  status: ExecutionWorkflow["status"];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowSnapshotWithInputs extends WorkflowSnapshot {
  inputs: Array<{ key: string; value: unknown; source: WorkflowInputSource; confirmed: boolean }>;
  missingInputs: MissingInput[];
}

function toSnapshot(row: ExecutionWorkflow): WorkflowSnapshot {
  return {
    workflowId: row.id,
    objectId: row.objectId,
    stage: row.stage,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function hashRequest(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Runs `execute` under the standard idempotency contract for write tools, atomically:
 *
 *  1. Inside one DB transaction, claim (userId, toolName, idempotencyKey) by inserting a
 *     row with resultJson = NULL. Postgres serializes concurrent claims of the same key
 *     via the unique index (the second INSERT blocks until the first transaction commits
 *     or rolls back), so at most one caller ever proceeds past this point for a given key.
 *  2. If the claim fails (row already existed), the slot was already used: validate the
 *     request hash matches (reject VALIDATION_ERROR otherwise) and return the stored result.
 *  3. If the claim succeeds, run `execute` and persist its result on the same row, all in
 *     the same transaction — so a failure anywhere (including a losing CAS) rolls back
 *     the claim too, leaving the idempotencyKey free for a legitimate retry.
 */
async function withIdempotency<T>(
  userId: number,
  toolName: string,
  idempotencyKey: string,
  requestPayload: unknown,
  execute: (tx: DbClient) => Promise<T>,
): Promise<T> {
  const requestHash = hashRequest(requestPayload);

  return db.transaction(async (tx) => {
    const claimed = await repo.claimIdempotencyRecord(tx, { userId, toolName, idempotencyKey, requestHash });

    if (!claimed) {
      const existing = await repo.findIdempotencyRecord(tx, userId, toolName, idempotencyKey);
      if (!existing) {
        // Should be unreachable: ON CONFLICT DO NOTHING only returns no row when a
        // conflicting row is visible, so a lookup right after must find it.
        throw new McpToolError(MCP_ERROR_CODES.INTERNAL_ERROR, "Idempotency record lookup race, please retry");
      }
      if (existing.requestHash !== requestHash) {
        throw new McpToolError(
          MCP_ERROR_CODES.VALIDATION_ERROR,
          "idempotencyKey was already used with different arguments",
        );
      }
      if (existing.resultJson === null) {
        // Unreachable under this transactional design: the claim row and its result are
        // always committed together (see finalizeIdempotencyRecord below). Kept as
        // defense in depth in case of future refactors.
        throw new McpToolError(
          MCP_ERROR_CODES.INTERNAL_ERROR,
          "A previous attempt with this idempotencyKey did not complete; retry with a new idempotencyKey",
        );
      }
      return existing.resultJson as T;
    }

    const result = await execute(tx);
    await repo.finalizeIdempotencyRecord(tx, claimed.id, result as unknown);
    return result;
  });
}

/** Loads a workflow and verifies ownership, hiding existence from non-owners (404, not 403). */
async function loadOwnedWorkflow(client: DbClient, auth: McpAuthContext, workflowId: number): Promise<ExecutionWorkflow> {
  const row = await repo.getWorkflowById(client, workflowId);
  if (!row || row.userId !== auth.userId) {
    throw new McpToolError(MCP_ERROR_CODES.NOT_FOUND, "Workflow not found");
  }
  return row;
}

export async function createExecutionWorkflow(
  auth: McpAuthContext,
  input: { objectId: number; idempotencyKey: string },
): Promise<WorkflowSnapshot> {
  return withIdempotency(
    auth.userId,
    "create_execution_workflow",
    input.idempotencyKey,
    { objectId: input.objectId },
    async (tx) => {
      const [object] = await tx.select().from(objects).where(eq(objects.id, input.objectId));
      if (!object || object.userId !== auth.userId) {
        throw new McpToolError(MCP_ERROR_CODES.NOT_FOUND, "Object not found");
      }

      const workflow = await repo.insertWorkflow(tx, auth.userId, input.objectId);
      await repo.insertWorkflowEvent(tx, {
        workflowId: workflow.id,
        eventType: "workflow_created",
        actorType: "agent",
        actorId: String(auth.userId),
        payloadJson: { objectId: input.objectId },
      });

      return toSnapshot(workflow);
    },
  );
}

export async function getExecutionWorkflow(
  auth: McpAuthContext,
  workflowId: number,
): Promise<WorkflowSnapshotWithInputs> {
  const workflow = await loadOwnedWorkflow(db, auth, workflowId);
  const inputs = await repo.getWorkflowInputs(db, workflow.id);
  return {
    ...toSnapshot(workflow),
    inputs: inputs.map((i) => ({ key: i.key, value: i.valueJson, source: i.source, confirmed: i.confirmed })),
    missingInputs: computeMissingInputs(inputs),
  };
}

export async function getMissingWorkflowInputs(
  auth: McpAuthContext,
  workflowId: number,
): Promise<{ workflowId: number; stage: WorkflowStage; missingInputs: MissingInput[] }> {
  const workflow = await loadOwnedWorkflow(db, auth, workflowId);
  const inputs = await repo.getWorkflowInputs(db, workflow.id);
  return {
    workflowId: workflow.id,
    stage: workflow.stage,
    missingInputs: computeMissingInputs(inputs),
  };
}

export interface SetWorkflowInputArgs {
  workflowId: number;
  expectedVersion: number;
  idempotencyKey: string;
  key: string;
  value: unknown;
  source: WorkflowInputSource;
  confirmed: boolean;
}

export async function setWorkflowInput(
  auth: McpAuthContext,
  args: SetWorkflowInputArgs,
): Promise<WorkflowSnapshotWithInputs> {
  if (!VALID_INPUT_SOURCES.includes(args.source)) {
    throw new McpToolError(MCP_ERROR_CODES.VALIDATION_ERROR, `Invalid input source "${args.source}"`);
  }

  return withIdempotency(
    auth.userId,
    "set_workflow_input",
    args.idempotencyKey,
    {
      workflowId: args.workflowId,
      expectedVersion: args.expectedVersion,
      key: args.key,
      value: args.value,
      source: args.source,
      confirmed: args.confirmed,
    },
    async (tx) => {
      const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);

      // CAS FIRST: this is the concurrency gate. Nothing else is written before this
      // succeeds, so a losing request (stale expectedVersion) never persists its input —
      // the whole transaction rolls back when we throw below.
      const updated = await repo.touchWorkflowIfVersionMatches(tx, workflow.id, args.expectedVersion);
      if (!updated) {
        throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
          recoverable: true,
        });
      }

      await repo.upsertWorkflowInput(tx, workflow.id, args.key, args.value, args.source, args.confirmed);
      await repo.insertWorkflowEvent(tx, {
        workflowId: workflow.id,
        eventType: "input_set",
        actorType: "agent",
        actorId: String(auth.userId),
        payloadJson: { key: args.key, source: args.source, confirmed: args.confirmed },
      });

      const inputsAfter = await repo.getWorkflowInputs(tx, workflow.id);
      const stillMissing = computeMissingInputs(inputsAfter);

      return {
        ...toSnapshot(updated),
        inputs: inputsAfter.map((i) => ({
          key: i.key,
          value: i.valueJson,
          source: i.source,
          confirmed: i.confirmed,
        })),
        missingInputs: stillMissing,
      };
    },
  );
}

/**
 * Generic stage transition primitive, not exposed as its own MCP tool in TASK-002.
 * Orchestration tools introduced by later tasks (e.g. import_estimate_from_upload,
 * calculate_schedule_draft, approve_schedule) call this once their own scope's work is
 * durably saved, so the state machine and audit trail stay centralized here rather than
 * being re-implemented per tool.
 *
 * A transition to the workflow's current stage is a genuine no-op: version is not
 * bumped and no event is written, because "version increases on change" and staying on
 * the same stage is not a change.
 */
export async function transitionWorkflowStage(
  auth: McpAuthContext,
  args: { workflowId: number; expectedVersion: number; nextStage: WorkflowStage },
): Promise<WorkflowSnapshot> {
  return db.transaction(async (tx) => {
    const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);

    if (workflow.version !== args.expectedVersion) {
      throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
        recoverable: true,
      });
    }

    const fromStage = workflow.stage;
    assertTransitionAllowed(fromStage, args.nextStage);

    if (fromStage === args.nextStage) {
      return toSnapshot(workflow);
    }

    const updated = await repo.updateWorkflowStageIfVersionMatches(tx, workflow.id, args.expectedVersion, args.nextStage);
    if (!updated) {
      throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
        recoverable: true,
      });
    }

    await repo.insertWorkflowEvent(tx, {
      workflowId: workflow.id,
      eventType: "stage_transition",
      actorType: "system",
      actorId: null,
      payloadJson: { from: fromStage, to: args.nextStage },
    });

    return toSnapshot(updated);
  });
}
