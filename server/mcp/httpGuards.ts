import type { NextFunction, Request, Response } from "express";

const DEFAULT_ALLOWED_MCP_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const ALLOWED_MCP_ORIGINS = new Set(
  (process.env.MCP_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const ALLOWED_MCP_HOSTNAMES = new Set(
  (process.env.MCP_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
);

export function validateMcpRequestHostOrigin(req: Request, res: Response, next: NextFunction): void {
  const hostHeader = req.get("host");
  const originHeader = req.get("origin");
  const refererHeader = req.get("referer");

  if (!hostHeader) {
    res.status(403).json({ code: "FORBIDDEN", message: "MCP host header is required" });
    return;
  }

  const hostUrl = parseHostHeader(hostHeader);
  if (!hostUrl || !isAllowedHost(hostUrl.hostname)) {
    res.status(403).json({ code: "FORBIDDEN", message: "MCP host is not allowed" });
    return;
  }

  const requestOrigin = originHeader ?? refererHeader;
  if (requestOrigin) {
    let originUrl: URL;
    try {
      originUrl = new URL(requestOrigin);
    } catch {
      res.status(403).json({ code: "FORBIDDEN", message: "MCP origin is not allowed" });
      return;
    }

    const sameOrigin =
      originUrl.hostname === hostUrl.hostname &&
      normalizePort(originUrl.port, originUrl.protocol) === normalizePort(hostUrl.port, hostUrl.protocol);
    const loopbackAllowed = isAllowedHost(originUrl.hostname) && isAllowedHost(hostUrl.hostname);
    if (!sameOrigin && !loopbackAllowed && !ALLOWED_MCP_ORIGINS.has(originUrl.origin)) {
      res.status(403).json({ code: "FORBIDDEN", message: "MCP origin is not allowed" });
      return;
    }
  }

  next();
}

function parseHostHeader(hostHeader: string): URL | null {
  try {
    return new URL(`http://${hostHeader}`);
  } catch {
    return null;
  }
}

function normalizePort(port: string, protocol: string): string {
  if (port) return port;
  return protocol === "https:" ? "443" : "80";
}

function isAllowedHost(hostname: string): boolean {
  return DEFAULT_ALLOWED_MCP_HOSTNAMES.has(hostname) || ALLOWED_MCP_HOSTNAMES.has(hostname);
}
