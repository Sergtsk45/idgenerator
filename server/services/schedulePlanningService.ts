import type { ExecutionWorkflowInput, WorkflowStage } from "@shared/schema";

import { db } from "../db";
import type { McpAuthContext } from "../mcp/authContext";
import { MCP_ERROR_CODES, McpToolError } from "../mcp/errors";
import { loadCurrentEstimateAnalysis } from "./estimate-analysis/currentEstimateAnalysis";
import * as workflowRepo from "./execution-workflow/workflowRepository";
import { evaluateMissingWorkflowInputs } from "./execution-workflow/workflowInputs";
import { loadOwnedWorkflow, withIdempotency } from "./execution-workflow/workflowService";
import {
  CREW_LABOR_COVERAGE_THRESHOLD_PERCENT,
  planSchedule,
  SCHEDULE_DRAFT_SCHEMA_VERSION,
  SCHEDULE_PLANNER_VERSION,
  SchedulePlanningError,
  type PlannedSchedule,
  type PlanningMode,
  type WorkingCalendar,
} from "./schedule-planning/planSchedule";
import * as draftRepo from "./schedule-planning/scheduleDraftRepository";

type InputValues = Map<string, unknown>;

export interface ScheduleDraftResult {
  workflowId: number;
  workflowVersion: number;
  stage: WorkflowStage;
  draftId: number;
  draftVersion: number;
  inputHash: string;
  status: "draft" | "approved";
  approvedScheduleId: number | null;
  plan: PlannedSchedule;
}

export interface ScheduleApprovalResult {
  workflowId: number;
  workflowVersion: number;
  stage: "schedule_approved";
  draftId: number;
  draftVersion: number;
  scheduleId: number;
  tasksCount: number;
}

function confirmedValues(inputs: ExecutionWorkflowInput[]): InputValues {
  return new Map(inputs.filter((input) => input.confirmed).map((input) => [input.key, input.valueJson]));
}

function draftResult(
  workflow: { id: number; version: number; stage: WorkflowStage },
  draft: Awaited<ReturnType<typeof draftRepo.getLatestScheduleDraft>> & {},
): ScheduleDraftResult {
  return {
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    stage: workflow.stage,
    draftId: draft.id,
    draftVersion: draft.version,
    inputHash: draft.inputHash,
    status: draft.approvedScheduleId ? "approved" : "draft",
    approvedScheduleId: draft.approvedScheduleId,
    plan: draft.draftJson as PlannedSchedule,
  };
}

async function currentPlanningState(client: workflowRepo.DbClient, workflow: Awaited<ReturnType<typeof loadOwnedWorkflow>>) {
  const analysis = await loadCurrentEstimateAnalysis(client, workflow);
  const inputs = await workflowRepo.getWorkflowInputs(client, workflow.id);
  if (!analysis) return { analysis: undefined, inputs, evaluation: undefined };
  const evaluation = evaluateMissingWorkflowInputs(inputs, {
    analysisAvailable: true,
    analysisInputHash: analysis.inputHash,
    laborHoursAvailable: analysis.summary.laborCoveragePercent >= CREW_LABOR_COVERAGE_THRESHOLD_PERCENT
      && analysis.mainWorks.every((work) => work.laborHours > 0),
  });
  return { analysis, inputs, evaluation };
}

function requireReadyPlanningState(
  state: Awaited<ReturnType<typeof currentPlanningState>>,
) {
  if (!state.analysis || !state.evaluation) {
    throw new McpToolError(MCP_ERROR_CODES.SCHEDULE_INPUTS_INCOMPLETE, "Current estimate analysis is required", {
      recoverable: true,
    });
  }
  if (state.evaluation.blockingIssues.some((issue) => issue.code === "LABOR_DATA_REQUIRED")) {
    throw new McpToolError(MCP_ERROR_CODES.LABOR_DATA_REQUIRED, "Crew-size planning requires 100% labor coverage", {
      recoverable: true,
    });
  }
  if (!state.evaluation.ready) {
    throw new McpToolError(MCP_ERROR_CODES.SCHEDULE_INPUTS_INCOMPLETE, "Required schedule inputs are incomplete", {
      recoverable: true,
    });
  }
  return { analysis: state.analysis, inputs: state.inputs, evaluation: state.evaluation };
}

function calculatePlan(state: ReturnType<typeof requireReadyPlanningState>): PlannedSchedule {
  const values = confirmedValues(state.inputs);
  try {
    return planSchedule({
      projectStartDate: values.get("projectStartDate") as string,
      workingCalendar: values.get("workingCalendar") as WorkingCalendar,
      planningMode: values.get("planningMode") as PlanningMode,
      targetDurationDays: values.get("targetDurationDays") as number | undefined,
      crewSize: values.get("crewSize") as number | undefined,
      shiftHours: values.get("shiftHours") as number | undefined,
      utilizationFactor: values.get("utilizationFactor") as number | undefined,
      laborCoveragePercent: state.analysis.summary.laborCoveragePercent,
      mainWorks: state.analysis.mainWorks.map((work) => ({
        positionId: work.positionId,
        name: work.name,
        laborHours: work.laborHours,
        laborMachineCost: work.laborMachineCost,
        quantity: work.quantity,
      })),
    });
  } catch (error) {
    if (error instanceof SchedulePlanningError) {
      throw new McpToolError(MCP_ERROR_CODES[error.code], error.message, { recoverable: true });
    }
    throw error;
  }
}

