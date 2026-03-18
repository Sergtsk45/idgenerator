/**
 * @file: estimates.ts
 * @description: Estimates (ЛСР/Сметы) and estimate-position-links API routes
 * @dependencies: _common.ts, @shared/routes
 * @created: 2026-03-18
 */

import type { Express } from 'express';
import { z } from 'zod';
import { api } from '@shared/routes';
import { storage, appAuth } from './_common';

export function registerEstimateRoutes(app: Express): void {
  // ── Estimates (Сметы / ЛСР) ────────────────────────────────────────────────

  // GET /api/estimates — список смет текущего объекта
  app.get(api.estimates.list.path, ...appAuth, async (req, res) => {
    const obj = await storage.getCurrentObject(req.user!.id);
    const list = await storage.getEstimates(obj.id);
    return res.status(200).json(list);
  });

  // GET /api/estimates/:id — смета с деталями
  app.get(api.estimates.get.path, ...appAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const obj = await storage.getCurrentObject(req.user!.id);
    const data = await storage.getEstimateWithDetails(id);
    if (!data) {
      return res.status(404).json({ message: 'Not found' });
    }
    if (data.estimate.objectId !== obj.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.status(200).json(data);
  });

  // POST /api/estimates/import — импорт сметы
  app.post(api.estimates.import.path, ...appAuth, async (req, res) => {
    try {
      const input = api.estimates.import.input.parse(req.body);
      const obj = await storage.getCurrentObject(req.user!.id);
      const result = await storage.importEstimate(input as any, obj.id);
      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Estimates import failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // DELETE /api/estimates/:id — удалить смету
  app.delete(api.estimates.delete.path, ...appAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const resetScheduleRaw = (req.query as any)?.resetSchedule;
    const resetSchedule = resetScheduleRaw === '1' || resetScheduleRaw === 'true';

    try {
      const ok = await storage.deleteEstimate(id, { resetScheduleIfInUse: resetSchedule });
      if (!ok) return res.status(404).json({ message: 'Not found' });
      await storage.clearMessages(req.user!.id);
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === 'ESTIMATE_IN_USE_BY_SCHEDULE') {
        return res.status(409).json({
          message:
            'Смета используется как источник графика работ. При удалении будут удалены график, все его задачи и очищены списки работ в затронутых актах.',
        });
      }
      console.error('Delete estimate failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // ── Estimate Position Links ────────────────────────────────────────────────

  // GET /api/schedules/:id/estimate-position-links/statuses
  app.get(api.estimatePositionLinks.statuses.path, ...appAuth, async (req, res) => {
    try {
      const scheduleId = Number(req.params.id);
      if (!Number.isFinite(scheduleId) || scheduleId <= 0) {
        return res.status(400).json({ message: 'Invalid schedule id' });
      }

      const schedule = await storage.getScheduleWithTasks(scheduleId);
      if (!schedule) {
        return res.status(404).json({ message: 'Schedule not found' });
      }

      if (schedule.sourceType !== 'estimate' || !schedule.estimateId) {
        return res.status(400).json({ message: 'Schedule source type must be "estimate"' });
      }

      const obj = await storage.getCurrentObject(req.user!.id);
      const statuses = await storage.getEstimateSubrowStatuses({
        objectId: obj.id,
        estimateId: Number(schedule.estimateId),
      });

      return res.status(200).json({ byEstimatePositionId: statuses });
    } catch (err) {
      console.error('Get estimate subrow statuses failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // POST /api/estimate-position-links — upsert estimate subrow ↔ project material link
  app.post(api.estimatePositionLinks.upsert.path, ...appAuth, async (req, res) => {
    try {
      const input = api.estimatePositionLinks.upsert.input.parse(req.body);
      const obj = await storage.getCurrentObject(req.user!.id);

      const saved = await storage.upsertEstimatePositionMaterialLink(obj.id, {
        estimateId: input.estimateId,
        estimatePositionId: input.estimatePositionId,
        projectMaterialId: input.projectMaterialId,
        batchId: (input as any).batchId ?? null,
        source: 'manual',
      } as any);

      return res.status(200).json(saved);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Upsert estimate position link failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // DELETE /api/estimate-position-links/:estimatePositionId
  app.delete(api.estimatePositionLinks.delete.path, ...appAuth, async (req, res) => {
    const estimatePositionId = Number(req.params.estimatePositionId);
    if (!Number.isFinite(estimatePositionId) || estimatePositionId <= 0) {
      return res.status(400).json({ message: 'Invalid estimatePositionId' });
    }
    try {
      const obj = await storage.getCurrentObject(req.user!.id);
      const ok = await storage.deleteEstimatePositionMaterialLink(obj.id, estimatePositionId);
      if (!ok) return res.status(404).json({ message: 'Not found' });
      return res.status(204).send();
    } catch (err) {
      console.error('Delete estimate position link failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });
}
