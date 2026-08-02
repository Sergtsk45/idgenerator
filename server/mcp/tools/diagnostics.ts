/**
 * @file: diagnostics.ts
 * @description: Базовые read-only diagnostic MCP tools (ping, get_current_user, list_objects)
 * @dependencies: @modelcontextprotocol/sdk, server/storage.ts, server/mcp/toolResult.ts
 * @created: 2026-08-02
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { storage } from '../../storage';
import type { McpAuthContext } from '../authContext';
import { toolSuccess, withToolLogging } from '../toolResult';

export function registerDiagnosticTools(server: McpServer, auth: McpAuthContext): void {
  server.registerTool(
    'ping',
    {
      description: 'Health-check tool. Returns server time and the authenticated user id.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    withToolLogging('ping', auth.userId, async () =>
      toolSuccess({ ok: true, userId: auth.userId, serverTime: new Date().toISOString() }),
    ),
  );

  server.registerTool(
    'get_current_user',
    {
      description: 'Returns the profile of the authenticated user (no secrets).',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    withToolLogging('get_current_user', auth.userId, async () =>
      toolSuccess({
        id: auth.userId,
        displayName: auth.displayName,
        email: auth.email,
        role: auth.role,
        tariff: auth.tariff,
      }),
    ),
  );

  server.registerTool(
    'list_objects',
    {
      description: 'Lists construction objects owned by the authenticated user.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    withToolLogging('list_objects', auth.userId, async () => {
      const objects = await storage.listUserObjects(auth.userId);
      return toolSuccess({
        objects: objects.map((o) => ({
          id: o.id,
          title: o.title,
          address: o.address,
          city: o.city,
          createdAt: o.createdAt,
        })),
      });
    }),
  );
}
