import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function registration(source: string, toolName: string): string {
  const match = source.match(
    new RegExp(
      `server\\.registerTool\\(\\s*"${toolName}",([\\s\\S]*?)withToolLogging\\("${toolName}"`,
    ),
  );
  assert.ok(match, `${toolName} registration not found`);
  return match[1];
}

test("TASK-008 registers document ingestion tools in the MCP server", async () => {
  const factory = await readFile("server/mcp/createMcpServer.ts", "utf8");

  assert.match(
    factory,
    /import \{ registerDocumentIngestionTools \} from "\.\/tools\/documentIngestion"/,
  );
  assert.match(factory, /registerDocumentIngestionTools\(server, authResolution\)/);
});

test("TASK-008 document tools expose owner-scoped idempotent attach and read-only list", async () => {
  const source = await readFile("server/mcp/tools/documentIngestion.ts", "utf8");
  const attach = registration(source, "attach_document_from_upload");
  const list = registration(source, "list_material_documents");

  assert.match(attach, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(attach, /uploadId:\s*z\.string\(\)\.uuid\(\)/);
  assert.match(attach, /projectMaterialId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(attach, /docType:\s*documentTypeSchema/);
  assert.match(attach, /title:/);
  assert.match(attach, /docNumber:/);
  assert.match(attach, /docDate:/);
  assert.match(attach, /useInActs:/);
  assert.match(attach, /expectedVersion:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)/);
  assert.match(attach, /idempotencyKey:/);
  assert.match(
    attach,
    /annotations:\s*\{\s*readOnlyHint:\s*false,\s*destructiveHint:\s*false,\s*idempotentHint:\s*true\s*\}/,
  );

  assert.match(list, /workflowId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(list, /projectMaterialId:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.doesNotMatch(list, /expectedVersion|idempotencyKey/);
  assert.match(
    list,
    /annotations:\s*\{\s*readOnlyHint:\s*true,\s*destructiveHint:\s*false\s*\}/,
  );

  assert.match(
    source,
    /const documentTypeSchema = z\.enum\(\["certificate",\s*"declaration",\s*"passport",\s*"protocol"\]\)/,
  );
  assert.equal((source.match(/requireAuth\(authResolution\)/g) ?? []).length, 2);
  assert.doesNotMatch(
    source,
    /inputSchema:\s*\{[^}]*(?:userId|objectId|fileUrl|storageKey|bindingRole)/s,
  );
});

test("TASK-008 keeps estimate upload compatibility and dispatches uploads by persisted purpose", async () => {
  const tools = await readFile("server/mcp/tools/uploads.ts", "utf8");
  const routes = await readFile("server/routes/estimates.ts", "utf8");
  const create = registration(tools, "create_upload_session");

  assert.match(
    tools,
    /const uploadPurposeSchema = z\.enum\(\["estimate",\s*"quality_document"\]\)(?:\.optional\(\))?\.default\("estimate"\)/,
  );
  assert.match(create, /purpose:\s*uploadPurposeSchema/);
  assert.match(create, /originalFilename:\s*z\.string\(\)\.min\(1\)\.max\(255\)/);
  assert.match(routes, /['"]\/api\/mcp\/uploads\/:uploadId['"]/);
  assert.match(routes, /\.\.\.appAuth/);
  assert.match(routes, /storeMcpUpload\(/);
  assert.doesNotMatch(routes, /storeEstimateUpload\(/);
});

test("TASK-008 exposes stable document ingestion error codes", async () => {
  const source = await readFile("server/mcp/errors.ts", "utf8");

  for (const code of [
    "DOCUMENT_UPLOAD_INVALID",
    "MATERIAL_NOT_OWNED",
    "DOCUMENT_ALREADY_ATTACHED",
  ]) {
    assert.match(source, new RegExp(`${code}:\\s*"${code}"`));
  }
});
