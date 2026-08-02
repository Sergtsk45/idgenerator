import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("TASK-004 registers authenticated analyze/read tools without userId inputs", async () => {
  const factory = await readFile("server/mcp/createMcpServer.ts", "utf8");
  assert.match(factory, /import \{ registerEstimateAnalysisTools \} from "\.\/tools\/estimateAnalysis"/);
  assert.match(factory, /registerEstimateAnalysisTools\(server, authResolution\)/);

  const tools = await readFile("server/mcp/tools/estimateAnalysis.ts", "utf8");
  for (const name of ["analyze_estimate", "get_estimate_analysis"]) {
    assert.match(tools, new RegExp(`"${name}"`));
  }
  assert.equal((tools.match(/requireAuth\(authResolution\)/g) ?? []).length, 2);
  assert.doesNotMatch(tools, /inputSchema:\s*\{[^}]*userId/s);
});

test("analyze_estimate is versioned and idempotent; get_estimate_analysis is read-only", async () => {
  const tools = await readFile("server/mcp/tools/estimateAnalysis.ts", "utf8");
  const analyzeRegistration = tools.match(
    /server\.registerTool\(\s*"analyze_estimate",([\s\S]*?)withToolLogging\("analyze_estimate"/,
  )?.[1];
  assert.ok(analyzeRegistration, "analyze_estimate registration not found");
  assert.match(analyzeRegistration, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(analyzeRegistration, /expectedVersion:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)/);
  assert.match(analyzeRegistration, /idempotencyKey:\s*z\.string\(\)\.min\(1\)\.max\(200\)/);
  assert.match(
    analyzeRegistration,
    /annotations:\s*\{\s*readOnlyHint:\s*false,\s*destructiveHint:\s*false,\s*idempotentHint:\s*true\s*\}/,
  );

  const readRegistration = tools.match(
    /server\.registerTool\(\s*"get_estimate_analysis",([\s\S]*?)withToolLogging\("get_estimate_analysis"/,
  )?.[1];
  assert.ok(readRegistration, "get_estimate_analysis registration not found");
  assert.match(readRegistration, /inputSchema:\s*\{\s*workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)\s*\}/);
  assert.doesNotMatch(readRegistration, /expectedVersion|idempotencyKey/);
  assert.match(
    readRegistration,
    /annotations:\s*\{\s*readOnlyHint:\s*true,\s*destructiveHint:\s*false\s*\}/,
  );
});

test("TASK-004 declares required errors and append-only snapshot migration", async () => {
  const errors = await readFile("server/mcp/errors.ts", "utf8");
  for (const code of ["WORKFLOW_ESTIMATE_NOT_SET", "ESTIMATE_NOT_FOUND"]) {
    assert.match(errors, new RegExp(`${code}: "${code}"`));
  }

  const migration = await readFile("migrations/0032_estimate_analysis_snapshots.sql", "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "estimate_analysis_snapshots"/);
  assert.match(migration, /"workflow_id"[\s\S]*REFERENCES "execution_workflows"\("id"\) ON DELETE CASCADE/);
  assert.match(migration, /"estimate_id"[\s\S]*REFERENCES "estimates"\("id"\) ON DELETE CASCADE/);
  assert.match(migration, /"analysis_json" JSONB NOT NULL/);
  assert.match(
    migration,
    /\("workflow_id", "input_hash", "analysis_version", "schema_version"\)/,
  );
  assert.doesNotMatch(migration, /"updated_at"/);
});
