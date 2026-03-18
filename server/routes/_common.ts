/**
 * @file: _common.ts
 * @description: Shared helpers, middleware chains and types for route modules
 * @dependencies: server/storage.ts, server/middleware/auth.ts, server/middleware/adminAuth.ts, server/middleware/objectAccess.ts
 * @created: 2026-03-18
 */

import type { Request, Response } from 'express';
import { storage } from '../storage';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';
import { resolveCurrentObject } from '../middleware/objectAccess';

// ── Re-exports ─────────────────────────────────────────────────────────────

export { storage };
export { resolveCurrentObject };

// ── Auth middleware chains ──────────────────────────────────────────────────

/** Standard authenticated route: requires valid user session */
export const appAuth = [authMiddleware({ required: true })] as const;

/** Admin-only route: requires valid session + admin role */
export const adminAuth = [authMiddleware({ required: true }), requireAdmin] as const;

// ── Types ───────────────────────────────────────────────────────────────────

/** Request guaranteed to have an authenticated user (use after appAuth / adminAuth) */
export type AuthenticatedRequest = Request & {
  user: NonNullable<Request['user']>;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract a positive integer objectId from:
 *   1. req.params.objectId
 *   2. req.body.objectId
 *   3. req.currentObjectId (resolved by resolveCurrentObject middleware)
 *
 * Returns null when no valid id is found.
 */
export function getObjectId(req: Request): number | null {
  const raw = req.params.objectId ?? req.body?.objectId ?? req.currentObjectId;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Uniform error handler for route catch blocks.
 *
 * Logs the error and responds with 500. Pass a custom fallbackMessage when
 * the default "Internal Server Error" is not descriptive enough for the caller.
 */
export function handleError(
  res: Response,
  err: unknown,
  fallbackMessage = 'Internal Server Error',
): void {
  console.error('[route error]', err);
  res.status(500).json({ message: fallbackMessage });
}
