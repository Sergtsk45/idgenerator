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
import type { AddressInfo } from "node:net";

const hasDatabase = Boolean(process.env.DATABASE_URL);

test("MCP foundation: handshake, auth enforcement, ownership isolation", { skip: !hasDatabase }, async (t) => {
  const { handleMcpRequest, mcpRateLimiter } = await import("../server/mcp/httpTransport.ts");
  const { authService } = await import("../server/auth-service.ts");
  const { db, pool } = await import("../server/db.ts");
  const { users, objects } = await import("../shared/schema.ts");
  const { eq } = await import("drizzle-orm");

  const app = express();
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.all("/mcp", mcpRateLimiter, handleMcpRequest);

  const httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}/mcp`;

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

  async function callMcp(body: unknown, bearer?: string) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    };
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    const res = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, message: parseJsonRpcResponse(text) };
  }

  await t.test("initialize handshake succeeds without authentication", async () => {
    const { status, message } = await callMcp({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    });
    assert.equal(status, 200);
    assert.equal(message.result.serverInfo.name, "idgenerator-mcp");
  });

  await t.test("unauthenticated tool call is rejected with AUTH_REQUIRED and no data", async () => {
    const { message } = await callMcp({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "ping", arguments: {} },
    });
    assert.equal(message.result.isError, true);
    const payload = JSON.parse(message.result.content[0].text);
    assert.equal(payload.code, "AUTH_REQUIRED");
  });

  await t.test("blocked user's valid JWT is rejected with AUTH_INVALID", async () => {
    const { message } = await callMcp(
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "ping", arguments: {} } },
      tokenBlocked,
    );
    const payload = JSON.parse(message.result.content[0].text);
    assert.equal(payload.code, "AUTH_INVALID");
  });

  await t.test("authenticated ping succeeds and identifies the caller", async () => {
    const { message } = await callMcp(
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "ping", arguments: {} } },
      tokenA,
    );
    const payload = JSON.parse(message.result.content[0].text);
    assert.equal(payload.pong, true);
    assert.equal(payload.userId, userA.id);
  });

  await t.test("list_objects returns only the caller's own objects (user A sees theirs)", async () => {
    const { message } = await callMcp(
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "list_objects", arguments: {} } },
      tokenA,
    );
    const payload = JSON.parse(message.result.content[0].text);
    assert.ok(payload.objects.some((o: any) => o.id === objectOfA.id));
  });

  await t.test("list_objects never leaks user A's object to user B (ownership isolation)", async () => {
    const { message } = await callMcp(
      { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "list_objects", arguments: {} } },
      tokenB,
    );
    const payload = JSON.parse(message.result.content[0].text);
    assert.ok(!payload.objects.some((o: any) => o.id === objectOfA.id));
  });
});

/** Parses either a plain JSON body or a single-event SSE body into the JSON-RPC message. */
function parseJsonRpcResponse(text: string): any {
  const dataLine = text
    .split("\n")
    .find((line) => line.startsWith("data: "));
  return JSON.parse(dataLine ? dataLine.slice("data: ".length) : text);
}
