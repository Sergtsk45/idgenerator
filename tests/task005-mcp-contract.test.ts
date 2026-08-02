import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("TASK-005 MCP workflow tools expose the catalog contract without caller identity", async () => {
  const source = await readFile("server/mcp/tools/workflow.ts", "utf8");

  assert.match(source, /import \{[^}]*WORKFLOW_INPUT_KEYS[^}]*\} from "\.\.\/\.\.\/services\/execution-workflow\/workflowInputs"/s);
  assert.match(source, /const workflowInputKeySchema = z\.enum\(WORKFLOW_INPUT_KEYS\)/);
  assert.match(source, /key:\s*workflowInputKeySchema/);
  assert.doesNotMatch(source, /inputSchema:\s*\{[^}]*userId/s);
  assert.equal((source.match(/requireAuth\(authResolution\)/g) ?? []).length, 4);
});

test("get_missing_workflow_inputs stays read-only and set_workflow_input stays idempotent", async () => {
  const source = await readFile("server/mcp/tools/workflow.ts", "utf8");
  const missingRegistration = source.match(
    /server\.registerTool\(\s*"get_missing_workflow_inputs",([\s\S]*?)withToolLogging\("get_missing_workflow_inputs"/,
  )?.[1];
  assert.ok(missingRegistration, "get_missing_workflow_inputs registration not found");
  assert.match(
    missingRegistration,
    /annotations:\s*\{\s*readOnlyHint:\s*true,\s*destructiveHint:\s*false\s*\}/,
  );
  assert.doesNotMatch(missingRegistration, /temporary baseline|superseded/i);

  const setRegistration = source.match(
    /server\.registerTool\(\s*"set_workflow_input",([\s\S]*?)withToolLogging\("set_workflow_input"/,
  )?.[1];
  assert.ok(setRegistration, "set_workflow_input registration not found");
  assert.match(setRegistration, /key:\s*workflowInputKeySchema/);
  assert.match(
    setRegistration,
    /annotations:\s*\{\s*readOnlyHint:\s*false,\s*destructiveHint:\s*false,\s*idempotentHint:\s*true\s*\}/,
  );
});
