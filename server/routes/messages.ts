/**
 * @file: messages.ts
 * @description: Messages and worklog API routes
 * @dependencies: _common.ts, _openai.ts, _dateUtils.ts, @shared/routes
 * @created: 2026-03-18
 */

import type { Express } from 'express';
import { z } from 'zod';
import { api } from '@shared/routes';
import { storage, appAuth } from './_common';
import { normalizeWorkMessage } from './_openai';
import { eachDayInRange } from './_dateUtils';

export function registerMessageRoutes(app: Express): void {
  // DELETE /api/messages — очистить все сообщения пользователя
  app.delete(api.messages.list.path, ...appAuth, async (req, res) => {
    await storage.clearMessages(req.user!.id);
    return res.status(204).send();
  });

  // GET /api/messages — список сообщений пользователя
  app.get(api.messages.list.path, ...appAuth, async (req, res) => {
    const messages = await storage.getMessages(req.user!.id);
    res.json(messages);
  });

  // POST /api/messages — создать сообщение и нормализовать через AI
  app.post(api.messages.create.path, ...appAuth, async (req, res) => {
    try {
      const input = api.messages.create.input.parse(req.body);

      const currentObj = await storage.getCurrentObject(req.user!.id);

      const message = await storage.createMessage({
        objectId: currentObj.id,
        messageRaw: input.messageRaw,
        userId: req.user!.id,
      } as any);

      try {
        const normalized = await normalizeWorkMessage(input.messageRaw, currentObj.id);
        await storage.updateMessageNormalized(message.id, normalized);
        const updated = await storage.getMessage(message.id);
        res.status(201).json(updated);
      } catch (aiError) {
        console.error('AI Normalization failed:', aiError);
        const updated = await storage.updateMessageNormalized(message.id, null as any);
        res.status(201).json(updated);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // POST /api/messages/:id/process — повторная нормализация сообщения
  app.post(api.messages.process.path, ...appAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: 'Invalid message id' });
      }

      const message = await storage.getMessage(id);
      if (!message) {
        return res.status(404).json({ message: 'Message not found' });
      }

      if (message.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const processObj = await storage.getCurrentObject(req.user!.id);

      try {
        const normalized = await normalizeWorkMessage(message.messageRaw, processObj.id);
        await storage.updateMessageNormalized(message.id, normalized);
      } catch (aiError) {
        console.error('Message processing (AI) failed:', aiError);
        await storage.updateMessageNormalized(message.id, null as any);
      }

      const updated = await storage.getMessage(message.id);
      return res.status(200).json(updated);
    } catch (err) {
      console.error('Message processing failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // PATCH /api/messages/:id — редактирование сообщения
  app.patch(api.messages.patch.path, ...appAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: 'Invalid message id' });
      }

      const existing = await storage.getMessage(id);
      if (!existing) {
        return res.status(404).json({ message: 'Message not found' });
      }
      if (existing.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const input = api.messages.patch.input.parse(req.body);
      const updated = await storage.patchMessage(id, input);

      if (!updated) {
        return res.status(404).json({ message: 'Message not found' });
      }

      return res.status(200).json(updated);
    } catch (err) {
      console.error('Message patch failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // GET /api/worklog/section3 — combined view of messages and acts grouped by date
  app.get(api.worklog.section3.path, ...appAuth, async (req, res) => {
    try {
      const showVolumes = req.query.showVolumes === '1';

      const section3Obj = await storage.getCurrentObject(req.user!.id);

      const [allMessages, allActs] = await Promise.all([
        storage.getMessages(req.user!.id),
        storage.getActs(section3Obj.id),
      ]);

      type Segment = {
        text: string;
        sourceType: 'message' | 'act';
        sourceId: number;
        isPending: boolean;
      };

      type DateRow = {
        date: string;
        workConditions: string;
        segments: Segment[];
        representative: string;
      };

      const byDate = new Map<string, DateRow>();

      const getOrCreateRow = (date: string): DateRow => {
        if (!byDate.has(date)) {
          byDate.set(date, { date, workConditions: '', segments: [], representative: '' });
        }
        return byDate.get(date)!;
      };

      // First pass: acts
      for (const act of allActs) {
        if (!act.dateStart || !act.dateEnd || !act.worksData) continue;

        const dateStart = String(act.dateStart);
        const dateEnd = String(act.dateEnd);
        const worksData = act.worksData as Array<{
          description: string;
          code?: string;
          quantity?: number;
          unit?: string;
        }>;

        if (!Array.isArray(worksData) || worksData.length === 0) continue;

        const dates = eachDayInRange(dateStart, dateEnd);

        for (const date of dates) {
          const row = getOrCreateRow(date);
          for (const workItem of worksData) {
            let text = workItem.description || '';
            if (showVolumes && workItem.quantity != null && workItem.unit) {
              text += ` (${workItem.quantity} ${workItem.unit})`;
            }
            row.segments.push({ text, sourceType: 'act', sourceId: act.id, isPending: false });
          }
        }
      }

      // Second pass: messages
      for (const msg of allMessages) {
        const data = msg.normalizedData;

        let dateStr = '';
        if (data?.date) {
          dateStr = data.date;
        } else if (msg.createdAt) {
          dateStr = new Date(msg.createdAt).toISOString().slice(0, 10);
        }
        if (!dateStr) continue;

        let text = '';
        if (msg.isProcessed && data) {
          text = data.workDescription || msg.messageRaw || '';
          const materials = Array.isArray(data.materials) ? data.materials : [];
          if (materials.length > 0) text += ` — ${materials.join('; ')}`;
        } else {
          text = msg.messageRaw || '';
        }

        const row = getOrCreateRow(dateStr);

        if (data?.workConditions && !row.workConditions) {
          row.workConditions = data.workConditions;
        }
        if (data?.representative && !row.representative) {
          row.representative = data.representative;
        }

        row.segments.push({
          text,
          sourceType: 'message',
          sourceId: msg.id,
          isPending: !msg.isProcessed,
        });
      }

      const rows = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
      res.json(rows);
    } catch (err) {
      console.error('Worklog section3 fetch failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });
}
