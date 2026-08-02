/**
 * @file: workflowService.ts
 * @description: Бизнес-логика execution workflow: создание, чтение, приём входных данных,
 *   ownership, optimistic concurrency и idempotency для write-инструментов MCP.
 * @dependencies: server/storage.ts (object ownership), workflowRepository.ts, workflowStateMachine.ts, workflowInputs.ts
 * @created: 2026-08-02
 */

import { createHash } from "node:crypto";
import type { ExecutionWorkflow, ExecutionWorkflowInput, WorkflowInputSource } from "@shared/schema";
import { storage } from "../../storage";
import type { McpAuthContext } from "../../mcp/authContext";
import { McpToolError, MCP_ERROR_CODES } from "../../mcp/errors";
import * as repo from "./workflowRepository";
import { assertTransitionAllowed } from "./workflowStateMachine";
import { computeMissingInputs, VALID_INPUT_SOURCES, type MissingInput } from "./workflowInputs";

export interface WorkflowSnapshot {
  workflowId: number;
  objectId: number;
  stage: ExecutionWorkflow["stage"];
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
    stage: row.stage as ExecutionWorkflow["stage"],
    status: row.status as ExecutionWorkflow["status"],
    version: row.version,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

function hashRequest(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Runs `execute` under the standard idempotency contract for write tools:
 *  - a prior call with the same (userId, toolName, idempotencyKey) returns the stored result;
 *  - reusing the key with different arguments is rejected (client bug, not a valid retry);
 *  - a successful new call has its result persisted for future retries.
 */
async function withIdempotency<T>(
  userId: number,
  toolName: string,
  idempotencyKey: string,
  requestPayload: unknown,
  execute: () => Promise<T>,
): Promise<T> {
  const requestHash = hashRequest(requestPayload);
  const existing = await repo.findIdempotencyRecord(userId, toolName, idempotencyKey);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new McpToolError(
        MCP_ERROR_CODES.VALIDATION_ERROR,
        "idempotencyKey was already used with different arguments",
      );
    }
    return existing.resultJson as T;
  }

  const result = await execute();
  await repo.saveIdempotencyRecord({ userId, toolName, idempotencyKey, requestHash, resultJson: result as unknown });
  return result;
}

/** Loads a workflow and verifies ownership, hiding existence from non-owners (404, not 403). */
async function loadOwnedWorkflow(auth: McpAuthContext, workflowId: number): Promise<ExecutionWorkflow> {
  const row = await repo.getWorkflowById(workflowId);
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
    async () => {
      const object = await storage.getObject(input.objectId);
      if (!object || object.userId !== auth.userId) {
        throw new McpToolError(MCP_ERROR_CODES.NOT_FOUND, "Object not found");
      }

      const workflow = await repo.insertWorkflow(auth.userId, input.objectId);
      await repo.insertWorkflowEvent({
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
  const workflow = await loadOwnedWorkflow(auth, workflowId);
  const inputs = await repo.getWorkflowInputs(workflow.id);
  return {
    ...toSnapshot(workflow),
    inputs: inputs.map((i) => ({ key: i.key, value: i.valueJson, source: i.source as WorkflowInputSource, confirmed: i.confirmed })),
    missingInputs: computeMissingInputs(inputs),
  };
}

export async function getMissingWorkflowInputs(
  auth: McpAuthContext,
  workflowId: number,
): Promise<{ workflowId: number; stage: ExecutionWorkflow["stage"]; missingInputs: MissingInput[] }> {
  const workflow = await loadOwnedWorkflow(auth, workflowId);
  const inputs = await repo.getWorkflowInputs(workflow.id);
  return {
    workflowId: workflow.id,
    stage: workflow.stage as ExecutionWorkflow["stage"],
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
    { workflowId: args.workflowId, key: args.key, value: args.value, source: args.source, confirmed: args.confirmed },
    async () => {
      const workflow = await loadOwnedWorkflow(auth, args.workflowId);

      if (workflow.version !== args.expectedVersion) {
        throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
          recoverable: true,
        });
      }

      await repo.upsertWorkflowInput(workflow.id, args.key, args.value, args.source, args.confirmed);

      const updated = await repo.touchWorkflowIfVersionMatches(workflow.id, args.expectedVersion);
      if (!updated) {
        throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
          recoverable: true,
        });
      }

      await repo.insertWorkflowEvent({
        workflowId: workflow.id,
        eventType: "input_set",
        actorType: "agent",
        actorId: String(auth.userId),
        payloadJson: { key: args.key, source: args.source, confirmed: args.confirmed },
      });

      const inputsAfter = await repo.getWorkflowInputs(workflow.id);
      const stillMissing = computeMissingInputs(inputsAfter);

      return {
        ...toSnapshot(updated),
        inputs: inputsAfter.map((i) => ({
          key: i.key,
          value: i.valueJson,
          source: i.source as WorkflowInputSource,
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
 */
export async function transitionWorkflowStage(
  auth: McpAuthContext,
  args: { workflowId: number; expectedVersion: number; nextStage: ExecutionWorkflow["stage"] },
): Promise<WorkflowSnapshot> {
  const workflow = await loadOwnedWorkflow(auth, args.workflowId);

  if (workflow.version !== args.expectedVersion) {
    throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
      recoverable: true,
    });
  }

  const fromStage = workflow.stage as ExecutionWorkflow["stage"];
  assertTransitionAllowed(fromStage, args.nextStage);

  const updated = await repo.updateWorkflowStageIfVersionMatches(workflow.id, args.expectedVersion, args.nextStage);
  if (!updated) {
    throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
      recoverable: true,
    });
  }

  await repo.insertWorkflowEvent({
    workflowId: workflow.id,
    eventType: "stage_transition",
    actorType: "system",
    actorId: null,
    payloadJson: { from: fromStage, to: args.nextStage },
  });

  return toSnapshot(updated);
}
