import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const toolsPath = "server/mcp/tools/materialRegister.ts";

function registration(source: string, toolName: string): string {
  const match = source.match(
    new RegExp(
      `server\\.registerTool\\(\\s*"${toolName}",([\\s\\S]*?)withToolLogging\\("${toolName}"`,
    ),
  );
  assert.ok(match, `${toolName} registration not found`);
  return match[1];
}

test("TASK-007 registers material register tools in the MCP server", async () => {
  const factory = await readFile("server/mcp/createMcpServer.ts", "utf8");

  assert.match(
    factory,
    /import \{ registerMaterialRegisterTools \} from "\.\/tools\/materialRegister"/,
  );
  assert.match(factory, /registerMaterialRegisterTools\(server, authResolution\)/);
});

test("TASK-007 MCP tools expose owner-scoped read and idempotent write contracts", async () => {
  const source = await readFile(toolsPath, "utf8");
  const build = registration(source, "build_material_register");
  const get = registration(source, "get_material_register");
  const confirm = registration(source, "confirm_material_classification");
  const missing = registration(source, "get_missing_quality_documents");

  assert.match(build, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(build, /expectedVersion:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)/);
  assert.match(build, /idempotencyKey:/);
  assert.match(
    build,
    /annotations:\s*\{\s*readOnlyHint:\s*false,\s*destructiveHint:\s*false,\s*idempotentHint:\s*true\s*\}/,
  );

  for (const readRegistration of [get, missing]) {
    assert.match(readRegistration, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
    assert.doesNotMatch(readRegistration, /expectedVersion|idempotencyKey/);
    assert.match(
      readRegistration,
      /annotations:\s*\{\s*readOnlyHint:\s*true,\s*destructiveHint:\s*false\s*\}/,
    );
  }

  assert.match(confirm, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(confirm, /registerItemId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(confirm, /classification:\s*classificationSchema/);
  assert.match(confirm, /expectedVersion:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)/);
  assert.match(confirm, /idempotencyKey:/);
  assert.match(
    confirm,
    /annotations:\s*\{\s*readOnlyHint:\s*false,\s*destructiveHint:\s*false,\s*idempotentHint:\s*true\s*\}/,
  );

  assert.match(
    source,
    /const classificationSchema = z\.enum\(\["material",\s*"equipment",\s*"product",\s*"unclassified"\]\)/,
  );
  assert.equal((source.match(/requireAuth\(authResolution\)/g) ?? []).length, 4);
  assert.doesNotMatch(
    source,
    /inputSchema:\s*\{[^}]*(?:userId|objectId|estimateId|scheduleId|projectMaterialId)/s,
  );
});

test("TASK-007 exposes stable material register error codes", async () => {
  const source = await readFile("server/mcp/errors.ts", "utf8");

  for (const code of [
    "MATERIAL_REGISTER_NOT_READY",
    "MATERIAL_REGISTER_NOT_FOUND",
    "MATERIAL_REGISTER_STALE",
  ]) {
    assert.match(source, new RegExp(`${code}:\\s*"${code}"`));
  }
});
