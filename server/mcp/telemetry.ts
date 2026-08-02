import { AsyncLocalStorage } from "node:async_hooks";
import { McpToolError } from "./errors";

type ToolAuditKind = "write" | "final";

export interface McpRequestTelemetry {
  requestId: string;
  userId: number | null;
}

export interface McpToolMetricSnapshot {
  invocations: number;
  errors: number;
  totalDurationMs: number;
  lastDurationMs: number;
  auditEvents: number;
  rateLimited: number;
}

interface ToolMetricState extends McpToolMetricSnapshot {
  rateWindowStartedAt: number;
  rateWindowCount: number;
}

const telemetryContext = new AsyncLocalStorage<McpRequestTelemetry>();
const toolMetrics = new Map<string, ToolMetricState>();

const MCP_TOOL_RATE_LIMIT_WINDOW_MS = 60_000;
const MCP_TOOL_RATE_LIMIT_MAX = Number(process.env.MCP_TOOL_RATE_LIMIT_MAX || 30);

const AUDIT_WORTHY_TOOLS = new Map<string, ToolAuditKind>([
  ["create_execution_workflow", "write"],
  ["set_workflow_input", "write"],
  ["create_upload_session", "write"],
  ["import_estimate_from_upload", "write"],
  ["analyze_estimate", "write"],
  ["calculate_schedule_draft", "write"],
  ["approve_schedule", "final"],
  ["build_material_register", "write"],
  ["attach_document_from_upload", "write"],
  ["generate_acts", "final"],
  ["export_act_pdf", "final"],
  ["export_act_attachments", "final"],
  ["generate_worklog_draft", "write"],
  ["build_execution_package", "final"],
]);

export function runWithMcpTelemetry<T>(telemetry: McpRequestTelemetry, fn: () => T): T {
  return telemetryContext.run(telemetry, fn);
}

export function getMcpTelemetry(): McpRequestTelemetry | undefined {
  return telemetryContext.getStore();
}

export function getToolAuditKind(toolName: string): ToolAuditKind | undefined {
  return AUDIT_WORTHY_TOOLS.get(toolName);
}

export function enforceToolRateLimit(toolName: string, userId: number): void {
  const key = `${userId}:${toolName}`;
  const now = Date.now();
  const current = toolMetrics.get(key) ?? {
    invocations: 0,
    errors: 0,
    totalDurationMs: 0,
    lastDurationMs: 0,
    auditEvents: 0,
    rateLimited: 0,
    rateWindowStartedAt: now,
    rateWindowCount: 0,
  };

  if (now - current.rateWindowStartedAt >= MCP_TOOL_RATE_LIMIT_WINDOW_MS) {
    current.rateWindowStartedAt = now;
    current.rateWindowCount = 0;
  }

  if (current.rateWindowCount >= MCP_TOOL_RATE_LIMIT_MAX) {
    current.rateLimited += 1;
    toolMetrics.set(key, current);
    throw new McpToolError("RATE_LIMITED", "Too many requests for this tool, please try again later", {
      recoverable: true,
    });
  }

  current.rateWindowCount += 1;
  toolMetrics.set(key, current);
}

export function recordToolOutcome(toolName: string, userId: number, durationMs: number, isError: boolean): void {
  const key = `${userId}:${toolName}`;
  const current = toolMetrics.get(key) ?? {
    invocations: 0,
    errors: 0,
    totalDurationMs: 0,
    lastDurationMs: 0,
    auditEvents: 0,
    rateLimited: 0,
    rateWindowStartedAt: Date.now(),
    rateWindowCount: 0,
  };

  current.invocations += 1;
  current.lastDurationMs = durationMs;
  current.totalDurationMs += durationMs;
  if (isError) {
    current.errors += 1;
  }
  toolMetrics.set(key, current);
}

export function recordAuditEvent(toolName: string, userId: number): void {
  const key = `${userId}:${toolName}`;
  const current = toolMetrics.get(key) ?? {
    invocations: 0,
    errors: 0,
    totalDurationMs: 0,
    lastDurationMs: 0,
    auditEvents: 0,
    rateLimited: 0,
    rateWindowStartedAt: Date.now(),
    rateWindowCount: 0,
  };
  current.auditEvents += 1;
  toolMetrics.set(key, current);
}

export function snapshotToolMetrics(): Record<string, McpToolMetricSnapshot> {
  return Object.fromEntries(
    Array.from(toolMetrics.entries()).map(([key, value]) => [
      key,
      {
        invocations: value.invocations,
        errors: value.errors,
        totalDurationMs: value.totalDurationMs,
        lastDurationMs: value.lastDurationMs,
        auditEvents: value.auditEvents,
        rateLimited: value.rateLimited,
      },
    ]),
  );
}

export function resetToolTelemetryForTests(): void {
  toolMetrics.clear();
}
