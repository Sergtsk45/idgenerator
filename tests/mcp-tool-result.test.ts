/**
 * @file: mcp-tool-result.test.ts
 * @description: Unit-тесты для чистых MCP helper'ов (toolResult/errors), без БД.
 * @dependencies: node:test, server/mcp/toolResult.ts, server/mcp/errors.ts
 * @created: 2026-08-02
 */

import test from "node:test";
import assert from "node:assert/strict";
import { toolError, toolSuccess } from "../server/mcp/toolResult.ts";
import { AUTH_INVALID, AUTH_REQUIRED, McpToolError } from "../server/mcp/errors.ts";

test("toolSuccess wraps plain objects as structuredContent and text", () => {
  const result = toolSuccess({ pong: true, userId: 1 });
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.structuredContent, { pong: true, userId: 1 });
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, "text");
  assert.deepEqual(JSON.parse(result.content[0].text as string), { pong: true, userId: 1 });
});

test("toolSuccess wraps non-object payloads (arrays/primitives) under a result key", () => {
  const result = toolSuccess([1, 2, 3]);
  assert.deepEqual(result.structuredContent, { result: [1, 2, 3] });
});

test("toolError surfaces stable machine-readable codes for known McpToolError", () => {
  const result = toolError(AUTH_REQUIRED);
  assert.equal(result.isError, true);
  const parsed = JSON.parse(result.content[0].text as string);
  assert.equal(parsed.code, "AUTH_REQUIRED");

  const invalid = toolError(AUTH_INVALID);
  assert.equal(JSON.parse(invalid.content[0].text as string).code, "AUTH_INVALID");
});

test("toolError never leaks internal error details for unexpected exceptions", () => {
  const result = toolError(new Error("leaked db password: hunter2"));
  const parsed = JSON.parse(result.content[0].text as string);
  assert.equal(parsed.code, "INTERNAL_ERROR");
  assert.equal(parsed.message, "Internal error");
  assert.doesNotMatch(JSON.stringify(result), /hunter2/);
});

test("McpToolError carries a stable error code", () => {
  const err = new McpToolError("FORBIDDEN", "nope");
  assert.equal(err.code, "FORBIDDEN");
  assert.equal(err.message, "nope");
});
