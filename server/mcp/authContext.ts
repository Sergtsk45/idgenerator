/**
 * @file: authContext.ts
 * @description: Резолвинг MCP auth context строго из Authorization: Bearer <jwt>.
 *   Не поддерживает Telegram init-data и dev browser-token: это transport-специфичное
 *   поведение REST UI, а не контракт MCP-агента.
 * @dependencies: server/auth-service.ts, server/db.ts, shared/schema.ts
 * @created: 2026-08-02
 */

import { authService } from "../auth-service";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface McpAuthContext {
  userId: number;
  displayName: string;
  email: string | null;
  role: string;
}

export type McpAuthResolution =
  | { status: "ok"; context: McpAuthContext }
  | { status: "missing" }
  | { status: "invalid" };

/**
 * Extracts and verifies the caller identity for one MCP HTTP request.
 * Distinguishes "no credentials supplied" (missing) from "credentials supplied but
 * rejected" (invalid: bad/expired JWT, unknown user, or blocked account) so tool
 * handlers can surface the correct AUTH_REQUIRED vs AUTH_INVALID error code.
 */
export async function resolveMcpAuthContext(
  authorizationHeader: string | undefined,
): Promise<McpAuthResolution> {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return { status: "missing" };
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { status: "missing" };
  }

  const payload = await authService.verifyJWT(token);
  if (!payload) {
    return { status: "invalid" };
  }

  const rows = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  const user = rows[0];
  if (!user || user.isBlocked) {
    return { status: "invalid" };
  }

  return {
    status: "ok",
    context: {
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
    },
  };
}
