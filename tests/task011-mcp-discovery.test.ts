import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const hasDatabase = Boolean(process.env.DATABASE_URL);

async function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function callMcp(url: string, body: unknown, authorization: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

function parseJsonRpcPayload(text: string) {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
  return JSON.parse(jsonText);
}

test("TASK-011 MCP discovery exposes prompts and workflow resources end to end", { skip: !hasDatabase }, async (t) => {
  const { handleMcpRequest, mcpBodyErrorHandler, mcpBodyParser, mcpRateLimiter } = await import("../server/mcp/httpTransport.ts");
  const { authService } = await import("../server/auth-service.ts");
  const { db, pool } = await import("../server/db.ts");
  const { users, objects, executionWorkflows } = await import("../shared/schema.ts");
  const { eq } = await import("drizzle-orm");

  const [owner] = await db
    .insert(users)
    .values({ displayName: "TASK-011 owner", email: `task011-owner-${Date.now()}@test.local` })
    .returning();
  const [object] = await db
    .insert(objects)
    .values({ title: `TASK-011 object ${Date.now()}`, userId: owner.id })
    .returning();
  const [workflow] = await db
    .insert(executionWorkflows)
    .values({
      userId: owner.id,
      objectId: object.id,
      stage: "created",
      status: "active",
      version: 1,
    })
    .returning();

  const app = express();
  app.all("/mcp", mcpRateLimiter, mcpBodyParser, mcpBodyErrorHandler, handleMcpRequest);
  const { server, baseUrl } = await listen(app);
  const mcpUrl = `${baseUrl}/mcp`;
  const token = await authService.generateJWT(owner.id, owner.role);

  t.after(async () => {
    await db.delete(executionWorkflows).where(eq(executionWorkflows.id, workflow.id));
    await db.delete(objects).where(eq(objects.id, object.id));
    await db.delete(users).where(eq(users.id, owner.id));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  });

  const promptList = parseJsonRpcPayload(
    (await callMcp(
      mcpUrl,
      { jsonrpc: "2.0", id: 1, method: "prompts/list", params: {} },
      `Bearer ${token}`,
    )).body,
  );
  assert.ok(promptList.result.prompts.some((prompt: { name: string }) => prompt.name === "execution_documentation_workflow"));

  const resourceList = parseJsonRpcPayload(
    (await callMcp(
      mcpUrl,
      { jsonrpc: "2.0", id: 2, method: "resources/list", params: {} },
      `Bearer ${token}`,
    )).body,
  );
  const uris = resourceList.result.resources.map((resource: { uri: string }) => resource.uri);
  for (const suffix of ["status", "schedule-draft", "material-readiness", "acts-readiness"]) {
    assert.ok(uris.includes(`idgenerator://workflow/${workflow.id}/${suffix}`), `missing ${suffix} resource`);
  }

  const prompt = parseJsonRpcPayload(
    (await callMcp(
      mcpUrl,
      {
        jsonrpc: "2.0",
        id: 3,
        method: "prompts/get",
        params: { name: "execution_documentation_workflow", arguments: { workflowId: workflow.id } },
      },
      `Bearer ${token}`,
    )).body,
  );
  const promptText = prompt.result.messages.map((message: { content: { text: string } }) => message.content.text).join("\n");
  assert.match(promptText, /Ask only about missingInputs/);
  assert.match(promptText, /Do not invent facts/);
  assert.match(promptText, /Continue from the current stage/);
  assert.match(promptText, new RegExp(`"workflowId":\\s*${workflow.id}`));

  const status = parseJsonRpcPayload(
    (await callMcp(
      mcpUrl,
      {
        jsonrpc: "2.0",
        id: 4,
        method: "resources/read",
        params: { uri: `idgenerator://workflow/${workflow.id}/status` },
      },
      `Bearer ${token}`,
    )).body,
  );
  const statusPayload = JSON.parse(status.result.contents[0].text);
  assert.equal(statusPayload.kind, "status");
  assert.equal(statusPayload.workflowId, workflow.id);
  assert.equal(statusPayload.content.stage, "created");

  const scheduleDraft = parseJsonRpcPayload(
    (await callMcp(
      mcpUrl,
      {
        jsonrpc: "2.0",
        id: 5,
        method: "resources/read",
        params: { uri: `idgenerator://workflow/${workflow.id}/schedule-draft` },
      },
      `Bearer ${token}`,
    )).body,
  );
  const schedulePayload = JSON.parse(scheduleDraft.result.contents[0].text);
  assert.equal(schedulePayload.kind, "schedule-draft");
  assert.equal(schedulePayload.workflow.workflowId, workflow.id);
  assert.equal(schedulePayload.draft, null);
});
