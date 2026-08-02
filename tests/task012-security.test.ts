import assert from "node:assert/strict";
import test from "node:test";

import { validateMcpRequestHostOrigin } from "../server/mcp/httpGuards";
import { toolSuccess, withToolLogging } from "../server/mcp/toolResult";
import {
  getToolAuditKind,
  recordToolOutcome,
  resetToolTelemetryForTests,
  snapshotToolMetrics,
} from "../server/mcp/telemetry";

function createMockRequest(host: string, origin?: string) {
  return {
    get(header: string) {
      if (header.toLowerCase() === "host") return host;
      if (header.toLowerCase() === "origin") return origin;
      return undefined;
    },
  } as any;
}

function createMockResponse() {
  const state: { statusCode?: number; body?: unknown } = {};
  return {
    state,
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
  } as any;
}

test("MCP host/origin guard rejects cross-site origins and allows same-origin localhost", () => {
  const allowedReq = createMockRequest("localhost:5000", "http://localhost:5000");
  const allowedRes = createMockResponse();
  let allowedNextCalled = false;
  validateMcpRequestHostOrigin(allowedReq, allowedRes, () => {
    allowedNextCalled = true;
  });
  assert.equal(allowedNextCalled, true);

  const blockedReq = createMockRequest("localhost:5000", "https://evil.example");
  const blockedRes = createMockResponse();
  let blockedNextCalled = false;
  validateMcpRequestHostOrigin(blockedReq, blockedRes, () => {
    blockedNextCalled = true;
  });
  assert.equal(blockedNextCalled, false);
  assert.equal(blockedRes.state.statusCode, 403);
  assert.equal((blockedRes.state.body as { code?: string } | undefined)?.code, "FORBIDDEN");
});

test("MCP tool logging records metrics, audit events, and rate-limits per user/tool", async () => {
  resetToolTelemetryForTests();

  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map((value) => String(value)).join(" "));
  };

  try {
    const handler = withToolLogging("set_workflow_input", 77, async () => toolSuccess({ ok: true }));
    const first = await handler();
    assert.equal(first.isError, undefined);

    const metrics = snapshotToolMetrics();
    assert.equal(metrics["77:set_workflow_input"].invocations, 1);
    assert.equal(metrics["77:set_workflow_input"].errors, 0);
    assert.equal(metrics["77:set_workflow_input"].auditEvents, 1);

    for (let i = 0; i < 29; i += 1) {
      await handler();
    }
    const limited = await handler();
    assert.equal(limited.isError, true);
    assert.match(limited.content[0].text, /RATE_LIMITED/);

    const updated = snapshotToolMetrics()["77:set_workflow_input"];
    assert.equal(updated.rateLimited, 1);
    assert.ok(logs.some((line) => line.includes("[mcp:audit]") && line.includes("set_workflow_input")));
    assert.ok(logs.some((line) => line.includes("[mcp:tool]") && line.includes("set_workflow_input")));
  } finally {
    console.log = originalLog;
    resetToolTelemetryForTests();
  }
});

test("MCP telemetry helpers expose audit categories and raw outcomes", () => {
  resetToolTelemetryForTests();
  recordToolOutcome("task012_metric_probe", 777, 12, false);
  recordToolOutcome("task012_metric_probe", 777, 8, true);

  const snapshot = snapshotToolMetrics()["777:task012_metric_probe"];
  assert.ok(snapshot);
  assert.equal(snapshot.invocations, 2);
  assert.equal(snapshot.errors, 1);
  assert.equal(snapshot.totalDurationMs, 20);
  assert.equal(snapshot.lastDurationMs, 8);
  assert.equal(getToolAuditKind("build_execution_package"), "final");
  assert.equal(getToolAuditKind("list_objects"), undefined);

  resetToolTelemetryForTests();
});
