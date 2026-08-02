import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const toolsPath = "server/mcp/tools/schedulePlanning.ts";

function registration(source: string, toolName: string): string {
  const match = source.match(
    new RegExp(
      `server\\.registerTool\\(\\s*"${toolName}",([\\s\\S]*?)withToolLogging\\("${toolName}"`,
    ),
  );
  assert.ok(match, `${toolName} registration not found`);
  return match[1];
}

test("TASK-006 registers schedule planning tools in the MCP server", async () => {
  const factory = await readFile("server/mcp/createMcpServer.ts", "utf8");

  assert.match(
    factory,
    /import \{ registerSchedulePlanningTools \} from "\.\/tools\/schedulePlanning"/,
  );
  assert.match(factory, /registerSchedulePlanningTools\(server, authResolution\)/);
});

test("TASK-006 MCP schedule tools expose owner-scoped versioned contracts", async () => {
  const source = await readFile(toolsPath, "utf8");
  const calculate = registration(source, "calculate_schedule_draft");
  const get = registration(source, "get_schedule_draft");
  const approve = registration(source, "approve_schedule");

  assert.match(calculate, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(calculate, /expectedVersion:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)/);
  assert.match(calculate, /idempotencyKey:/);
  assert.match(
    calculate,
    /annotations:\s*\{\s*readOnlyHint:\s*false,\s*destructiveHint:\s*false,\s*idempotentHint:\s*true\s*\}/,
  );

  assert.match(get, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.doesNotMatch(get, /expectedVersion|idempotencyKey/);
  assert.match(
    get,
    /annotations:\s*\{\s*readOnlyHint:\s*true,\s*destructiveHint:\s*false\s*\}/,
  );

  assert.match(approve, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(approve, /draftVersion:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(approve, /expectedVersion:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)/);
  assert.match(approve, /idempotencyKey:/);
  assert.match(
    approve,
    /annotations:\s*\{\s*readOnlyHint:\s*false,\s*destructiveHint:\s*false,\s*idempotentHint:\s*true\s*\}/,
  );

  assert.equal((source.match(/requireAuth\(authResolution\)/g) ?? []).length, 3);
  assert.doesNotMatch(source, /inputSchema:\s*\{[^}]*userId/s);
});

test("TASK-006 exposes stable schedule planning error codes", async () => {
  const source = await readFile("server/mcp/errors.ts", "utf8");

  for (const code of [
    "SCHEDULE_INPUTS_INCOMPLETE",
    "LABOR_DATA_REQUIRED",
    "SCHEDULE_DRAFT_STALE",
    "SCHEDULE_APPROVAL_CONFLICT",
  ]) {
    assert.match(source, new RegExp(`${code}:\\s*"${code}"`));
  }
});
