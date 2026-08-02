/**
 * @file: createMcpServer.ts
 * @description: Фабрика MCP server. Создаётся заново на каждый HTTP-запрос (stateless
 *   Streamable HTTP), поэтому auth context безопасно захватывается замыканием
 *   и никогда не переживает запрос.
 * @dependencies: @modelcontextprotocol/sdk, server/mcp/tools/diagnostics.ts, server/mcp/tools/workflow.ts
 * @created: 2026-08-02
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpAuthResolution } from "./authContext";
import { registerDiagnosticTools } from "./tools/diagnostics";
import { registerWorkflowTools } from "./tools/workflow";
import { registerUploadTools } from "./tools/uploads";
import { registerEstimateAnalysisTools } from "./tools/estimateAnalysis";
import { registerSchedulePlanningTools } from "./tools/schedulePlanning";
import { registerMaterialRegisterTools } from "./tools/materialRegister";
import { registerDocumentIngestionTools } from "./tools/documentIngestion";

const SERVER_NAME = "idgenerator-mcp";
const SERVER_VERSION = "0.2.0";

export function createMcpServer(authResolution: McpAuthResolution): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  registerDiagnosticTools(server, authResolution);
  registerWorkflowTools(server, authResolution);
  registerUploadTools(server, authResolution);
  registerEstimateAnalysisTools(server, authResolution);
  registerSchedulePlanningTools(server, authResolution);
  registerMaterialRegisterTools(server, authResolution);
  registerDocumentIngestionTools(server, authResolution);

  return server;
}
