import { desc, eq } from "drizzle-orm";
import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { db } from "../db";
import { executionWorkflows, type ExecutionWorkflow } from "@shared/schema";
import { requireAuth, type McpAuthResolution } from "./authContext";
import { MCP_ERROR_CODES, McpToolError } from "./errors";
import { getExecutionWorkflow, loadOwnedWorkflow } from "../services/execution-workflow/workflowService";
import { getLatestScheduleDraft } from "../services/schedule-planning/scheduleDraftRepository";
import { getMaterialRegister, getMissingQualityDocuments } from "../services/materialRegisterService";
import { checkActsReadiness } from "../services/actsReadinessService";

const RESOURCE_MIME_TYPE = "application/json";
const RESOURCE_SCHEME = "idgenerator";
export const EXECUTION_DOCUMENTATION_WORKFLOW_PROMPT_VERSION = 1;

const workflowIdSchema = z.coerce.number().int().positive();

type WorkflowResourceKind = "status" | "schedule-draft" | "material-readiness" | "acts-readiness";

interface WorkflowResourceDefinition {
  kind: WorkflowResourceKind;
  title: string;
  description: string;
  template: ResourceTemplate;
}

interface WorkflowStatusSnapshot {
  workflowId: number;
  objectId: number;
  stage: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  inputs?: unknown[];
  missingInputs?: unknown[];
  questions?: unknown[];
  blockingIssues?: unknown[];
  ready?: boolean;
  scheduleInputHash?: string;
  notice?: string;
}

function resourceUri(workflowId: number, kind: WorkflowResourceKind): string {
  return `${RESOURCE_SCHEME}://workflow/${workflowId}/${kind}`;
}

function workflowResourceDescription(workflow: Pick<ExecutionWorkflow, "id" | "stage" | "status" | "version">, suffix: string): string {
  return `${suffix} for workflow #${workflow.id} (stage ${workflow.stage}, status ${workflow.status}, version ${workflow.version}).`;
}

function resourceContent(kind: WorkflowResourceKind, workflowId: number, content: unknown): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
  return {
    contents: [
      {
        uri: resourceUri(workflowId, kind),
        mimeType: RESOURCE_MIME_TYPE,
        text: `${JSON.stringify({ kind, version: EXECUTION_DOCUMENTATION_WORKFLOW_PROMPT_VERSION, workflowId, content }, null, 2)}\n`,
      },
    ],
  };
}

async function listOwnedWorkflows(authResolution: McpAuthResolution) {
  const auth = requireAuth(authResolution);
  return db
    .select({
      id: executionWorkflows.id,
      objectId: executionWorkflows.objectId,
      stage: executionWorkflows.stage,
      status: executionWorkflows.status,
      version: executionWorkflows.version,
      createdAt: executionWorkflows.createdAt,
      updatedAt: executionWorkflows.updatedAt,
    })
    .from(executionWorkflows)
    .where(eq(executionWorkflows.userId, auth.userId))
    .orderBy(desc(executionWorkflows.updatedAt), desc(executionWorkflows.id));
}

async function loadWorkflowStatus(authResolution: McpAuthResolution, workflowId: number): Promise<WorkflowStatusSnapshot> {
  const auth = requireAuth(authResolution);
  const workflow = await loadOwnedWorkflow(db, auth, workflowId);

  try {
    const snapshot = await getExecutionWorkflow(auth, workflowId);
    return {
      workflowId: snapshot.workflowId,
      objectId: snapshot.objectId,
      stage: snapshot.stage,
      status: snapshot.status,
      version: snapshot.version,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
      inputs: snapshot.inputs,
      missingInputs: snapshot.missingInputs,
      questions: snapshot.questions,
      blockingIssues: snapshot.blockingIssues,
      ready: snapshot.ready,
      scheduleInputHash: snapshot.scheduleInputHash,
    };
  } catch (error) {
    if (!(error instanceof McpToolError) || error.code !== MCP_ERROR_CODES.NOT_FOUND) {
      throw error;
    }
    return {
      workflowId: workflow.id,
      objectId: workflow.objectId,
      stage: workflow.stage,
      status: workflow.status,
      version: workflow.version,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
      ready: false,
      notice: "Current estimate analysis is not available yet",
    };
  }
}

