/**
 * @file: workflowStateMachine.ts
 * @description: Разрешённые переходы execution workflow. MVP использует линейный график
 *   (см. 00-mvp-scenario.md §5), поэтому переходы вперёд идут строго по порядку стадий,
 *   а "failed" достижим из любой нетерминальной стадии.
 * @dependencies: @shared/schema, server/mcp/errors.ts
 * @created: 2026-08-02
 */

import { WORKFLOW_STAGES, type WorkflowStage } from "@shared/schema";
import { McpToolError, MCP_ERROR_CODES } from "../../mcp/errors";

const TERMINAL_STAGES: ReadonlySet<WorkflowStage> = new Set<WorkflowStage>(["completed", "failed"]);

// WORKFLOW_STAGES ends with [..., "completed", "failed"]; the forward path excludes
// "failed" since it is reachable from every other stage, not just the previous one.
const FORWARD_ORDER: WorkflowStage[] = WORKFLOW_STAGES.filter((s) => s !== "failed");

export function allowedNextStages(stage: WorkflowStage): WorkflowStage[] {
  if (TERMINAL_STAGES.has(stage)) return [];

  const idx = FORWARD_ORDER.indexOf(stage);
  const next: WorkflowStage[] = [];
  if (idx >= 0 && idx + 1 < FORWARD_ORDER.length) {
    next.push(FORWARD_ORDER[idx + 1]);
  }
  next.push("failed");
  return next;
}

/**
 * Throws McpToolError(WORKFLOW_TRANSITION_NOT_ALLOWED) unless `next` is reachable from
 * `current` in one step. Staying on the same stage is always a no-op allowed transition.
 */
export function assertTransitionAllowed(current: WorkflowStage, next: WorkflowStage): void {
  if (current === next) return;

  if (!allowedNextStages(current).includes(next)) {
    throw new McpToolError(
      MCP_ERROR_CODES.WORKFLOW_TRANSITION_NOT_ALLOWED,
      `Cannot transition workflow from "${current}" to "${next}"`,
    );
  }
}
