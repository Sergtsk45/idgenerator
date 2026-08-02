import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("TASK-003 exposes owner-scoped upload/import tools without userId arguments", async () => {
  const tools = await readFile("server/mcp/tools/uploads.ts", "utf8");
  for (const name of ["create_upload_session", "import_estimate_from_upload"]) {
    assert.match(tools, new RegExp(`"${name}"`));
  }
  assert.equal((tools.match(/requireAuth\(authResolution\)/g) ?? []).length, 2);
  assert.doesNotMatch(tools, /inputSchema:\s*\{[^}]*userId/s);
  assert.match(tools, /expectedVersion/);
  assert.match(tools, /idempotencyKey/);
});

test("upload endpoint requires app auth, is feature-flagged and REST import uses shared service", async () => {
  const routes = await readFile("server/routes/estimates.ts", "utf8");
  assert.match(routes, /MCP_ENABLED === 'true'/);
  assert.match(routes, /app\.post\([\s\S]*'\/api\/mcp\/uploads\/:uploadId'[\s\S]*\.\.\.appAuth/);
  assert.match(routes, /storeEstimateUpload/);
  assert.match(routes, /const result = await importEstimate\(input, obj\.id\)/);

  const storage = await readFile("server/storage.ts", "utf8");
  assert.match(storage, /return importEstimateThroughService\(payload, objectId\)/);
});

test("TASK-003 stable error codes are declared", async () => {
  const errors = await readFile("server/mcp/errors.ts", "utf8");
  for (const code of [
    "UPLOAD_EXPIRED",
    "UPLOAD_NOT_FOUND",
    "UPLOAD_ALREADY_CONSUMED",
    "FILE_TYPE_NOT_ALLOWED",
    "FILE_TOO_LARGE",
    "ESTIMATE_IMPORT_FAILED",
  ]) {
    assert.match(errors, new RegExp(`"${code}"`));
  }
});
