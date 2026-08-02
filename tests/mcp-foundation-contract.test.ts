/**
 * @file: mcp-foundation-contract.test.ts
 * @description: Контрактные проверки MCP-foundation через анализ исходников — не требуют БД,
 *   в духе tests/schedule-bootstrap-contract.test.ts. Гарантируют, что auth строится только
 *   на Bearer JWT, tools проверяют auth и ownership, а логирование не содержит секретов.
 * @dependencies: node:test, node:fs/promises
 * @created: 2026-08-02
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("MCP auth context only trusts Authorization: Bearer <jwt>, no Telegram/dev fallback", async () => {
  const source = await readFile("server/mcp/authContext.ts", "utf8");

  assert.match(source, /authorizationHeader\?\.startsWith\("Bearer "\)/);
  assert.match(source, /authService\.verifyJWT\(token\)/);
  assert.match(source, /user\.isBlocked/);
  assert.doesNotMatch(source, /x-telegram-init-data/i);
  assert.doesNotMatch(source, /telegramUser/);
  assert.doesNotMatch(source, /NODE_ENV.*development/);
});

test("MCP diagnostic tools require auth and scope list_objects to the caller", async () => {
  const source = await readFile("server/mcp/tools/diagnostics.ts", "utf8");

  const toolNames = ["ping", "get_current_user", "list_objects"];
  for (const name of toolNames) {
    assert.match(source, new RegExp(`"${name}"`));
  }

  // Every tool handler must resolve auth before doing any work.
  assert.match(source, /requireAuth\(authResolution\)/);
  const requireAuthCalls = source.match(/requireAuth\(authResolution\)/g) ?? [];
  assert.equal(requireAuthCalls.length, toolNames.length);

  // list_objects must be scoped by the resolved caller identity, not by client-supplied input.
  assert.match(source, /storage\.listUserObjects\(authContext\.userId\)/);

  // Missing vs invalid credentials must map to distinct, stable error codes.
  assert.match(source, /status === "missing"[\s\S]{0,20}throw AUTH_REQUIRED/);
  assert.match(source, /status === "invalid"[\s\S]{0,20}throw AUTH_INVALID/);
});

test("MCP tools never accept a client-supplied userId argument", async () => {
  const source = await readFile("server/mcp/tools/diagnostics.ts", "utf8");
  assert.doesNotMatch(source, /arguments\.userId|args\.userId|params\.userId/);
});

test("MCP HTTP transport enforces a body size limit and never logs secrets", async () => {
  const source = await readFile("server/mcp/httpTransport.ts", "utf8");

  assert.match(source, /MCP_MAX_BODY_BYTES/);
  assert.match(source, /413/);
  assert.match(source, /rateLimit\(/);

  // Logging helper must not read the raw Authorization header, bearer token or JWT payload —
  // only the already-resolved userId/method/status/duration may be logged.
  const logFnMatch = source.match(/function logMcpRequest\([\s\S]*?\n}/);
  assert.ok(logFnMatch, "logMcpRequest function not found");
  const logFn = logFnMatch![0];
  assert.doesNotMatch(logFn, /req\.headers/);
  assert.doesNotMatch(logFn, /Bearer/);
  assert.doesNotMatch(logFn, /req\.body/);
});

test("MCP endpoint does not proxy Express route handlers and is feature-flagged", async () => {
  const source = await readFile("server/index.ts", "utf8");

  assert.match(source, /MCP_ENABLED/);
  assert.match(source, /app\.all\("\/mcp"/);
  assert.doesNotMatch(source, /registerRoutes\([^)]*\).*\/mcp/);
});

test("MCP error codes match the TASK-001 contract", async () => {
  const source = await readFile("server/mcp/errors.ts", "utf8");
  for (const code of ["AUTH_REQUIRED", "AUTH_INVALID", "FORBIDDEN", "VALIDATION_ERROR", "INTERNAL_ERROR"]) {
    assert.match(source, new RegExp(`"${code}"`));
  }
});
