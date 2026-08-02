/**
 * @file: createMcpServer.ts
 * @description: Фабрика MCP server. Один экземпляр создаётся на HTTP-запрос (stateless mode),
 *   привязывается к проверенному auth context и регистрирует доступные tools.
 * @dependencies: @modelcontextprotocol/sdk, server/mcp/authContext.ts, server/mcp/tools/*
 * @created: 2026-08-02
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpAuthContext } from './authContext';
import { registerDiagnosticTools } from './tools/diagnostics';

export function createMcpServer(auth: McpAuthContext): McpServer {
  const server = new McpServer(
    { name: 'idgenerator-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  registerDiagnosticTools(server, auth);

  return server;
}
