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
import { loadCurrentEstimateAnalysis } from "../estimate-analysis/currentEstimateAnalysis";
import {
  evaluateMissingWorkflowInputs,
  validateAndNormalizeWorkflowInput,
  VALID_INPUT_SOURCES,
  type MissingInput,
  type MissingInputsContext,
  type WorkflowBlockingIssue,
  type WorkflowInputKey,
} from "./workflowInputs";

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
  questions: MissingInput[];
  blockingIssues: WorkflowBlockingIssue[];
  ready: boolean;
  scheduleInputHash: string;
}

async function getMissingInputsContext(client: DbClient, workflow: ExecutionWorkflow): Promise<MissingInputsContext> {
  if (!workflow.estimateId || ["created", "estimate_upload_pending", "estimate_imported"].includes(workflow.stage)) {
    return {};
  }
  const analysis = await loadCurrentEstimateAnalysis(client, workflow);
  if (!analysis) {
    throw new McpToolError(MCP_ERROR_CODES.NOT_FOUND, "Current estimate analysis not found; call analyze_estimate", {
      recoverable: true,
    });
  }
  return {
    analysisAvailable: true,
    analysisInputHash: analysis.inputHash,
    laborHoursAvailable: analysis.summary.laborHoursAvailable,
  };
}

function inputsResult(
  workflow: ExecutionWorkflow,
  inputs: Awaited<ReturnType<typeof repo.getWorkflowInputs>>,
  context: MissingInputsContext,
): WorkflowSnapshotWithInputs {
  const evaluation = evaluateMissingWorkflowInputs(inputs, context);
  return {
    ...toSnapshot(workflow),
    inputs: inputs.map((input) => ({
      key: input.key,
      value: input.valueJson,
      source: input.source,
      confirmed: input.confirmed,
    })),
    missingInputs: evaluation.questions,
    questions: evaluation.questions,
    blockingIssues: evaluation.blockingIssues,
    ready: evaluation.ready,
    scheduleInputHash: evaluation.scheduleInputHash,
  };
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
export async function withIdempotency<T>(
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
export async function loadOwnedWorkflow(client: DbClient, auth: McpAuthContext, workflowId: number): Promise<ExecutionWorkflow> {
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
  return inputsResult(workflow, inputs, await getMissingInputsContext(db, workflow));
}

export async function getMissingWorkflowInputs(
  auth: McpAuthContext,
  workflowId: number,
): Promise<WorkflowSnapshotWithInputs> {
  const workflow = await loadOwnedWorkflow(db, auth, workflowId);
  const inputs = await repo.getWorkflowInputs(db, workflow.id);
  return inputsResult(workflow, inputs, await getMissingInputsContext(db, workflow));
}

export interface SetWorkflowInputArgs {
  workflowId: number;
  expectedVersion: number;
  idempotencyKey: string;
  key: WorkflowInputKey | string;
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
  const normalized = validateAndNormalizeWorkflowInput(args.key, args.value);

  return withIdempotency(
    auth.userId,
    "set_workflow_input",
    args.idempotencyKey,
    {
      workflowId: args.workflowId,
      expectedVersion: args.expectedVersion,
      key: normalized.key,
      value: normalized.value,
      source: args.source,
      confirmed: args.confirmed,
    },
    async (tx) => {
      const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);
      if (workflow.version !== args.expectedVersion) {
        throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
          recoverable: true,
        });
      }
      const context = await getMissingInputsContext(tx, workflow);
      const inputsBefore = await repo.getWorkflowInputs(tx, workflow.id);
      const existing = inputsBefore.find((input) => input.key === normalized.key);
      const unchanged = existing !== undefined
        && JSON.stringify(existing.valueJson) === JSON.stringify(normalized.value)
        && existing.source === args.source
        && existing.confirmed === args.confirmed;

      if (unchanged && workflow.stage !== "estimate_analysis_ready") {
        return inputsResult(workflow, inputsBefore, context);
      }

      // CAS FIRST: this is the concurrency gate. Nothing else is written before this
      // succeeds, so a losing request (stale expectedVersion) never persists its input —
      // the whole transaction rolls back when we throw below.
      const updated = workflow.stage === "estimate_analysis_ready"
        ? await repo.updateWorkflowStageIfVersionMatches(
            tx,
            workflow.id,
            args.expectedVersion,
            "awaiting_schedule_inputs",
          )
        : await repo.touchWorkflowIfVersionMatches(tx, workflow.id, args.expectedVersion);
      if (!updated) {
        throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
          recoverable: true,
        });
      }

      await repo.upsertWorkflowInput(
        tx,
        workflow.id,
        normalized.key,
        normalized.value,
        args.source,
        args.confirmed,
      );
      if (workflow.stage === "estimate_analysis_ready") {
        await repo.insertWorkflowEvent(tx, {
          workflowId: workflow.id,
          eventType: "stage_transition",
          actorType: "system",
          actorId: null,
          payloadJson: { from: workflow.stage, to: "awaiting_schedule_inputs" },
        });
      }
      await repo.insertWorkflowEvent(tx, {
        workflowId: workflow.id,
        eventType: "input_set",
        actorType: "agent",
        actorId: String(auth.userId),
        payloadJson: { key: normalized.key, source: args.source, confirmed: args.confirmed },
      });
      if (existing && !unchanged) {
        await repo.insertWorkflowEvent(tx, {
          workflowId: workflow.id,
          eventType: "calculated_artifacts_invalidated",
          actorType: "system",
          actorId: null,
          payloadJson: { key: normalized.key, artifacts: ["schedule_draft"] },
        });
      }

      const inputsAfter = await repo.getWorkflowInputs(tx, workflow.id);
      return inputsResult(updated, inputsAfter, context);
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