async function loadScheduleDraftResource(authResolution: McpAuthResolution, workflowId: number) {
  const status = await loadWorkflowStatus(authResolution, workflowId);
  const draft = await getLatestScheduleDraft(db, workflowId);
  return {
    workflow: status,
    draft: draft
      ? {
          id: draft.id,
          version: draft.version,
          estimateId: draft.estimateId,
          plannerVersion: draft.plannerVersion,
          schemaVersion: draft.schemaVersion,
          inputHash: draft.inputHash,
          fresh: Boolean(status.scheduleInputHash && draft.inputHash === status.scheduleInputHash),
          approvedScheduleId: draft.approvedScheduleId,
          approvedAt: draft.approvedAt?.toISOString() ?? null,
          createdAt: draft.createdAt.toISOString(),
          draft: draft.draftJson,
        }
      : null,
    ready: Boolean(draft) && Boolean(status.scheduleInputHash) && draft?.inputHash === status.scheduleInputHash,
  };
}

async function loadMaterialReadinessResource(authResolution: McpAuthResolution, workflowId: number) {
  const status = await loadWorkflowStatus(authResolution, workflowId);
  const auth = requireAuth(authResolution);
  try {
    const [materialRegister, missingQualityDocuments] = await Promise.all([
      getMaterialRegister(auth, workflowId),
      getMissingQualityDocuments(auth, workflowId),
    ]);
    return {
      workflow: status,
      materialRegister,
      missingQualityDocuments,
      ready: materialRegister.ready && missingQualityDocuments.ready,
    };
  } catch (error) {
    if (!(error instanceof McpToolError)) throw error;
    return {
      workflow: status,
      ready: false,
      error: { code: error.code, message: error.message },
    };
  }
}

async function loadActsReadinessResource(authResolution: McpAuthResolution, workflowId: number) {
  const status = await loadWorkflowStatus(authResolution, workflowId);
  const auth = requireAuth(authResolution);
  try {
    const readiness = await checkActsReadiness(auth, workflowId);
    return {
      workflow: status,
      readiness,
      ready: readiness.ready,
    };
  } catch (error) {
    if (!(error instanceof McpToolError)) throw error;
    return {
      workflow: status,
      ready: false,
      error: { code: error.code, message: error.message },
    };
  }
}

function registerWorkflowResourceTemplates(server: McpServer, authResolution: McpAuthResolution): void {
  const definitions: WorkflowResourceDefinition[] = [
    {
      kind: "status",
      title: "Workflow status",
      description: "Returns the current workflow snapshot, inputs and missing-input state without mutating anything.",
      template: new ResourceTemplate(`${RESOURCE_SCHEME}://workflow/{workflowId}/status`, {
        list: async () => {
          const workflows = await listOwnedWorkflows(authResolution);
          return {
            resources: workflows.map((workflow) => ({
              uri: resourceUri(workflow.id, "status"),
              name: `workflow-status-${workflow.id}`,
              title: "Workflow status",
              description: workflowResourceDescription(workflow, "Current workflow snapshot"),
              mimeType: RESOURCE_MIME_TYPE,
            })),
          };
        },
      }),
    },
    {
      kind: "schedule-draft",
      title: "Schedule draft",
      description: "Returns the latest schedule draft and whether it is fresh against the current workflow inputs.",
      template: new ResourceTemplate(`${RESOURCE_SCHEME}://workflow/{workflowId}/schedule-draft`, {
        list: async () => {
          const workflows = await listOwnedWorkflows(authResolution);
          return {
            resources: workflows.map((workflow) => ({
              uri: resourceUri(workflow.id, "schedule-draft"),
              name: `schedule-draft-${workflow.id}`,
              title: "Schedule draft",
              description: workflowResourceDescription(workflow, "Current schedule draft state"),
              mimeType: RESOURCE_MIME_TYPE,
            })),
          };
        },
      }),
    },
    {
      kind: "material-readiness",
      title: "Material readiness",
      description: "Returns the current material register and missing quality-document state without changing the workflow.",
      template: new ResourceTemplate(`${RESOURCE_SCHEME}://workflow/{workflowId}/material-readiness`, {
        list: async () => {
          const workflows = await listOwnedWorkflows(authResolution);
          return {
            resources: workflows.map((workflow) => ({
              uri: resourceUri(workflow.id, "material-readiness"),
              name: `material-readiness-${workflow.id}`,
              title: "Material readiness",
              description: workflowResourceDescription(workflow, "Current material readiness"),
              mimeType: RESOURCE_MIME_TYPE,
            })),
          };
        },
      }),
    },
    {
      kind: "acts-readiness",
      title: "Acts readiness",
      description: "Returns the current acts readiness state and blockers without generating or exporting artifacts.",
      template: new ResourceTemplate(`${RESOURCE_SCHEME}://workflow/{workflowId}/acts-readiness`, {
        list: async () => {
          const workflows = await listOwnedWorkflows(authResolution);
          return {
            resources: workflows.map((workflow) => ({
              uri: resourceUri(workflow.id, "acts-readiness"),
              name: `acts-readiness-${workflow.id}`,
              title: "Acts readiness",
              description: workflowResourceDescription(workflow, "Current acts readiness"),
              mimeType: RESOURCE_MIME_TYPE,
            })),
          };
        },
      }),
    },
  ];

  for (const definition of definitions) {
    server.registerResource(
      definition.kind,
      definition.template,
      {
        title: definition.title,
        description: definition.description,
        mimeType: RESOURCE_MIME_TYPE,
      },
      async (_uri, variables) => {
        const workflowId = workflowIdSchema.parse(variables.workflowId);
        switch (definition.kind) {
          case "status":
            return resourceContent(definition.kind, workflowId, await loadWorkflowStatus(authResolution, workflowId));
          case "schedule-draft":
            return resourceContent(definition.kind, workflowId, await loadScheduleDraftResource(authResolution, workflowId));
          case "material-readiness":
            return resourceContent(definition.kind, workflowId, await loadMaterialReadinessResource(authResolution, workflowId));
          case "acts-readiness":
            return resourceContent(definition.kind, workflowId, await loadActsReadinessResource(authResolution, workflowId));
        }
      },
    );
  }
}

