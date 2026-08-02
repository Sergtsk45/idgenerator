import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function registration(source: string, toolName: string): string {
  const match = source.match(
    new RegExp(
      `server\\.registerTool\\(\\s*"${toolName}",([\\s\\S]*?)withToolLogging\\("${toolName}"`,
    ),
  );
  assert.ok(match, `${toolName} registration not found`);
  return match[1];
}

test("TASK-009 registers the four act orchestration tools", async () => {
  const factory = await readFile("server/mcp/createMcpServer.ts", "utf8");

  assert.match(factory, /import \{ registerActTools \} from "\.\/tools\/acts"/);
  assert.match(factory, /registerActTools\(server, authResolution\)/);
});

test("TASK-009 exposes owner-scoped readiness and confirmed idempotent generation", async () => {
  const source = await readFile("server/mcp/tools/acts.ts", "utf8");
  const readiness = registration(source, "check_acts_readiness");
  const generate = registration(source, "generate_acts");

  assert.match(readiness, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.doesNotMatch(readiness, /expectedVersion|idempotencyKey|confirmFinal/);
  assert.match(
    readiness,
    /annotations:\s*\{\s*readOnlyHint:\s*true,\s*destructiveHint:\s*false\s*\}/,
  );

  assert.match(source, /z\.enum\(\["draft",\s*"final"\]\)/);
  assert.match(generate, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(generate, /mode:\s*actGenerationModeSchema/);
  assert.match(generate, /confirmFinal:\s*z\.boolean\(\)/);
  assert.match(generate, /expectedVersion:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)/);
  assert.match(generate, /idempotencyKey:\s*z\.string\(\)\.min\(1\)\.max\(200\)/);
  assert.match(
    generate,
    /annotations:\s*\{\s*readOnlyHint:\s*false,\s*destructiveHint:\s*false,\s*idempotentHint:\s*true\s*\}/,
  );
});

test("TASK-009 PDF exports are authenticated idempotent writes without trusted owner inputs", async () => {
  const source = await readFile("server/mcp/tools/acts.ts", "utf8");

  for (const toolName of ["export_act_pdf", "export_act_attachments"]) {
    const exported = registration(source, toolName);
    assert.match(exported, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
    assert.match(exported, /actId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
    assert.match(exported, /mode:\s*actGenerationModeSchema/);
    assert.match(exported, /idempotencyKey:\s*z\.string\(\)\.min\(1\)\.max\(200\)/);
    assert.doesNotMatch(exported, /expectedVersion|userId|objectId|artifactUrl|fileUrl|storageKey/);
    assert.match(
      exported,
      /annotations:\s*\{\s*readOnlyHint:\s*false,\s*destructiveHint:\s*false,\s*idempotentHint:\s*true\s*\}/,
    );
  }

  assert.equal((source.match(/requireAuth\(authResolution\)/g) ?? []).length, 4);
  assert.doesNotMatch(
    source,
    /inputSchema:\s*\{[^}]*(?:userId|objectId|artifactUrl|fileUrl|storageKey)/s,
  );
});

test("TASK-009 publishes stable readiness, confirmation and artifact ownership errors", async () => {
  const source = await readFile("server/mcp/errors.ts", "utf8");

  for (const code of [
    "ACTS_NOT_READY",
    "ACT_GENERATION_REQUIRES_CONFIRMATION",
    "ARTIFACT_NOT_OWNED",
  ]) {
    assert.match(source, new RegExp(`${code}:\\s*"${code}"`));
  }
});

test("TASK-009 REST generation and exports share services and artifact downloads require auth", async () => {
  const scheduleRoutes = await readFile("server/routes/schedule.ts", "utf8");
  const actRoutes = await readFile("server/routes/acts.ts", "utf8");

  assert.match(
    scheduleRoutes,
    /import[\s\S]{0,400}\bgenerateActsForOwnedSchedule\b[\s\S]{0,200}from ['"]\.\.\/services\//,
  );
  assert.match(
    scheduleRoutes,
    /app\.post\(api\.schedules\.generateActs\.path,[\s\S]{0,1200}\bgenerateActsForOwnedSchedule\(/,
  );
  assert.match(actRoutes, /import[\s\S]{0,700}from ['"]\.\.\/services\/[^'"]+['"]/);
  assert.match(actRoutes, /\bexportActPdf\b/);
  assert.match(actRoutes, /\bexportActAttachments\b/);
  assert.match(actRoutes, /app\.post\([^\n]*export[^\n]*[\s\S]{0,4000}\bexportActPdf\(/);
  assert.match(actRoutes, /app\.post\(api\.acts\.exportAttachments\.path,[\s\S]{0,4000}\bexportActAttachments\(/);
  assert.match(
    actRoutes,
    /app\.get\(['"]\/api\/act-artifacts\/:artifactId\/file['"],\s*\.\.\.appAuth,[\s\S]{0,2500}getOwnedArtifactFile\([\s\S]{0,2500}ARTIFACT_NOT_OWNED[\s\S]{0,500}status\(404\)/,
  );
  assert.doesNotMatch(
    actRoutes,
    /numberMatch[\s\S]{0,800}ownedActs\.find\(\(act\) => act\.actNumber/,
    "legacy PDF download must not authorize a globally shared filename by duplicate act number",
  );
});

test("TASK-009 scopes duplicate act numbers by workflow/object instead of globally", async () => {
  const migration = await readFile("migrations/0036_act_workflow_artifacts.sql", "utf8");

  assert.match(migration, /DROP (?:CONSTRAINT|INDEX)[^;]*acts_act_number_unique/i);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX[^;]*acts_workflow_act_number_uq[\s\S]*?\("workflow_id",\s*"act_number"\)/i,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX[^;]*acts_legacy_object_act_number_uq[\s\S]*?\("object_id",\s*"act_number"\)/i,
  );
});

test("TASK-009 keeps generated/signed REST act data immutable", async () => {
  const source = await readFile("server/routes/acts.ts", "utf8");

  assert.match(source, /app\.put\(api\.actMaterialUsages\.replace\.path,\s*\.\.\.appAuth/);
  assert.match(source, /app\.put\(api\.actDocumentAttachments\.replace\.path,\s*\.\.\.appAuth/);
  assert.match(source, /app\.post\(api\.actDocumentAttachments\.resetFromUsages\.path,\s*\.\.\.appAuth/);
  assert.equal(
    (source.match(/act\.status !== ['"]draft['"]\) return res\.status\(409\)\.json\(\{ message: ['"]Final act is immutable['"] \}\)/g) ?? []).length,
    3,
    "all three REST edit paths must reject both generated and signed acts",
  );
});

test("TASK-009 validates, bounds, deduplicates and exports requested templates sequentially", async () => {
  const source = await readFile("server/routes/acts.ts", "utf8");
  const start = source.indexOf("if (act.workflowId)");
  const end = source.indexOf("const objectId", start);
  assert.ok(start >= 0 && end > start, "workflow artifact export branch not found");
  const branch = source.slice(start, end);

  assert.match(branch, /Array\.from\(new Set\(templateIds\.filter\(/);
  assert.match(branch, /requestedTemplates\.length > 20[\s\S]*status\(400\)/);
  assert.match(
    branch,
    /for \(const templateId of requestedTemplates\)[\s\S]*await storage\.getActTemplateByTemplateId\(templateId\)[\s\S]*status\(400\)/,
  );
  assert.match(
    branch,
    /for \(let index = 0; index < requestedTemplates\.length; index\+\+\)[\s\S]*artifacts\.push\(await exportActPdf\(/,
  );
  assert.doesNotMatch(branch, /Promise\.all/);
});
