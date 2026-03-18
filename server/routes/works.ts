/**
 * @file: works.ts
 * @description: Works (BoQ) and work collections API routes
 * @dependencies: _common.ts, @shared/routes
 * @created: 2026-03-18
 */

import type { Express } from 'express';
import { z } from 'zod';
import { api } from '@shared/routes';
import { storage, appAuth } from './_common';

export function registerWorksRoutes(app: Express): void {
  // GET /api/works — список работ текущего объекта
  app.get(api.works.list.path, ...appAuth, async (req, res) => {
    const obj = await storage.getCurrentObject(req.user!.id);
    const works = await storage.getWorks(obj.id);
    res.json(works);
  });

  // POST /api/works/import — безопасный импорт работ (merge по умолчанию)
  app.post(api.works.import.path, async (req, res) => {
    try {
      const input = api.works.import.input.parse(req.body);
      const mode = input.mode ?? 'merge';

      const map = new Map<string, (typeof input.items)[number]>();
      for (const item of input.items) {
        const code = String(item.code || '').trim();
        if (!code) continue;
        map.set(code, { ...item, code });
      }

      const items = Array.from(map.values());
      const result = await storage.importWorks(items, mode);

      return res.status(200).json({
        mode,
        received: input.items.length,
        created: result.created,
        updated: result.updated,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Works import failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // DELETE /api/works — полная очистка ВОР (только dev или с resetSchedule)
  app.delete('/api/works', async (req, res) => {
    const resetScheduleRaw = (req.query as any)?.resetSchedule;
    const resetSchedule = resetScheduleRaw === '1' || resetScheduleRaw === 'true';

    // Safety: блокируем деструктивную очистку в prod без явного подтверждения
    if (process.env.NODE_ENV === 'production' && !resetSchedule) {
      return res.status(404).json({ message: 'Not found' });
    }

    try {
      console.log('Clearing all works from database...');
      await storage.clearWorks({ resetScheduleIfInUse: resetSchedule });
      await storage.clearMessages(req.user!.id);
      console.log('Works and messages cleared successfully');
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === 'WORKS_IN_USE_BY_SCHEDULE') {
        return res.status(409).json({
          message:
            'Нельзя очистить ВОР: он используется как источник графика работ. Подтвердите очистку со сбросом графика/актов.',
        });
      }
      console.error('Error clearing works:', err);
      return res.status(500).json({ message: 'Failed to clear works' });
    }
  });

  // POST /api/works — создать одну работу
  app.post(api.works.create.path, async (req, res) => {
    try {
      const input = api.works.create.input.parse(req.body);
      const work = await storage.createWork(input);
      res.status(201).json(work);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // ── Work Collections (Коллекции ВОР) ──────────────────────────────────────

  // GET /api/work-collections — список коллекций текущего объекта
  app.get(api.workCollections.list.path, ...appAuth, async (req, res) => {
    const obj = await storage.getCurrentObject(req.user!.id);
    const list = await storage.getWorkCollections(obj.id);
    return res.status(200).json(list);
  });

  // GET /api/work-collections/:id — коллекция с деталями
  app.get(api.workCollections.get.path, ...appAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const obj = await storage.getCurrentObject(req.user!.id);
    const data = await storage.getWorkCollectionWithDetails(id);
    if (!data) {
      return res.status(404).json({ message: 'Not found' });
    }
    if (data.collection.objectId !== obj.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.status(200).json(data);
  });

  // POST /api/work-collections/import — импорт коллекции
  app.post(api.workCollections.import.path, ...appAuth, async (req, res) => {
    try {
      const input = api.workCollections.import.input.parse(req.body);
      const obj = await storage.getCurrentObject(req.user!.id);
      const result = await storage.importWorkCollection(input as any, obj.id);
      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Work collection import failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // DELETE /api/work-collections/:id — удалить коллекцию
  app.delete(api.workCollections.delete.path, ...appAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const resetScheduleRaw = (req.query as any)?.resetSchedule;
    const resetSchedule = resetScheduleRaw === '1' || resetScheduleRaw === 'true';

    try {
      const ok = await storage.deleteWorkCollection(id, { resetScheduleIfInUse: resetSchedule });
      if (!ok) return res.status(404).json({ message: 'Not found' });
      await storage.clearMessages(req.user!.id);
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === 'WORK_COLLECTION_IN_USE_BY_SCHEDULE') {
        return res.status(409).json({
          message:
            'Нельзя удалить коллекцию ВОР: она используется как источник графика работ. Сначала смените источник графика или очистите/пересоздайте задачи графика.',
        });
      }
      console.error('Work collection delete failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });
}