function promptPayload(workflow: WorkflowStatusSnapshot, scheduleDraft: unknown, materialReadiness: unknown, actsReadiness: unknown) {
  return {
    promptVersion: EXECUTION_DOCUMENTATION_WORKFLOW_PROMPT_VERSION,
    workflow,
    scheduleDraft,
    materialReadiness,
    actsReadiness,
    instructions: {
      askOnlyOnMissingInputs: true,
      showAssumptions: true,
      doNotInventFacts: true,
      confirmBeforeApprovalOrFinalActions: true,
      continueCurrentStage: true,
    },
  };
}

async function loadPromptContext(authResolution: McpAuthResolution, workflowId: number) {
  const [workflow, scheduleDraft, materialReadiness, actsReadiness] = await Promise.all([
    loadWorkflowStatus(authResolution, workflowId),
    loadScheduleDraftResource(authResolution, workflowId),
    loadMaterialReadinessResource(authResolution, workflowId),
    loadActsReadinessResource(authResolution, workflowId),
  ]);
  return promptPayload(workflow, scheduleDraft, materialReadiness, actsReadiness);
}

export function registerMcpDiscovery(server: McpServer, authResolution: McpAuthResolution): void {
  registerWorkflowResourceTemplates(server, authResolution);

  server.registerPrompt("execution_documentation_workflow", {
    title: `Execution documentation workflow v${EXECUTION_DOCUMENTATION_WORKFLOW_PROMPT_VERSION}`,
    description:
      "Guides the agent through execution documentation from the current workflow stage, using only missing inputs, explicit assumptions and server-verified confirmation gates.",
    argsSchema: {
      workflowId: z.coerce.number().int().positive(),
    },
  }, async ({ workflowId }) => {
    requireAuth(authResolution);
    const payload = await loadPromptContext(authResolution, workflowId);
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `execution_documentation_workflow v${EXECUTION_DOCUMENTATION_WORKFLOW_PROMPT_VERSION}\n` +
              "Ask only about missingInputs.\n" +
              "Show assumptions explicitly.\n" +
              "Do not invent facts.\n" +
              "Ask for confirmation before approval or final actions.\n" +
              "Continue from the current stage.\n" +
              "Do not restart the workflow.",
          },
        },
        {
          role: "user",
          content: {
            type: "text",
            text: `${JSON.stringify({ workflowId, context: payload }, null, 2)}\n`,
          },
        },
      ],
    };
  });
}
