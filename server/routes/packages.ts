import type { Express } from "express";

import { MCP_ERROR_CODES, McpToolError } from "../mcp/errors";
import { getOwnedExecutionPackageFile } from "../services/executionPackageService";
import { appAuth } from "./_common";

export function registerPackageRoutes(app: Express): void {
  app.get("/api/execution-packages/:packageId/file", ...appAuth, async (req, res) => {
    try {
      const { package: row, buffer } = await getOwnedExecutionPackageFile(
        { userId: req.user!.id, displayName: req.user!.displayName, email: req.user!.email, role: req.user!.role },
        String(req.params.packageId),
      );
      res.type("application/zip");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`);
      return res.send(buffer);
    } catch (error) {
      if (error instanceof McpToolError && error.code === MCP_ERROR_CODES.PACKAGE_NOT_OWNED) {
        return res.status(404).json({ code: error.code, message: error.message });
      }
      if (error instanceof McpToolError && error.code === MCP_ERROR_CODES.PACKAGE_FILE_UNAVAILABLE) {
        return res.status(409).json({ code: error.code, message: error.message });
      }
      console.error("Execution package download failed:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });
}
