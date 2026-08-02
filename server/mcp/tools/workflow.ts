/**
 * @file: workflow.ts
 * @description: MCP tools для execution workflow (TASK-002): create/get workflow,
 *   set_workflow_input, get_missing_workflow_inputs.
 * @dependencies: @modelcontextprotocol/sdk, zod, server/services/execution-workflow/*
 * @created: 2026-08-02
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpAuthContext } from '../authContext';
import { toolSuccess, withToolLogging } from '../toolResult';
import { VALID_INPUT_SOURCES } from '../../services/execution-workflow/workflowInputs';
import {
  createExecutionWorkflow,
  getExecutionWorkflow,
  getMissingWorkflowInputs,
  setWorkflowInput,
} from '../../services/execution-workflow/workflowService';

const idempotencyKeySchema = z.string().min(1).max(200);
const inputSourceSchema = z.enum(VALID_INPUT_SOURCES as [string, ...string[]]);

export function registerWorkflowTools(server: McpServer, auth: McpAuthContext): void {
  server.registerTool(
    'create_execution_workflow',
    {
      description:
        'Creates a new execution workflow for a construction object owned by the current user. ' +
        'Idempotent: retrying with the same idempotencyKey returns the original workflow.',
      inputSchema: {
        objectId: z.number().int().positive(),
        idempotencyKey: idempotencyKeySchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withToolLogging('create_execution_workflow', auth.userId, async (args) =>
      toolSuccess(await createExecutionWorkflow(auth, args)),
    ),
  );

  server.registerTool(
    'get_execution_workflow',
    {
      description: 'Returns the current state (stage, version, inputs, missing inputs) of a workflow.',
      inputSchema: { workflowId: z.number().int().positive() },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    withToolLogging('get_execution_workflow', auth.userId, async (args) =>
      toolSuccess(await getExecutionWorkflow(auth, args.workflowId)),
    ),
  );

  server.registerTool(
    'get_missing_workflow_inputs',
    {
      description:
        'Temporary baseline contract: returns the schedule-planning inputs still needing ' +
        'confirmation. Will be superseded by the estimate-analysis-driven missing inputs engine.',
      inputSchema: { workflowId: z.number().int().positive() },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    withToolLogging('get_missing_workflow_inputs', auth.userId, async (args) =>
      toolSuccess(await getMissingWorkflowInputs(auth, args.workflowId)),
    ),
  );

  server.registerTool(
    'set_workflow_input',
    {
      description:
        'Stores or updates a single workflow input value. Requires expectedVersion for optimistic ' +
        'concurrency and idempotencyKey to make retries safe.',
      inputSchema: {
        workflowId: z.number().int().positive(),
        expectedVersion: z.number().int().nonnegative(),
        idempotencyKey: idempotencyKeySchema,
        key: z.string().min(1).max(100),
        value: z.unknown(),
        source: inputSourceSchema,
        confirmed: z.boolean(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withToolLogging('set_workflow_input', auth.userId, async (args) =>
      toolSuccess(
        await setWorkflowInput(auth, {
          ...args,
          source: args.source as (typeof VALID_INPUT_SOURCES)[number],
        }),
      ),
    ),
  );
}
