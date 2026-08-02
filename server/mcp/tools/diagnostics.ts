/**
 * @file: diagnostics.ts
 * @description: Read-only diagnostic MCP tools: ping, get_current_user, list_objects.
 *   Не изменяют бизнес-данные (TASK-001 non-goal).
 * @dependencies: @modelcontextprotocol/sdk, server/mcp/authContext.ts, server/storage.ts
 * @created: 2026-08-02
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { requireAuth, type McpAuthResolution } from "../authContext";
import { toolError, toolSuccess } from "../toolResult";
import { storage } from "../../storage";

/**
 * Registers diagnostic tools on a per-request McpServer instance.
 * `authResolution` is resolved once per HTTP request (stateless transport) and captured
 * here by closure; it must never be trusted from tool arguments.
 */
export function registerDiagnosticTools(server: McpServer, authResolution: McpAuthResolution): void {
  server.registerTool(
    "ping",
    {
      title: "Ping",
      description: "Health check for the authenticated MCP session.",
      inputSchema: {},
    },
    async () => {
      try {
        const authContext = requireAuth(authResolution);
        return toolSuccess({ pong: true, userId: authContext.userId });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "get_current_user",
    {
      title: "Get current user",
      description: "Returns the profile of the user identified by the request's Bearer JWT.",
      inputSchema: {},
    },
    async () => {
      try {
        const authContext = requireAuth(authResolution);
        return toolSuccess({
          id: authContext.userId,
          displayName: authContext.displayName,
          email: authContext.email,
          role: authContext.role,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "list_objects",
    {
      title: "List objects",
      description: "Lists objects owned by the authenticated user. Never returns other users' data.",
      inputSchema: {},
    },
    async () => {
      try {
        const authContext = requireAuth(authResolution);
        const list = await storage.listUserObjects(authContext.userId);
        return toolSuccess({ objects: list });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