export async function calculateScheduleDraft(
  auth: McpAuthContext,
  args: { workflowId: number; expectedVersion: number; idempotencyKey: string },
): Promise<ScheduleDraftResult> {
  return withIdempotency(auth.userId, "calculate_schedule_draft", args.idempotencyKey, {
    workflowId: args.workflowId,
    expectedVersion: args.expectedVersion,
  }, async (tx) => {
    const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);
    if (workflow.version !== args.expectedVersion) {
      throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
        recoverable: true,
      });
    }
    if (!(["awaiting_schedule_inputs", "schedule_draft_ready"] as WorkflowStage[]).includes(workflow.stage)) {
      throw new McpToolError(MCP_ERROR_CODES.SCHEDULE_INPUTS_INCOMPLETE, "Workflow is not ready for schedule calculation", {
        recoverable: true,
      });
    }

    const state = requireReadyPlanningState(await currentPlanningState(tx, workflow));
    const existing = await draftRepo.findScheduleDraftByInputHash(tx, {
      workflowId: workflow.id,
      inputHash: state.evaluation.scheduleInputHash,
      plannerVersion: SCHEDULE_PLANNER_VERSION,
      schemaVersion: SCHEDULE_DRAFT_SCHEMA_VERSION,
    });
    if (existing) return draftResult(workflow, existing);

    const nextStage: WorkflowStage = "schedule_draft_ready";
    const updated = workflow.stage === nextStage
      ? await workflowRepo.touchWorkflowIfVersionMatches(tx, workflow.id, args.expectedVersion)
      : await workflowRepo.updateWorkflowStageIfVersionMatches(tx, workflow.id, args.expectedVersion, nextStage);
    if (!updated) {
      throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
        recoverable: true,
      });
    }

    const plan = calculatePlan(state);
    const draft = await draftRepo.insertScheduleDraft(tx, {
      workflowId: workflow.id,
      estimateId: state.analysis.estimateId,
      version: await draftRepo.getNextScheduleDraftVersion(tx, workflow.id),
      plannerVersion: SCHEDULE_PLANNER_VERSION,
      schemaVersion: SCHEDULE_DRAFT_SCHEMA_VERSION,
      inputHash: state.evaluation.scheduleInputHash,
      draftJson: plan,
    });
    if (workflow.stage !== nextStage) {
      await workflowRepo.insertWorkflowEvent(tx, {
        workflowId: workflow.id,
        eventType: "stage_transition",
        actorType: "system",
        actorId: null,
        payloadJson: { from: workflow.stage, to: nextStage },
      });
    }
    await workflowRepo.insertWorkflowEvent(tx, {
      workflowId: workflow.id,
      eventType: "schedule_draft_calculated",
      actorType: "agent",
      actorId: String(auth.userId),
      payloadJson: { draftId: draft.id, draftVersion: draft.version, inputHash: draft.inputHash },
    });
    return draftResult(updated, draft);
  });
}

export async function getScheduleDraft(auth: McpAuthContext, workflowId: number): Promise<ScheduleDraftResult> {
  const workflow = await loadOwnedWorkflow(db, auth, workflowId);
  return draftResult(workflow, await requireLatestDraft(db, workflowId));
}

async function requireLatestDraft(client: workflowRepo.DbClient, workflowId: number) {
  const draft = await draftRepo.getLatestScheduleDraft(client, workflowId);
  if (!draft) throw new McpToolError(MCP_ERROR_CODES.NOT_FOUND, "Schedule draft not found");
  return draft;
}

function approvalResult(
  workflow: { id: number; version: number },
  draft: { id: number; version: number },
  scheduleId: number,
  tasksCount: number,
): ScheduleApprovalResult {
  return {
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    stage: "schedule_approved",
    draftId: draft.id,
    draftVersion: draft.version,
    scheduleId,
    tasksCount,
  };
}

