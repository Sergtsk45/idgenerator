/**
 * @file: estimates.ts
 * @description: Estimates (ЛСР/Сметы) and estimate-position-links API routes
 * @dependencies: _common.ts, @shared/routes
 * @created: 2026-03-18
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { api } from '@shared/routes';
import { storage, appAuth } from './_common';
import { importEstimate } from '../services/estimateImportService';
import { ESTIMATE_UPLOAD_MAX_BYTES } from '../estimate-upload-files';
import { QUALITY_DOCUMENT_UPLOAD_MAX_BYTES } from '../quality-document-upload-files';
import { MCP_ERROR_CODES, McpToolError } from '../mcp/errors';
import { storeMcpUpload } from '../services/estimateUploadService';

const uploadMaxBytes = Math.max(ESTIMATE_UPLOAD_MAX_BYTES, QUALITY_DOCUMENT_UPLOAD_MAX_BYTES);
const mcpUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: uploadMaxBytes } });
const estimateUploadRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

function receiveMcpUpload(req: Request, res: Response, next: NextFunction): void {
  mcpUpload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ code: MCP_ERROR_CODES.FILE_TOO_LARGE, message: 'Upload is too large' });
    }
    if (error) return res.status(400).json({ code: MCP_ERROR_CODES.FILE_TYPE_NOT_ALLOWED, message: 'Invalid upload' });
    next();
  });
}

function uploadErrorStatus(error: McpToolError): number {
  if (error.code === MCP_ERROR_CODES.UPLOAD_NOT_FOUND) return 404;
  if (error.code === MCP_ERROR_CODES.UPLOAD_EXPIRED || error.code === MCP_ERROR_CODES.UPLOAD_ALREADY_CONSUMED) return 409;
  if (error.code === MCP_ERROR_CODES.FILE_TOO_LARGE) return 413;
  return 400;
}

export function registerEstimateRoutes(app: Express): void {
  if (process.env.MCP_ENABLED === 'true') {
    app.post(
      '/api/mcp/uploads/:uploadId',
      estimateUploadRateLimiter,
      ...appAuth,
      receiveMcpUpload,
      async (req, res) => {
        if (!req.file) return res.status(400).json({ code: MCP_ERROR_CODES.FILE_TYPE_NOT_ALLOWED, message: 'File is required' });
        try {
          const result = await storeMcpUpload(
            { userId: req.user!.id, displayName: req.user!.displayName, email: req.user!.email, role: req.user!.role },
            String(req.params.uploadId),
            req.file,
          );
          return res.status(200).json(result);
        } catch (error) {
          if (error instanceof McpToolError) {
            return res.status(uploadErrorStatus(error)).json({ code: error.code, message: error.message });
          }
          console.error('Estimate upload failed:', error);
          return res.status(500).json({ code: MCP_ERROR_CODES.INTERNAL_ERROR, message: 'Internal Server Error' });
        }
      },
    );
  }

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
      const result = await importEstimate(input, obj.id);
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
