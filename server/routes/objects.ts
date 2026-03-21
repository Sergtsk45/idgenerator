/**
 * @file: objects.ts
 * @description: Object (single/multi), source-data, CRUD and select routes
 * @dependencies: _common.ts, @shared/routes, @shared/tariff-features, server/db, drizzle-orm
 * @created: 2026-03-21
 */

import type { Express } from 'express';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { api } from '@shared/routes';
import { getQuota } from '@shared/tariff-features';
import { storage, appAuth } from './_common';
import { db } from '../db';
import { objects } from '@shared/schema';

export function registerObjectRoutes(app: Express): void {

  // ── Single current object ──────────────────────────────────────────────────

  app.get(api.object.current.path, ...appAuth, async (req, res) => {
    const objectCount = await storage.countUserObjects(req.user!.id);
    const objectLimit = getQuota(req.user!.tariff, 'objects');
    if (objectCount === 0 && objectLimit < 1) {
      return res.status(403).json({
        error: 'QUOTA_EXCEEDED',
        message: 'Ваш тариф не позволяет создавать объекты',
        quotaType: 'objects',
        limit: objectLimit,
        used: objectCount,
        currentTariff: req.user!.tariff,
      });
    }
    const obj = await storage.getCurrentObject(req.user!.id);
    return res.status(200).json(obj);
  });

  app.patch(api.object.patchCurrent.path, ...appAuth, async (req, res) => {
    try {
      const patch = api.object.patchCurrent.input.parse(req.body);
      const obj = await storage.getCurrentObject(req.user!.id);
      const updated = await storage.updateObject(obj.id, patch);
      return res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Object patch failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.object.getSourceData.path, ...appAuth, async (req, res) => {
    try {
      const obj = await storage.getCurrentObject(req.user!.id);
      const data = await storage.getObjectSourceData(obj.id);
      return res.status(200).json(data);
    } catch (err) {
      if (err instanceof Error && err.message === "OBJECT_NOT_FOUND") {
        return res.status(404).json({ message: "Object not found" });
      }
      console.error("Get source-data failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.object.putSourceData.path, ...appAuth, async (req, res) => {
    try {
      const input = api.object.putSourceData.input.parse(req.body);
      const obj = await storage.getCurrentObject(req.user!.id);
      const saved = await storage.saveObjectSourceData(obj.id, input);
      return res.status(200).json(saved);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err instanceof Error && err.message === "OBJECT_NOT_FOUND") {
        return res.status(404).json({ message: "Object not found" });
      }
      console.error("Put source-data failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ── Multi-object management ────────────────────────────────────────────────

  app.get(api.objects.list.path, ...appAuth, async (req, res) => {
    try {
      const list = await storage.listUserObjects(req.user!.id);
      return res.status(200).json(list);
    } catch (err) {
      console.error("Objects list failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.objects.create.path, ...appAuth, async (req, res) => {
    try {
      const input = api.objects.create.input.parse(req.body);
      const created = await storage.createObject(req.user!.id, input);
      return res.status(200).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err instanceof Error && (err as any).code === "QUOTA_EXCEEDED") {
        return res.status(403).json({
          error: "QUOTA_EXCEEDED",
          message: "Превышена квота на количество объектов для вашего тарифа",
        });
      }
      console.error("Object create failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.objects.getById.path, ...appAuth, async (req, res) => {
    const objectId = Number(req.params.objectId);
    if (!Number.isFinite(objectId) || objectId <= 0) {
      return res.status(400).json({ message: "Invalid objectId" });
    }
    try {
      const obj = await storage.getObject(objectId);
      if (!obj || obj.userId !== req.user!.id) {
        return res.status(404).json({ message: "Object not found" });
      }
      return res.status(200).json(obj);
    } catch (err) {
      console.error("Object getById failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch(api.objects.update.path, ...appAuth, async (req, res) => {
    const objectId = Number(req.params.objectId);
    if (!Number.isFinite(objectId) || objectId <= 0) {
      return res.status(400).json({ message: "Invalid objectId" });
    }
    try {
      const patch = api.objects.update.input.parse(req.body);
      const obj = await storage.getObject(objectId);
      if (!obj || obj.userId !== req.user!.id) {
        return res.status(404).json({ message: "Object not found" });
      }
      const updated = await storage.updateObject(objectId, patch as any);
      return res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Object update failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete(api.objects.delete.path, ...appAuth, async (req, res) => {
    const objectId = Number(req.params.objectId);
    if (!Number.isFinite(objectId) || objectId <= 0) {
      return res.status(400).json({ message: "Invalid objectId" });
    }
    try {
      await storage.deleteObject(objectId, req.user!.id);
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "OBJECT_NOT_FOUND") {
          return res.status(404).json({ message: "Object not found" });
        }
        if ((err as any).code === "LAST_OBJECT") {
          return res.status(400).json({ message: "Нельзя удалить единственный объект" });
        }
      }
      console.error("Object delete failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.objects.select.path, ...appAuth, async (req, res) => {
    const objectId = Number(req.params.objectId);
    if (!Number.isFinite(objectId) || objectId <= 0) {
      return res.status(400).json({ message: "Invalid objectId" });
    }
    try {
      await storage.selectCurrentObject(req.user!.id, objectId);
      const obj = await storage.getObject(objectId);
      return res.status(200).json(obj);
    } catch (err) {
      if (err instanceof Error && err.message === "OBJECT_NOT_FOUND") {
        return res.status(404).json({ message: "Object not found" });
      }
      console.error("Object select failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });
}

// ── Quota helper (used by tariff routes) ──────────────────────────────────────

/**
 * Count objects and invoice imports for the current user.
 * Exported for reuse in the tariff route module.
 */
export async function getUserQuotaUsage(userId: number): Promise<{
  objectsCount: number;
  invoiceImportsUsed: number;
}> {
  const rows = await db
    .select({ count: sql`count(*)::int` })
    .from(objects)
    .where(eq(objects.userId, userId));
  const objectsCount = Number(rows[0]?.count || 0);
  const invoiceImportsUsed = await storage.countMonthlyInvoiceImports(userId);
  return { objectsCount, invoiceImportsUsed };
}
