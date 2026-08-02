import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function registration(source: string, toolName: string): string {
  const match = source.match(new RegExp(
    `server\\.registerTool\\("${toolName}",([\\s\\S]*?)withToolLogging\\("${toolName}"`,
  ));
  assert.ok(match, `${toolName} registration not found`);
  return match[1];
}

test("TASK-010 registers worklog and execution-package MCP tools", async () => {
  const factory = await readFile("server/mcp/createMcpServer.ts", "utf8");
  assert.match(factory, /import \{ registerWorklogTools \} from "\.\/tools\/worklog"/);
  assert.match(factory, /import \{ registerExecutionPackageTools \} from "\.\/tools\/executionPackage"/);
  assert.match(factory, /registerWorklogTools\(server, authResolution\)/);
  assert.match(factory, /registerExecutionPackageTools\(server, authResolution\)/);
});

test("TASK-010 worklog tools expose read-only retrieval and idempotent generation", async () => {
  const source = await readFile("server/mcp/tools/worklog.ts", "utf8");
  const get = registration(source, "get_worklog_draft");
  const generate = registration(source, "generate_worklog_draft");

  assert.match(get, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.doesNotMatch(get, /expectedVersion|idempotencyKey/);
  assert.match(get, /annotations:\s*\{\s*readOnlyHint:\s*true,\s*destructiveHint:\s*false\s*\}/);

  assert.match(generate, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(generate, /expectedVersion:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)/);
  assert.match(generate, /idempotencyKey:\s*z\.string\(\)\.min\(1\)\.max\(200\)/);
  assert.match(generate, /idempotentHint:\s*true/);
  assert.equal((source.match(/requireAuth\(authResolution\)/g) ?? []).length, 2);
  assert.doesNotMatch(source, /inputSchema:\s*\{[^}]*(?:userId|objectId|inputHash)/s);
});

test("TASK-010 handover readiness is read-only and package build is explicit and idempotent", async () => {
  const source = await readFile("server/mcp/tools/executionPackage.ts", "utf8");
  const readiness = registration(source, "check_handover_readiness");
  const build = registration(source, "build_execution_package");

  assert.match(readiness, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.doesNotMatch(readiness, /expectedVersion|idempotencyKey|confirmFinal/);
  assert.match(readiness, /readOnlyHint:\s*true/);

  assert.match(build, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(build, /mode:\s*z\.enum\(\["draft",\s*"final"\]\)/);
  assert.match(build, /confirmFinal:\s*z\.boolean\(\)\.default\(false\)/);
  assert.match(build, /expectedVersion:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)/);
  assert.match(build, /idempotencyKey:\s*z\.string\(\)\.min\(1\)\.max\(200\)/);
  assert.match(build, /idempotentHint:\s*true/);
  assert.equal((source.match(/requireAuth\(authResolution\)/g) ?? []).length, 2);
  assert.doesNotMatch(source, /inputSchema:\s*\{[^}]*(?:userId|objectId|storageKey|filename|inputHash)/s);
});

test("TASK-010 package download is authenticated, owner-scoped and exposes stable errors", async () => {
  const routes = await readFile("server/routes/packages.ts", "utf8");
  const bootstrap = await readFile("server/routes.ts", "utf8");
  const errors = await readFile("server/mcp/errors.ts", "utf8");

  assert.match(bootstrap, /import \{ registerPackageRoutes \} from "\.\/routes\/packages"/);
  assert.match(bootstrap, /registerPackageRoutes\(app\)/);
  assert.match(
    routes,
    /app\.get\("\/api\/execution-packages\/:packageId\/file",\s*\.\.\.appAuth,[\s\S]*getOwnedExecutionPackageFile\([\s\S]*PACKAGE_NOT_OWNED[\s\S]*status\(404\)/,
  );
  for (const code of [
    "WORKLOG_NOT_READY",
    "WORKLOG_DRAFT_STALE",
    "HANDOVER_NOT_READY",
    "PACKAGE_REQUIRES_CONFIRMATION",
    "PACKAGE_TOO_LARGE",
    "PACKAGE_NOT_OWNED",
  ]) assert.match(errors, new RegExp(`${code}:\\s*"${code}"`));
});

test("TASK-010 migration persists semantic worklog/package dedup keys", async () => {
  const migration = await readFile("migrations/0037_worklog_execution_packages.sql", "utf8");
  assert.match(migration, /UNIQUE \("workflow_id",\s*"input_hash",\s*"schema_version"\)/);
  assert.match(migration, /UNIQUE \("workflow_id",\s*"mode",\s*"input_hash"\)/);
  assert.match(migration, /execution_packages_user_object_idx/);
});