export async function approveSchedule(
  auth: McpAuthContext,
  args: { workflowId: number; draftVersion: number; expectedVersion: number; idempotencyKey: string },
): Promise<ScheduleApprovalResult> {
  return withIdempotency(auth.userId, "approve_schedule", args.idempotencyKey, {
    workflowId: args.workflowId,
    draftVersion: args.draftVersion,
    expectedVersion: args.expectedVersion,
  }, async (tx) => {
    const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);
    const draft = await draftRepo.getScheduleDraftByVersion(tx, workflow.id, args.draftVersion);
    if (!draft) throw new McpToolError(MCP_ERROR_CODES.NOT_FOUND, "Schedule draft not found");
    if (draft.estimateId !== workflow.estimateId) {
      throw new McpToolError(MCP_ERROR_CODES.SCHEDULE_APPROVAL_CONFLICT, "Schedule draft belongs to another estimate");
    }

    if (draft.approvedScheduleId !== null) {
      if (workflow.scheduleId !== draft.approvedScheduleId || workflow.stage !== "schedule_approved") {
        throw new McpToolError(MCP_ERROR_CODES.SCHEDULE_APPROVAL_CONFLICT, "Approved draft linkage is inconsistent");
      }
      const schedule = await draftRepo.getScheduleById(tx, draft.approvedScheduleId);
      if (!schedule || schedule.objectId !== workflow.objectId || schedule.estimateId !== workflow.estimateId) {
        throw new McpToolError(MCP_ERROR_CODES.SCHEDULE_APPROVAL_CONFLICT, "Approved schedule is missing or inconsistent");
      }
      return approvalResult(workflow, draft, schedule.id, (await draftRepo.getScheduleTasks(tx, schedule.id)).length);
    }

    if (workflow.version !== args.expectedVersion) {
      throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", {
        recoverable: true,
      });
    }
    if (workflow.stage !== "schedule_draft_ready" || workflow.scheduleId !== null) {
      throw new McpToolError(MCP_ERROR_CODES.SCHEDULE_APPROVAL_CONFLICT, "Workflow cannot approve this schedule draft");
    }

    const state = await currentPlanningState(tx, workflow);
    if (!state.analysis || !state.evaluation || state.evaluation.scheduleInputHash !== draft.inputHash) {
      throw new McpToolError(MCP_ERROR_CODES.SCHEDULE_DRAFT_STALE, "Schedule draft inputs are stale", {
        recoverable: true,
      });
    }
    if (draft.plannerVersion !== SCHEDULE_PLANNER_VERSION || draft.schemaVersion !== SCHEDULE_DRAFT_SCHEMA_VERSION) {
      throw new McpToolError(MCP_ERROR_CODES.SCHEDULE_DRAFT_STALE, "Schedule draft contract is stale", {
        recoverable: true,
      });
    }
    if (!state.evaluation.ready) {
      throw new McpToolError(MCP_ERROR_CODES.SCHEDULE_DRAFT_STALE, "Schedule draft inputs are no longer complete", {
        recoverable: true,
      });
    }

    const plan = draft.draftJson as PlannedSchedule;
    const schedule = await draftRepo.createScheduleFromDraft(tx, {
      objectId: workflow.objectId,
      estimateId: state.analysis.estimateId,
      title: `График работ (workflow ${workflow.id}, версия ${draft.version})`,
      calendarStart: plan.calendarStart,
    });
    const updated = await workflowRepo.attachScheduleAndUpdateStageIfVersionMatches(
      tx,
      workflow.id,
      args.expectedVersion,
      schedule.id,
      "schedule_approved",
    );
    if (!updated) {
      throw new McpToolError(MCP_ERROR_CODES.SCHEDULE_APPROVAL_CONFLICT, "Schedule approval lost a concurrent update", {
        recoverable: true,
      });
    }

    const workById = new Map(state.analysis.mainWorks.map((work) => [work.positionId, work]));
    const tasks = await draftRepo.insertScheduleTasks(tx, plan.tasks.map((task) => {
      const work = workById.get(task.estimatePositionId);
      if (!work) throw new McpToolError(MCP_ERROR_CODES.SCHEDULE_DRAFT_STALE, "Draft contains a stale estimate position");
      return {
        scheduleId: schedule.id,
        workId: null,
        estimatePositionId: task.estimatePositionId,
        titleOverride: null,
        quantity: work.quantity === null ? null : String(work.quantity),
        unit: work.unit,
        startDate: task.startDate,
        durationDays: task.durationDays,
        orderIndex: task.orderIndex,
      };
    }));
    const approved = await draftRepo.markScheduleDraftApproved(tx, draft.id, schedule.id);
    if (!approved) {
      throw new McpToolError(MCP_ERROR_CODES.SCHEDULE_APPROVAL_CONFLICT, "Schedule draft was approved concurrently", {
        recoverable: true,
      });
    }
    await workflowRepo.insertWorkflowEvent(tx, {
      workflowId: workflow.id,
      eventType: "stage_transition",
      actorType: "system",
      actorId: null,
      payloadJson: { from: workflow.stage, to: "schedule_approved" },
    });
    await workflowRepo.insertWorkflowEvent(tx, {
      workflowId: workflow.id,
      eventType: "schedule_approved",
      actorType: "agent",
      actorId: String(auth.userId),
      payloadJson: { draftId: draft.id, draftVersion: draft.version, scheduleId: schedule.id, tasksCount: tasks.length },
    });
    return approvalResult(updated, draft, schedule.id, tasks.length);
  });
}
