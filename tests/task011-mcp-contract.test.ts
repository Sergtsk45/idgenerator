import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("TASK-011 registers workflow discovery resources and the execution documentation prompt", async () => {
  const factory = await readFile("server/mcp/createMcpServer.ts", "utf8");
  const discovery = await readFile("server/mcp/discovery.ts", "utf8");

  assert.match(factory, /import \{ registerMcpDiscovery \} from "\.\/discovery"/);
  assert.match(factory, /registerMcpDiscovery\(server, authResolution\)/);

  for (const needle of [
    "execution_documentation_workflow",
    "workflow/{workflowId}/status",
    "workflow/{workflowId}/schedule-draft",
    "workflow/{workflowId}/material-readiness",
    "workflow/{workflowId}/acts-readiness",
    "Ask only about missingInputs.",
    "Show assumptions explicitly.",
    "Do not invent facts.",
    "Ask for confirmation before approval or final actions.",
    "Continue from the current stage.",
  ]) {
    assert.match(discovery, new RegExp(escapeRegExp(needle)));
  }
});

test("TASK-011 discovery descriptions stay honest about side effects", async () => {
  const schedulePlanning = await readFile("server/mcp/tools/schedulePlanning.ts", "utf8");
  const acts = await readFile("server/mcp/tools/acts.ts", "utf8");

  assert.match(
    schedulePlanning,
    /Calculates and stores a deterministic versioned linear schedule draft from the current confirmed inputs, updating the workflow draft stage only when the draft changes\./,
  );
  assert.match(
    schedulePlanning,
    /Approves one fresh draft version, changes workflow stage to approved, and atomically creates the schedule with linked estimate tasks\./,
  );
  assert.match(
    acts,
    /Idempotently generates explicit draft acts or confirmed final acts from the owned workflow schedule; final mode requires confirmFinal=true and no readiness blockers\./,
  );
  assert.match(
    acts,
    /Creates an owned draft or final PDF artifact for one workflow act without mutating act content\./,
  );
  assert.match(
    acts,
    /Creates an owned draft or final PDF package from one workflow act's attachments without changing binding state\./,
  );
});
