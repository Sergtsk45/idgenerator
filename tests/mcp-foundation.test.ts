/**
 * @file: mcp-foundation.test.ts
 * @description: Contract tests for the MCP foundation (TASK-001): error codes, auth
 *   context extraction, and the diagnostic/list_objects tool ownership scoping.
 *   DB-backed parts skip gracefully without DATABASE_URL (see execution-workflow-service.test.ts).
 * @dependencies: node:test
 * @created: 2026-08-02
 */

import test from "node:test";
import assert from "node:assert/strict";

import { McpToolError, MCP_ERROR_CODES } from "../server/mcp/errors.ts";
import { toolSuccess, toolError } from "../server/mcp/toolResult.ts";

test("toolSuccess wraps data as JSON text content and is not an error", () => {
  const result = toolSuccess({ ok: true, foo: "bar" });
  assert.equal(result.isError, false);
  assert.equal(result.content[0].type, "text");
  assert.deepEqual(JSON.parse(result.content[0].text as string), { ok: true, foo: "bar" });
  assert.deepEqual(result.structuredContent, { ok: true, foo: "bar" });
});

test("toolError never leaks a stack trace, only a stable code/message/recoverable", () => {
  const result = toolError(new McpToolError(MCP_ERROR_CODES.FORBIDDEN, "nope", { recoverable: false }));
  assert.equal(result.isError, true);
  const parsed = JSON.parse(result.content[0].text as string);
  assert.equal(parsed.error.code, "FORBIDDEN");
  assert.equal(parsed.error.message, "nope");
  assert.equal(parsed.error.recoverable, false);
  assert.equal(parsed.stack, undefined);
});

test("toolError converts a plain Error into INTERNAL_ERROR without leaking its message", () => {
  const result = toolError(new Error("some internal detail with a stack trace"));
  const parsed = JSON.parse(result.content[0].text as string);
  assert.equal(parsed.error.code, "INTERNAL_ERROR");
  assert.equal(parsed.error.message, "Internal error");
});

test("requireAuthContext throws AUTH_REQUIRED when req.user is missing", async () => {
  const { requireAuthContext } = await import("../server/mcp/authContext.ts");
  assert.throws(
    () => requireAuthContext({} as any),
    (err: unknown) => err instanceof McpToolError && err.code === MCP_ERROR_CODES.AUTH_REQUIRED,
  );
});

test("requireAuthContext never trusts req.body for identity, only req.user", async () => {
  const { requireAuthContext } = await import("../server/mcp/authContext.ts");
  const fakeReq = {
    user: { id: 7, displayName: "Real", email: "real@test.local", role: "user", tariff: "basic" },
    body: { userId: 999 },
  } as any;
  const ctx = requireAuthContext(fakeReq);
  assert.equal(ctx.userId, 7);
});

test("list_objects tool is scoped to the authenticated user via storage.listUserObjects", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile("server/mcp/tools/diagnostics.ts", "utf8");
  assert.match(source, /storage\.listUserObjects\(auth\.userId\)/);
});

test("httpTransport mounts /mcp behind authMiddleware and a rate limiter", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile("server/mcp/httpTransport.ts", "utf8");
  assert.match(source, /authMiddleware\(\{ required: true \}\)/);
  assert.match(source, /mcpRateLimiter/);
  assert.match(source, /express\.json\(\{ limit: MCP_BODY_LIMIT \}\)/);
});
