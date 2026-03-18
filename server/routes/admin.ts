/**
 * @file: admin.ts
 * @description: Admin API routes (/api/admin/*)
 * @dependencies: _common.ts, _openai.ts, server/storage.ts, @shared/routes, @shared/schema, drizzle-orm
 * @created: 2026-03-18
 */

import type { Express } from 'express';
import { z } from 'zod';
import { adminStorage, storage } from '../storage';
import { api } from '@shared/routes';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { adminAuth } from './_common';
import { normalizeWorkMessage } from './_openai';

export function registerAdminRoutes(app: Express): void {
  // GET /api/admin/users — список всех пользователей
  app.get('/api/admin/users', ...adminAuth, async (_req, res) => {
    try {
      const users = await adminStorage.listUsers();
      res.json(users);
    } catch (err) {
      console.error('[Admin] listUsers error:', err);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // POST /api/admin/users/:userId/block
  app.post('/api/admin/users/:userId/block', ...adminAuth, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      await adminStorage.blockUser(userId);
      res.json({ success: true });
    } catch (err) {
      console.error('[Admin] blockUser error:', err);
      res.status(500).json({ error: 'Failed to block user' });
    }
  });

  // POST /api/admin/users/:userId/unblock
  app.post('/api/admin/users/:userId/unblock', ...adminAuth, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      await adminStorage.unblockUser(userId);
      res.json({ success: true });
    } catch (err) {
      console.error('[Admin] unblockUser error:', err);
      res.status(500).json({ error: 'Failed to unblock user' });
    }
  });

  // POST /api/admin/users/:userId/make-admin
  app.post('/api/admin/users/:userId/make-admin', ...adminAuth, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
      await adminStorage.makeAdmin(userId, note);
      res.json({ success: true });
    } catch (err) {
      console.error('[Admin] makeAdmin error:', err);
      res.status(500).json({ error: 'Failed to make admin' });
    }
  });

  // DELETE /api/admin/users/:userId/admin
  app.delete('/api/admin/users/:userId/admin', ...adminAuth, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      await adminStorage.removeAdmin(userId);
      res.json({ success: true });
    } catch (err) {
      console.error('[Admin] removeAdmin error:', err);
      res.status(500).json({ error: 'Failed to remove admin' });
    }
  });

  // GET /api/admin/stats — системная статистика
  app.get('/api/admin/stats', ...adminAuth, async (_req, res) => {
    try {
      const stats = await adminStorage.getStats();
      res.json(stats);
    } catch (err) {
      console.error('[Admin] getStats error:', err);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // GET /api/admin/messages/failed — необработанные сообщения
  app.get('/api/admin/messages/failed', ...adminAuth, async (_req, res) => {
    try {
      const msgs = await adminStorage.getFailedMessages();
      res.json(msgs);
    } catch (err) {
      console.error('[Admin] getFailedMessages error:', err);
      res.status(500).json({ error: 'Failed to fetch failed messages' });
    }
  });

  // POST /api/admin/messages/:id/reprocess — повторная обработка сообщения
  app.post('/api/admin/messages/:id/reprocess', ...adminAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    try {
      const msg = await storage.getMessage(id);
      if (!msg) return res.status(404).json({ error: 'Message not found' });
      if (!msg.userId) return res.status(400).json({ error: 'Message has no associated user' });

      const adminObj = await storage.getCurrentObject(msg.userId);
      const normalized = await normalizeWorkMessage(msg.messageRaw, adminObj.id);
      await storage.updateMessageNormalized(id, normalized);
      const updated = await storage.getMessage(id);
      res.json(updated);
    } catch (err) {
      console.error('[Admin] reprocessMessage error:', err);
      res.status(500).json({ error: 'Failed to reprocess message' });
    }
  });

  // POST /api/admin/materials-catalog — создать материал каталога
  app.post('/api/admin/materials-catalog', ...adminAuth, async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      unit: z.string().optional(),
      gostTu: z.string().optional(),
      description: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const created = await adminStorage.createCatalogMaterial(parsed.data);
      res.status(201).json(created);
    } catch (err) {
      console.error('[Admin] createCatalogMaterial error:', err);
      res.status(500).json({ error: 'Failed to create material' });
    }
  });

  // PATCH /api/admin/materials-catalog/:id — обновить материал каталога
  app.patch('/api/admin/materials-catalog/:id', ...adminAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const schema = z.object({
      name: z.string().min(1).optional(),
      unit: z.string().optional(),
      gostTu: z.string().optional(),
      description: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const updated = await adminStorage.updateCatalogMaterial(id, parsed.data);
      if (!updated) return res.status(404).json({ error: 'Material not found' });
      res.json(updated);
    } catch (err) {
      console.error('[Admin] updateCatalogMaterial error:', err);
      res.status(500).json({ error: 'Failed to update material' });
    }
  });

  // DELETE /api/admin/materials-catalog/:id — удалить материал каталога
  app.delete('/api/admin/materials-catalog/:id', ...adminAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    try {
      const deleted = await adminStorage.deleteCatalogMaterial(id);
      if (!deleted) return res.status(404).json({ error: 'Material not found' });
      res.json({ success: true });
    } catch (err) {
      console.error('[Admin] deleteCatalogMaterial error:', err);
      res.status(500).json({ error: 'Failed to delete material' });
    }
  });

  // POST /api/admin/materials-catalog/import — массовый импорт материалов
  app.post('/api/admin/materials-catalog/import', ...adminAuth, async (req, res) => {
    const schema = api.materialsCatalog.import.input;
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Невалидные данные: ' + parsed.error.errors.map((e) => e.message).join(', '),
      });
    }
    try {
      const { mode, items } = parsed.data;
      const result = await storage.importMaterialsCatalog(items, mode);
      res.json({
        received: items.length,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
      });
    } catch (err) {
      console.error('[Admin] importMaterialsCatalog error:', err);
      res.status(500).json({
        message: 'Ошибка при импорте материалов: ' + (err instanceof Error ? err.message : String(err)),
      });
    }
  });

  // GET /api/admin/admins — список администраторов
  app.get('/api/admin/admins', ...adminAuth, async (_req, res) => {
    try {
      const admins = await adminStorage.listAdmins();
      res.json(admins);
    } catch (err) {
      console.error('[Admin] listAdmins error:', err);
      res.status(500).json({ error: 'Failed to fetch admins' });
    }
  });

  // PATCH /api/admin/users/:id/tariff — изменение тарифа пользователя
  app.patch('/api/admin/users/:id/tariff', ...adminAuth, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(400).json({ message: 'Invalid user id' });
      }

      const input = api.admin.changeTariff.input.parse(req.body);

      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (existingUser.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const updateData: Record<string, unknown> = { tariff: input.tariff };

      if (input.subscriptionEndsAt !== undefined) {
        updateData.subscriptionEndsAt = input.subscriptionEndsAt
          ? new Date(input.subscriptionEndsAt)
          : null;
      }

      await db.update(users).set(updateData).where(eq(users.id, userId));

      return res.status(200).json({ message: 'Tariff updated successfully' });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('[Admin] changeTariff error:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });
}
