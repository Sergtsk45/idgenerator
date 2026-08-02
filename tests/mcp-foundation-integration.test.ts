/**
 * @file: mcp-foundation-integration.test.ts
 * @description: Интеграционные тесты MCP-foundation поверх реального Streamable HTTP
 *   транспорта и Postgres. Требуют DATABASE_URL (см. .env.example) и применённые миграции;
 *   при их отсутствии тесты помечаются skip, не ломая `npm test` без БД.
 * @dependencies: node:test, express, server/mcp/httpTransport.ts, server/auth-service.ts, server/db.ts
 * @created: 2026-08-02
 */

import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const hasDatabase = Boolean(process.env.DATABASE_URL);

test("MCP foundation: handshake, auth enforcement, ownership isolation", { skip: !hasDatabase }, async (t) => {
  const { handleMcpRequest, mcpBodyErrorHandler, mcpBodyParser, mcpRateLimiter } = await import(
    "../server/mcp/httpTransport.ts"
  );
  const { authService } = await import("../server/auth-service.ts");
  const { db, pool } = await import("../server/db.ts");
  const { users, objects } = await import("../shared/schema.ts");
  const { eq } = await import("drizzle-orm");

  /**
   * Mirrors the exact production mounting order from server/index.ts: the MCP route
   * (with its own body parser/limit) comes before the app-wide 10mb REST parser, and
   * is only mounted when `mcpEnabled` — this is the wiring under test, not a stub.
   */
  function buildApp(mcpEnabled: boolean) {
    const restApp = express();
    if (mcpEnabled) {
      restApp.all("/mcp", mcpRateLimiter, mcpBodyParser, mcpBodyErrorHandler, handleMcpRequest);
    }
    restApp.use(express.json({ limit: "10mb" }));
    restApp.get("/api/_stub_healthcheck", (_req, res) => res.status(200).json({ ok: true }));
    restApp.post("/api/_stub_echo", (req, res) => res.status(200).json({ bytes: JSON.stringify(req.body).length }));
    return restApp;
  }

  async function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    return { server, baseUrl: `http://127.0.0.1:${port}` };
  }

  const { server: httpServer, baseUrl } = await listen(buildApp(true));
  const mcpUrl = `${baseUrl}/mcp`;

  const suffix = Date.now();
  const [userA] = await db
    .insert(users)
    .values({ displayName: "MCP Test A", email: `mcp-test-a-${suffix}@example.com`, role: "user", isBlocked: false })
    .returning();
  const [userB] = await db
    .insert(users)
    .values({ displayName: "MCP Test B", email: `mcp-test-b-${suffix}@example.com`, role: "user", isBlocked: false })
    .returning();
  const [blockedUser] = await db
    .insert(users)
    .values({ displayName: "MCP Test Blocked", email: `mcp-test-blocked-${suffix}@example.com`, role: "user", isBlocked: true })
    .returning();

  const [objectOfA] = await db
    .insert(objects)
    .values({ title: `Object of A ${suffix}`, userId: userA.id })
    .returning();

  t.after(async () => {
    await db.delete(objects).where(eq(objects.id, objectOfA.id));
    await db.delete(users).where(eq(users.id, userA.id));
    await db.delete(users).where(eq(users.id, userB.id));
    await db.delete(users).where(eq(users.id, blockedUser.id));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await pool.end();
  });

  const tokenA = await authService.generateJWT(userA.id, userA.role);
  const tokenB = await authService.generateJWT(userB.id, userB.role);
  const tokenBlocked = await authService.generateJWT(blockedUser.id, blockedUser.role);

  async function callMcp(url: string, body: unknown, rawAuthorizationHeader?: string) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    };
    if (rawAuthorizationHeader !== undefined) headers.authorization = rawAuthorizationHeader;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, message: parseJsonRpcResponse(text) };
  }

  const ping = (bearer?: string) =>
    callMcp(mcpUrl, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "ping", arguments: {} } }, bearer && `Bearer ${bearer}`);

  await t.test("initialize handshake succeeds without authentication", async () => {
    const { status, message } = await callMcp(mcpUrl, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    });
    assert.equal(status, 200);
    assert.equal(message.result.serverInfo.name, "idgenerator-mcp");
  });

  await t.test("unauthenticated tool call (no header) is rejected with AUTH_REQUIRED and no data", async () => {
    const { message } = await ping();
    assert.equal(message.result.isError, true);
    const payload = JSON.parse(message.result.content[0].text);
    assert.equal(payload.code, "AUTH_REQUIRED");
  });

  await t.test("empty Bearer value (no token) is treated as missing, not invalid", async () => {
    const { message } = await callMcp(
      mcpUrl,
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "ping", arguments: {} } },
      "Bearer ",
    );
    const payload = JSON.parse(message.result.content[0].text);
    assert.equal(payload.code, "AUTH_REQUIRED");
  });

  await t.test("malformed JWT is rejected with AUTH_INVALID", async () => {
    const { message } = await ping("this-is-not-a-jwt");
    const payload = JSON.parse(message.result.content[0].text);
    assert.equal(payload.code, "AUTH_INVALID");
  });

  await t.test("expired JWT is rejected with AUTH_INVALID", async () => {
    const previousTtl = process.env.JWT_EXPIRES_IN;
    process.env.JWT_EXPIRES_IN = "1s";
    const expiredToken = await authService.generateJWT(userA.id, userA.role);
    process.env.JWT_EXPIRES_IN = previousTtl;

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const { message } = await ping(expiredToken);
    const payload = JSON.parse(message.result.content[0].text);
    assert.equal(payload.code, "AUTH_INVALID");
  });

  await t.test("blocked user's valid JWT is rejected with AUTH_INVALID", async () => {
    const { message } = await ping(tokenBlocked);
    const payload = JSON.parse(message.result.content[0].text);
    assert.equal(payload.code, "AUTH_INVALID");
  });

  await t.test("authenticated ping succeeds and identifies the caller", async () => {
    const { message } = await ping(tokenA);
    const payload = JSON.parse(message.result.content[0].text);
    assert.equal(payload.pong, true);
    assert.equal(payload.userId, userA.id);
  });

  await t.test("get_current_user returns the caller's own profile", async () => {
    const { message } = await callMcp(
      mcpUrl,
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_current_user", arguments: {} } },
      `Bearer ${tokenA}`,
    );
    const payload = JSON.parse(message.result.content[0].text);
    assert.equal(payload.id, userA.id);
    assert.equal(payload.displayName, userA.displayName);
    assert.equal(payload.email, userA.email);
    assert.equal(payload.role, userA.role);
  });

  await t.test("list_objects returns only the caller's own objects (user A sees theirs)", async () => {
    const { message } = await callMcp(
      mcpUrl,
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "list_objects", arguments: {} } },
      `Bearer ${tokenA}`,
    );
    const payload = JSON.parse(message.result.content[0].text);
    assert.ok(payload.objects.some((o: any) => o.id === objectOfA.id));
  });

  await t.test("list_objects never leaks user A's object to user B (ownership isolation)", async () => {
    const { message } = await callMcp(
      mcpUrl,
      { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "list_objects", arguments: {} } },
      `Bearer ${tokenB}`,
    );
    const payload = JSON.parse(message.result.content[0].text);
    assert.ok(!payload.objects.some((o: any) => o.id === objectOfA.id));
  });

  await t.test("body over 256KB is rejected with 413 before reaching any tool", async () => {
    const oversizedArgs = { pad: "x".repeat(300 * 1024) };
    const res = await fetch(mcpUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "ping", arguments: oversizedArgs } }),
    });
    assert.equal(res.status, 413);
    const payload = await res.json();
    assert.equal(payload.code, "PAYLOAD_TOO_LARGE");
  });

  await t.test("an unexpected DB error surfaces INTERNAL_ERROR without leaking details", async () => {
    // A JWT with a userId that overflows Postgres's integer column triggers a real,
    // unhandled DB exception in resolveMcpAuthContext (not a normal "not found" path).
    const tokenCausingDbError = await authService.generateJWT(99999999999, "user");
    const res = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${tokenCausingDbError}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "ping", arguments: {} } }),
    });
    assert.equal(res.status, 500);
    const text = await res.text();
    const payload = JSON.parse(text);
    assert.equal(payload.code, "INTERNAL_ERROR");
    assert.equal(payload.message, "Internal error");
    assert.doesNotMatch(text, /out of range|postgres|relation|column|constraint/i);
  });

  await t.test("REST keeps working normally alongside a mounted /mcp route", async () => {
    const res = await fetch(`${baseUrl}/api/_stub_healthcheck`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  await t.test("REST's own (looser) body limit is unaffected by MCP's tighter limit", async () => {
    const bigButUnderRestLimit = "x".repeat(300 * 1024); // over MCP's 256KB, well under REST's 10MB
    const res = await fetch(`${baseUrl}/api/_stub_echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pad: bigButUnderRestLimit }),
    });
    assert.equal(res.status, 200);
  });

  await t.test("MCP_ENABLED=false disables /mcp without affecting REST", async () => {
    const { server: disabledServer, baseUrl: disabledBaseUrl } = await listen(buildApp(false));
    try {
      const mcpRes = await fetch(`${disabledBaseUrl}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
      });
      assert.equal(mcpRes.status, 404);

      const restRes = await fetch(`${disabledBaseUrl}/api/_stub_healthcheck`);
      assert.equal(restRes.status, 200);
    } finally {
      await new Promise<void>((resolve) => disabledServer.close(() => resolve()));
    }
  });
});

/** Parses either a plain JSON body or a single-event SSE body into the JSON-RPC message. */
function parseJsonRpcResponse(text: string): any {
  const dataLine = text
    .split("\n")
    .find((line) => line.startsWith("data: "));
  return JSON.parse(dataLine ? dataLine.slice("data: ".length) : text);
}
