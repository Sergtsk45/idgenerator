import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { getOpenAIClient } from "./routes/_openai";
import { addDaysISO } from "./routes/_dateUtils";
import multer from "multer";
import rateLimit from "express-rate-limit";
import {
  buildActDataFromSourceData,
  buildAttachmentsText,
  buildP3MaterialsText,
  generateAosrPdf,
  loadTemplateCatalog,
  type ActData,
} from "./pdfGenerator";
import * as fs from "fs";
import * as path from "path";
import { telegramAuthMiddleware } from "./middleware/telegramAuth";
import { registerAuthRoutes } from "./routes/auth";
import { registerAdminRoutes } from "./routes/admin";
import { registerMessageRoutes } from "./routes/messages";
import { registerWorksRoutes } from "./routes/works";
import { registerEstimateRoutes } from "./routes/estimates";
import { registerMaterialsRoutes } from "./routes/materials";
import { authMiddleware } from "./middleware/auth";
import { requireFeature, requireQuota } from "./middleware/tariff";
import { db } from "./db";
import { users, objects } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { getQuota } from "@shared/tariff-features";




const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg',
      'audio/wav', 'audio/x-wav', 'audio/mp3',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  },
});


const voiceRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many voice transcription requests, please try again later" },
});


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register auth routes (login, register, JWT)
  await registerAuthRoutes(app);
  
  // Auth Middleware (new unified approach)
  const appAuth = [authMiddleware({ required: true })] as const;
  
  // Tariff status
  app.get(api.tariff.status.path, ...appAuth, async (req, res) => {
    try {
      const user = req.user!;

      // Подсчет объектов пользователя
      const objectsCount = await db
        .select({ count: sql`count(*)::int` })
        .from(objects)
        .where(eq(objects.userId, user.id));

      const invoiceImportsUsed = await storage.countMonthlyInvoiceImports(user.id);

      const objectsLimit = getQuota(user.tariff, 'objects');
      const invoiceImportsLimit = getQuota(user.tariff, 'invoiceImports');

      return res.status(200).json({
        tariff: user.tariff,
        effectiveTariff: user.tariff,
        subscriptionEndsAt: user.subscriptionEndsAt?.toISOString() || null,
        trialUsed: user.trialUsed,
        quotas: {
          objects: {
            limit: objectsLimit,
            used: Number(objectsCount[0]?.count || 0),
          },
          invoiceImports: {
            limit: invoiceImportsLimit,
            used: invoiceImportsUsed,
          },
        },
      });
    } catch (err) {
      console.error('Get tariff status failed:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  // Voice transcription (Whisper API)
  app.post(
    api.voice.transcribe.path,
    voiceRateLimiter,
    ...appAuth,
    (req, res, next) => {
      voiceUpload.single('audio')(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'Audio file too large (max 10 MB)' });
          }
          return res.status(400).json({ message: err.message });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        const file = (req as any).file as Express.Multer.File | undefined;
        if (!file) {
          return res.status(400).json({ message: 'No audio file provided' });
        }

        const openai = getOpenAIClient();
        if (!openai) {
          return res.status(500).json({ message: 'OpenAI not configured (AI_INTEGRATIONS_OPENAI_API_KEY)' });
        }

        const audioFile = new File([file.buffer], file.originalname || 'audio.webm', {
          type: file.mimetype,
        });

        const transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          language: 'ru',
        });

        return res.status(200).json({ text: transcription.text });
      } catch (err) {
        console.error('Voice transcription failed:', err);
        return res.status(500).json({ message: 'Transcription failed' });
      } finally {
        if ((req as any).file) {
          (req as any).file.buffer = null;
        }
      }
    }
  );

  // Object (MVP: single current object)
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

  // Multi-object management endpoints
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

  // Materials routes — extracted to server/routes/materials.ts
  registerMaterialsRoutes(app);

  app.get(api.actMaterialUsages.list.path, async (req, res) => {
    const actId = Number(req.params.id);
    if (!Number.isFinite(actId) || actId <= 0) {
      return res.status(400).json({ message: "Invalid act id" });
    }
    try {
      const items = await storage.getActMaterialUsages(actId);
      return res.status(200).json(items);
    } catch (err) {
      console.error("Act material usages list failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.actMaterialUsages.replace.path, async (req, res) => {
    const actId = Number(req.params.id);
    if (!Number.isFinite(actId) || actId <= 0) {
      return res.status(400).json({ message: "Invalid act id" });
    }
    try {
      const input = api.actMaterialUsages.replace.input.parse(req.body);
      await storage.replaceActMaterialUsages(actId, (input as any).items ?? []);
      const items = await storage.getActMaterialUsages(actId);
      return res.status(200).json(items);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Act material usages replace failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.actDocumentAttachments.list.path, async (req, res) => {
    const actId = Number(req.params.id);
    if (!Number.isFinite(actId) || actId <= 0) {
      return res.status(400).json({ message: "Invalid act id" });
    }
    try {
      const items = await storage.getActDocAttachments(actId);
      return res.status(200).json(items);
    } catch (err) {
      console.error("Act document attachments list failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.actDocumentAttachments.replace.path, async (req, res) => {
    const actId = Number(req.params.id);
    if (!Number.isFinite(actId) || actId <= 0) {
      return res.status(400).json({ message: "Invalid act id" });
    }
    try {
      const input = api.actDocumentAttachments.replace.input.parse(req.body);
      await storage.replaceActDocAttachments(actId, (input as any).items ?? []);
      const items = await storage.getActDocAttachments(actId);
      return res.status(200).json(items);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Act document attachments replace failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Works routes — extracted to server/routes/works.ts
  registerWorksRoutes(app);

  // Message routes — extracted to server/routes/messages.ts
  registerMessageRoutes(app);


  // Acts
  app.get(api.acts.list.path, ...appAuth, async (req, res) => {
    const obj = await storage.getCurrentObject(req.user!.id);
    const acts = await storage.getActs(obj.id);
    res.json(acts);
  });

  // Deprecated: acts can be created only from schedule now.
  app.post(api.acts.generate.path, async (_req, res) => {
    return res.status(410).json({
      message: "Эндпоинт устарел: акты АОСР теперь создаются только из графика работ (/schedule).",
    });
  });

  app.get(api.acts.get.path, ...appAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const obj = await storage.getCurrentObject(req.user!.id);
    const act = await storage.getAct(id);
    if (!act) return res.status(404).json({ message: "Act not found" });
    if (act.objectId !== obj.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const attachments = await storage.getAttachments(act.id);
    return res.json({ ...act, attachments });
  });

  // Schedules (Gantt)
  app.get(api.schedules.default.path, ...appAuth, async (req, res) => {
    try {
      const obj = await storage.getCurrentObject(req.user!.id);
      const schedule = await storage.getOrCreateDefaultSchedule(obj.id);
      return res.status(200).json(schedule);
    } catch (err) {
      console.error("Get default schedule failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.schedules.create.path, ...appAuth, async (req, res) => {
    try {
      const input = api.schedules.create.input.parse(req.body);
      const obj = await storage.getCurrentObject(req.user!.id);
      const schedule = await storage.createSchedule({ ...input, objectId: obj.id } as any);
      return res.status(201).json(schedule);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Create schedule failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.schedules.get.path, ...appAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid schedule id" });
    }

    const obj = await storage.getCurrentObject(req.user!.id);
    const schedule = await storage.getScheduleWithTasks(id);
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }
    if (schedule.objectId !== obj.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.status(200).json(schedule);
  });

  app.post(api.schedules.bootstrapFromWorks.path, ...appAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid schedule id" });
      }

      const input = api.schedules.bootstrapFromWorks.input.parse(req.body ?? {});

      const obj = await storage.getCurrentObject(req.user!.id);
      const schedule = await storage.getScheduleWithTasks(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      if (schedule.objectId !== obj.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const today = new Date().toISOString().slice(0, 10);
      const defaultStartDate = input.defaultStartDate ?? (schedule.calendarStart as any) ?? today;
      const defaultDurationDays = input.defaultDurationDays ?? 1;

      const result = await storage.bootstrapScheduleTasksFromWorks({
        scheduleId: id,
        workIds: input.workIds,
        defaultStartDate,
        defaultDurationDays,
      });

      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Schedule bootstrap failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.schedules.generateActs.path, ...appAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid schedule id" });
      }

      api.schedules.generateActs.input.parse(req.body ?? {});

      const schedule = await storage.getScheduleWithTasks(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      const groups = new Map<number, typeof schedule.tasks>();
      let skippedNoActNumber = 0;

      for (const task of schedule.tasks) {
        const actNumber = (task as any).actNumber as number | null | undefined;
        if (actNumber == null) {
          skippedNoActNumber++;
          continue;
        }
        if (!Number.isFinite(actNumber) || actNumber <= 0) {
          return res.status(400).json({ message: `Invalid actNumber for task ${task.id}` });
        }

        const list = groups.get(actNumber) ?? [];
        list.push(task);
        groups.set(actNumber, list);
      }

      const actNumbers = Array.from(groups.keys()).sort((a, b) => a - b);
      let created = 0;
      let updated = 0;
      const deletedActNumbers: number[] = [];
      const warnings: Array<{ actNumber: number; type: string; message: string }> = [];

      const mergeFreeText = (values: Array<string | null | undefined>): string => {
        const tokens: string[] = [];
        const seen = new Set<string>();
        for (const v of values) {
          const raw = String(v ?? "").trim();
          if (!raw) continue;
          const parts = raw
            .split(/[\n,;]+/g)
            .map((p) => p.trim())
            .filter(Boolean);
          for (const p of parts) {
            const key = p.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            tokens.push(p);
          }
        }
        return tokens.join(", ");
      };

      for (const actNumber of actNumbers) {
        const tasks = (groups.get(actNumber) ?? []).slice().sort((a: any, b: any) => Number(a.orderIndex ?? 0) - Number(b.orderIndex ?? 0));
        if (tasks.length === 0) continue;

        // Determine act template type (one per actNumber)
        const distinctTemplateIds = Array.from(
          new Set(tasks.map((t: any) => (t as any).actTemplateId).filter((v: any) => v != null)),
        ).map((v: any) => Number(v));
        const actTemplateId = distinctTemplateIds.length > 0 ? distinctTemplateIds[0] : null;
        if (distinctTemplateIds.length === 0) {
          warnings.push({
            actNumber,
            type: "no_template_type",
            message: `Акт №${actNumber}: не выбран тип акта (шаблон) ни у одной задачи`,
          });
        } else if (distinctTemplateIds.length > 1) {
          warnings.push({
            actNumber,
            type: "mixed_template_types",
            message: `Акт №${actNumber}: в задачах выбрано несколько типов актов (${distinctTemplateIds.join(", ")}). Используется первый.`,
          });
        }

        let minStart: string | null = null;
        let maxEnd: string | null = null;

        for (const t of tasks) {
          const start = String(t.startDate);
          const durationDays = Number(t.durationDays ?? 0);
          // dateEnd is inclusive: if duration is 1 day, end = start
          const end = addDaysISO(start, Math.max(0, durationDays - 1));

          if (!minStart || start < minStart) minStart = start;
          if (!maxEnd || end > maxEnd) maxEnd = end;
        }

        // Aggregate task-scoped docs
        const projectDrawingsAgg = mergeFreeText(tasks.map((t: any) => (t as any).projectDrawings));
        const normativeRefsAgg = mergeFreeText(tasks.map((t: any) => (t as any).normativeRefs));
        const schemeSeen = new Set<string>();
        const executiveSchemesAgg: Array<{ title: string; fileUrl?: string }> = [];
        for (const t of tasks) {
          const list = (t as any).executiveSchemes;
          if (!Array.isArray(list)) continue;
          for (const s of list) {
            const title = String((s as any)?.title ?? "").trim();
            const fileUrl = String((s as any)?.fileUrl ?? "").trim();
            if (!title) continue;
            const key = `${title.toLowerCase()}|${fileUrl}`;
            if (schemeSeen.has(key)) continue;
            schemeSeen.add(key);
            executiveSchemesAgg.push(fileUrl ? { title, fileUrl } : { title });
          }
        }

        // Generate worksData from task-level quantity (independent from source).
        // Multiple tasks with the same sourceId have their quantities summed.
        let worksData: Array<{
          sourceType: 'works' | 'estimate';
          sourceId: number;
          description: string;
          quantity: number;
          unit?: string;
          code?: string;
        }>;

        if (schedule.sourceType === 'estimate') {
          // Group tasks by estimatePositionId and sum their independent quantities
          const positionIdToTasks = new Map<number, typeof tasks>();
          for (const t of tasks) {
            if (t.estimatePositionId) {
              const key = Number(t.estimatePositionId);
              const list = positionIdToTasks.get(key) ?? [];
              list.push(t);
              positionIdToTasks.set(key, list);
            }
          }
          const positionIds = Array.from(positionIdToTasks.keys());
          const positions = await storage.getEstimatePositionsByIds(positionIds);
          positions.sort((a, b) => String(a.code ?? '').localeCompare(String(b.code ?? '')));

          worksData = positions.map((p) => {
            const taskGroup = positionIdToTasks.get(p.id) ?? [];
            // Sum independent task quantities; fall back to source quantity if task has none
            const qty = taskGroup.reduce((sum, t) => {
              const tQty = (t as any).quantity;
              if (tQty != null) return sum + Number(tQty);
              const rawQty: any = (p as any).quantity;
              return sum + (rawQty != null ? Number(rawQty) : 0);
            }, 0);
            // Use task unit if set, else fall back to source
            const unit = ((taskGroup[0] as any)?.unit ?? (p as any).unit) ?? undefined;
            return {
              sourceType: 'estimate' as const,
              sourceId: p.id,
              description: p.name,
              quantity: Number.isFinite(qty) ? qty : 0,
              unit,
              code: p.code ?? undefined,
            };
          });
        } else {
          // Source: Works (BoQ) — group by workId and sum independent task quantities
          const workIdToTasks = new Map<number, typeof tasks>();
          for (const t of tasks) {
            if (t.workId) {
              const key = Number(t.workId);
              const list = workIdToTasks.get(key) ?? [];
              list.push(t);
              workIdToTasks.set(key, list);
            }
          }
          const workIds = Array.from(workIdToTasks.keys());
          const works = await storage.getWorksByIds(workIds);
          works.sort((a, b) => String(a.code).localeCompare(String(b.code)));

          worksData = works.map((w) => {
            const taskGroup = workIdToTasks.get(w.id) ?? [];
            // Sum independent task quantities; fall back to source quantityTotal if task has none
            const qty = taskGroup.reduce((sum, t) => {
              const tQty = (t as any).quantity;
              if (tQty != null) return sum + Number(tQty);
              const rawQty: any = (w as any).quantityTotal;
              return sum + (rawQty != null ? Number(rawQty) : 0);
            }, 0);
            // Use task unit if set, else fall back to source
            const unit = ((taskGroup[0] as any)?.unit ?? w.unit) ?? undefined;
            return {
              sourceType: 'works' as const,
              sourceId: w.id,
              description: w.description,
              quantity: Number.isFinite(qty) ? qty : 0,
              unit,
              code: w.code,
            };
          });
        }

        const result = await storage.upsertActByNumber({
          actNumber,
          actTemplateId,
          dateStart: minStart,
          dateEnd: maxEnd,
          status: "draft",
          worksData: worksData as any,
          projectDrawingsAgg: projectDrawingsAgg || null,
          normativeRefsAgg: normativeRefsAgg || null,
          executiveSchemesAgg: executiveSchemesAgg.length > 0 ? executiveSchemesAgg : null,
        }, req.user!.id);

        if (result.created) created++;
        else updated++;

        // Replace act materials and formal attachments from task_materials
        const taskIdToWorkId = new Map<number, number | null>();
        for (const t of tasks) taskIdToWorkId.set(Number((t as any).id), (t as any).workId != null ? Number((t as any).workId) : null);

        const taskMaterialsLists = await Promise.all(tasks.map((t: any) => storage.getTaskMaterials(Number(t.id))));
        const flatTaskMaterials = taskMaterialsLists.flat();

        const actUsageItems: any[] = [];
        const attachmentDocIds: number[] = [];
        const attachmentDocSeen = new Set<number>();
        let missingQualityDocs = 0;

        for (const row of flatTaskMaterials) {
          const qdId = (row as any).qualityDocumentId == null ? null : Number((row as any).qualityDocumentId);
          if (qdId == null) missingQualityDocs++;
          if (qdId != null && !attachmentDocSeen.has(qdId)) {
            attachmentDocSeen.add(qdId);
            attachmentDocIds.push(qdId);
          }
          actUsageItems.push({
            projectMaterialId: Number((row as any).projectMaterialId),
            workId: taskIdToWorkId.get(Number((row as any).taskId)) ?? null,
            batchId: (row as any).batchId == null ? null : Number((row as any).batchId),
            qualityDocumentId: qdId,
            note: (row as any).note ?? null,
            orderIndex: Number((row as any).orderIndex ?? 0),
          });
        }

        // Persist to DB for PDF defaults
        await storage.replaceActMaterialUsages(result.act.id, actUsageItems as any);
        await storage.replaceActDocAttachments(
          result.act.id,
          attachmentDocIds.map((documentId, orderIndex) => ({ documentId, orderIndex })) as any,
        );

        if (actUsageItems.length === 0) {
          warnings.push({ actNumber, type: "no_materials", message: `Акт №${actNumber}: нет материалов ни в одной задаче` });
        } else if (missingQualityDocs > 0) {
          warnings.push({
            actNumber,
            type: "no_quality_docs",
            message: `Акт №${actNumber}: у ${missingQualityDocs} материалов не указан документ качества`,
          });
        }
        if (!projectDrawingsAgg) {
          warnings.push({ actNumber, type: "no_drawings", message: `Акт №${actNumber}: не заполнены номера чертежей проекта` });
        }
        if (!normativeRefsAgg) {
          warnings.push({ actNumber, type: "no_normatives", message: `Акт №${actNumber}: не заполнены СНиП/ГОСТ/РД` });
        }
      }

      // Delete acts which no longer have any tasks (global actNumber uniqueness is assumed).
      const actNumbersSet = new Set<number>(actNumbers);
      const generateActsObj = await storage.getCurrentObject(req.user!.id);
      const existingActs = await storage.getActs(generateActsObj.id);
      for (const a of existingActs as any[]) {
        const n = (a as any).actNumber;
        if (n == null) continue;
        const num = Number(n);
        if (actNumbersSet.has(num)) continue;
        if (String((a as any).status ?? "") === "signed") continue;
        const ok = await storage.deleteActByNumber(num);
        if (ok) deletedActNumbers.push(num);
      }

      return res.status(200).json({
        scheduleId: id,
        actNumbers,
        created,
        updated,
        skippedNoActNumber,
        deletedActNumbers,
        warnings,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Generate acts from schedule failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Get schedule source info
  app.get(api.schedules.sourceInfo.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid schedule id" });
      }

      const info = await storage.getScheduleSourceInfo(id);
      if (!info) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      return res.status(200).json(info);
    } catch (err) {
      console.error("Get schedule source info failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Change schedule source
  app.post(api.schedules.changeSource.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid schedule id" });
      }

      const input = api.schedules.changeSource.input.parse(req.body);

      // Validate: if estimate source, estimateId must be provided
      if (input.newSourceType === 'estimate' && !input.estimateId) {
        return res.status(400).json({ message: 'estimateId is required when newSourceType is "estimate"' });
      }

      // Get current state
      const info = await storage.getScheduleSourceInfo(id);
      if (!info) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      // If not confirmed and there are tasks, return confirmation prompt
      if (!input.confirmReset && info.tasksCount > 0) {
        return res.status(200).json({
          requiresConfirmation: true,
          message: `При смене источника будут удалены все задачи графика (${info.tasksCount} шт.) и очищены списки работ в актах (${info.affectedActNumbers.length} шт.)`,
          tasksCount: info.tasksCount,
          affectedActNumbers: info.affectedActNumbers,
        });
      }

      // Execute change
      await storage.changeScheduleSource({
        scheduleId: id,
        newSourceType: input.newSourceType,
        newEstimateId: input.estimateId,
      });

      return res.status(200).json({
        success: true,
        deletedTasks: info.tasksCount,
        clearedActs: info.affectedActNumbers.length,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Change schedule source failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Bootstrap schedule from estimate
  app.post(api.schedules.bootstrapFromEstimate.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid schedule id" });
      }

      const input = api.schedules.bootstrapFromEstimate.input.parse(req.body);

      // Get schedule to check source
      const schedule = await storage.getScheduleWithTasks(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      if (schedule.sourceType !== 'estimate') {
        return res.status(400).json({ message: 'Schedule source type must be "estimate"' });
      }

      if (!schedule.estimateId) {
        return res.status(400).json({ message: 'Schedule has no estimateId' });
      }

      const defaultStartDate = input.defaultStartDate || new Date().toISOString().split('T')[0];
      const defaultDurationDays = input.defaultDurationDays ?? 1;

      const result = await storage.bootstrapScheduleTasksFromEstimate({
        scheduleId: id,
        estimateId: schedule.estimateId,
        positionIds: input.positionIds,
        defaultStartDate,
        defaultDurationDays,
      });

      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if ((err as Error).message === "SCHEDULE_NOT_FOUND") {
        return res.status(404).json({ message: "Schedule not found" });
      }
      if ((err as Error).message === "SCHEDULE_SOURCE_MISMATCH") {
        return res.status(400).json({ message: "Schedule source type does not match" });
      }
      console.error("Bootstrap from estimate failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch(api.scheduleTasks.patch.path, ...appAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid schedule task id" });
      }

      const input = api.scheduleTasks.patch.input.parse(req.body);
      const existing = await storage.getScheduleTask(id);
      if (!existing) {
        return res.status(404).json({ message: "Schedule task not found" });
      }

      const scheduleId = Number((existing as any).scheduleId);
      const existingActNumber = (existing as any).actNumber;
      const existingTemplateId = (existing as any).actTemplateId ?? null;
      
      const nextActNumber = input.actNumber !== undefined ? input.actNumber : existingActNumber;
      let nextTemplateId = input.actTemplateId !== undefined ? input.actTemplateId : existingTemplateId;

      // BLOCK A: Enforce rule when actNumber changes (task enters or moves to an act)
      if (input.actNumber !== undefined && input.actNumber !== existingActNumber && input.actNumber != null) {
        const tasksInTargetAct = await storage.getTasksByActNumber(scheduleId, Number(input.actNumber));
        const groupTemplateId = tasksInTargetAct
          .map((t: any) => (t as any).actTemplateId)
          .find((v: any) => v != null) ?? null;

        if (groupTemplateId != null) {
          if (existingActNumber == null) {
            // Sub-case A1: Task had NO actNumber — entering act for the first time.
            // Always ask user to confirm applying the act type to this task only.
            if (!input.updateAllTasks) {
              return res.status(409).json({
                message: "В акте уже назначен тип. Назначить тип текущей задаче?",
                actNumber: input.actNumber,
                currentTemplateId: groupTemplateId,
                otherTasksCount: Math.max(0, tasksInTargetAct.length),
                conflictKind: "actNumberAssign" as const,
              });
            }
            // Confirmed: apply type to this task only (other tasks already have it)
            input.actTemplateId = groupTemplateId;
            nextTemplateId = groupTemplateId;
          } else {
            // Sub-case A2: Task already had actNumber — moving to a different act.
            // Conflict only if task has a different type.
            const taskWantsTemplateId = input.actTemplateId !== undefined ? input.actTemplateId : existingTemplateId;
            if (taskWantsTemplateId != null && taskWantsTemplateId !== groupTemplateId && !input.updateAllTasks) {
              return res.status(409).json({
                message: "В акте уже назначен другой тип. Добавить работу с типом из акта?",
                actNumber: input.actNumber,
                currentTemplateId: groupTemplateId,
                otherTasksCount: Math.max(0, tasksInTargetAct.length),
                conflictKind: "actNumberChange" as const,
              });
            }
            // Auto-apply group type to task
            input.actTemplateId = groupTemplateId;
            nextTemplateId = groupTemplateId;
          }
        }
      }

      // BLOCK B: Enforce rule when actTemplateId changes (sync across all tasks in act)
      if (input.actTemplateId !== undefined && nextActNumber != null) {
        const tasksInAct = await storage.getTasksByActNumber(scheduleId, Number(nextActNumber));
        const distinct = Array.from(
          new Set(tasksInAct.map((t: any) => (t as any).actTemplateId).filter((v: any) => v != null)),
        );

        const conflict = distinct.length > 0 && (distinct.length > 1 || distinct[0] !== nextTemplateId);
        if (conflict && !input.updateAllTasks) {
          return res.status(409).json({
            message: "В этом акте уже выбран другой тип. Изменить тип для всех задач акта?",
            actNumber: nextActNumber,
            currentTemplateId: distinct[0] ?? null,
            otherTasksCount: Math.max(0, tasksInAct.length - 1),
            conflictKind: "templateChange" as const,
          });
        }

        // Always sync templateId across ALL tasks of the same actNumber
        // (even if no conflict — ensures rule enforcement)
        await storage.updateActTemplateForActNumber({
          scheduleId,
          actNumber: Number(nextActNumber),
          actTemplateId: nextTemplateId,
        });

        // Also update act record (if exists) to keep list view consistent before next generate-acts.
        const act = await storage.getActByNumber(Number(nextActNumber));
        if (act && (act as any).status !== "signed") {
          await storage.upsertActByNumber({
            actNumber: Number(nextActNumber),
            actTemplateId: nextTemplateId,
            dateStart: (act as any).dateStart ?? null,
            dateEnd: (act as any).dateEnd ?? null,
            location: (act as any).location ?? null,
            status: (act as any).status ?? "draft",
            worksData: ((act as any).worksData ?? []) as any,
            projectDrawingsAgg: (act as any).projectDrawingsAgg ?? null,
            normativeRefsAgg: (act as any).normativeRefsAgg ?? null,
            executiveSchemesAgg: (act as any).executiveSchemesAgg ?? null,
          }, req.user!.id);
        }
      }

      // Remove route-level helper flag before passing to storage
      const { updateAllTasks: _updateAllTasks, ...patch } = input as any;
      const updated = await storage.patchScheduleTask(id, patch);

      if (!updated) {
        return res.status(404).json({ message: "Schedule task not found" });
      }

      // SPLIT-017: Sync docs across split group if needed
      const updatedData = updated as any;
      const hasDocChanges = 
        input.projectDrawings !== undefined || 
        input.normativeRefs !== undefined || 
        input.executiveSchemes !== undefined;

      if (hasDocChanges && updatedData.splitGroupId && !updatedData.independentMaterials) {
        const docFields: {
          projectDrawings?: string | null;
          normativeRefs?: string | null;
          executiveSchemes?: Array<{ title: string; fileUrl?: string }> | null;
        } = {};

        if (input.projectDrawings !== undefined) {
          docFields.projectDrawings = input.projectDrawings;
        }
        if (input.normativeRefs !== undefined) {
          docFields.normativeRefs = input.normativeRefs;
        }
        if (input.executiveSchemes !== undefined) {
          docFields.executiveSchemes = input.executiveSchemes;
        }

        await storage.syncDocsAcrossSplitGroup(id, docFields);
      }

      return res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Schedule task patch failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // SPLIT-015: Split schedule task into two tasks
  app.post(api.scheduleTasks.split.path, ...appAuth, requireFeature('SPLIT_TASK'), async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      if (!Number.isFinite(taskId) || taskId <= 0) {
        return res.status(400).json({ message: "Invalid schedule task id" });
      }

      const input = api.scheduleTasks.split.input.parse(req.body);
      
      // Get the task to validate
      const task = await storage.getScheduleTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Schedule task not found" });
      }

      const taskData = task as any;
      const taskStartDate = taskData.startDate;
      const taskDuration = taskData.durationDays || 0;
      const taskEndDate = addDaysISO(taskStartDate, taskDuration);

      // Validate splitDate is within task date range
      if (input.splitDate <= taskStartDate || input.splitDate >= taskEndDate) {
        return res.status(400).json({ 
          message: `Split date must be between ${taskStartDate} and ${taskEndDate}` 
        });
      }

      // Check actNumber conflict if newActNumber is provided
      if (input.newActNumber) {
        const scheduleId = taskData.scheduleId;
        const tasksInTargetAct = await storage.getTasksByActNumber(scheduleId, input.newActNumber);
        
        // Check if any task in the target act is from a different split group
        const conflictingTasks = tasksInTargetAct.filter((t: any) => {
          const tSplitGroupId = t.splitGroupId;
          const currentSplitGroupId = taskData.splitGroupId;
          // Conflict if another split group already uses this actNumber
          return tSplitGroupId && tSplitGroupId !== currentSplitGroupId;
        });

        if (conflictingTasks.length > 0) {
          return res.status(409).json({ 
            message: `Act number ${input.newActNumber} is already occupied by another split group` 
          });
        }
      }

      // Parse quantities if provided
      let quantityFirst: number | null = null;
      let quantitySecond: number | null = null;
      
      if (input.quantityFirst !== undefined) {
        quantityFirst = parseFloat(input.quantityFirst);
        if (isNaN(quantityFirst) || quantityFirst < 0) {
          return res.status(400).json({ message: "Invalid quantityFirst" });
        }
      }
      
      if (input.quantitySecond !== undefined) {
        quantitySecond = parseFloat(input.quantitySecond);
        if (isNaN(quantitySecond) || quantitySecond < 0) {
          return res.status(400).json({ message: "Invalid quantitySecond" });
        }
      }

      // Call storage method - durations are calculated in storage layer
      const result = await storage.splitScheduleTask({
        taskId,
        splitDate: input.splitDate,
        quantityFirst,
        quantitySecond,
        newActNumber: input.newActNumber ?? null,
        inherit: input.inherit,
      });

      return res.status(200).json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err.message === "TASK_NOT_FOUND") {
        return res.status(404).json({ message: "Schedule task not found" });
      }
      if (err.message === "SPLIT_DATE_OUT_OF_RANGE") {
        return res.status(400).json({ message: "Split date is out of task date range" });
      }
      if (err.message === "QUANTITY_SUM_EXCEEDS_ORIGINAL") {
        return res.status(400).json({ message: "Sum of split quantities exceeds original task quantity" });
      }
      console.error("Split task failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // SPLIT-016: Get split siblings
  app.get(api.scheduleTasks.splitSiblings.path, ...appAuth, async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      if (!Number.isFinite(taskId) || taskId <= 0) {
        return res.status(400).json({ message: "Invalid schedule task id" });
      }

      const siblings = await storage.getSplitSiblings(taskId);
      
      if (siblings.length === 0) {
        return res.status(404).json({ message: "Schedule task not found" });
      }

      return res.status(200).json(siblings);
    } catch (err) {
      console.error("Get split siblings failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Schedule task materials (p.3 AOSR sources)
  app.get(api.taskMaterials.list.path, async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      if (!Number.isFinite(taskId) || taskId <= 0) {
        return res.status(400).json({ message: "Invalid schedule task id" });
      }

      const list = await storage.getTaskMaterials(taskId);
      const dto = list.map((r: any) => {
        const pm = r.projectMaterial ?? null;
        const cat = r.catalogMaterial ?? null;
        const batch = r.batch ?? null;
        const qd = r.qualityDocument ?? null;

        const name =
          String(cat?.name ?? "").trim() ||
          String(pm?.nameOverride ?? "").trim() ||
          (pm?.id != null ? `Материал #${String(pm.id)}` : null);

        const batchLabel = batch
          ? [batch.batchNumber ? `Партия ${String(batch.batchNumber)}` : null, batch.deliveryDate ? `от ${String(batch.deliveryDate)}` : null]
              .filter(Boolean)
              .join(" ")
          : null;

        return {
          id: Number(r.id),
          taskId: Number(r.taskId),
          projectMaterialId: Number(r.projectMaterialId),
          batchId: r.batchId == null ? null : Number(r.batchId),
          qualityDocumentId: r.qualityDocumentId == null ? null : Number(r.qualityDocumentId),
          note: r.note ?? null,
          orderIndex: Number(r.orderIndex ?? 0),
          createdAt: (r as any).createdAt,
          projectMaterialName: name,
          batchLabel,
          qualityDocumentTitle: qd?.title ?? null,
          qualityDocumentNumber: qd?.docNumber ?? null,
          qualityDocumentFileUrl: qd?.fileUrl ?? null,
        };
      });

      return res.status(200).json(dto);
    } catch (err) {
      console.error("List task materials failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.taskMaterials.replace.path, async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      if (!Number.isFinite(taskId) || taskId <= 0) {
        return res.status(400).json({ message: "Invalid schedule task id" });
      }

      const input = api.taskMaterials.replace.input.parse(req.body);
      const items = input.items.map((it, idx) => ({
        projectMaterialId: Number(it.projectMaterialId),
        batchId: it.batchId == null ? null : Number(it.batchId),
        qualityDocumentId: it.qualityDocumentId == null ? null : Number(it.qualityDocumentId),
        note: it.note ?? null,
        orderIndex: it.orderIndex ?? idx,
      }));

      await storage.replaceTaskMaterials(taskId, items as any);

      // SPLIT-020: Sync entire material set to siblings if independentMaterials = false
      const task = await storage.getScheduleTask(taskId);
      if (task) {
        const taskData = task as any;
        if (taskData.splitGroupId && !taskData.independentMaterials) {
          // Get siblings with independentMaterials = false
          const siblings = await storage.getSplitSiblings(taskId);
          const siblingsToSync = siblings.filter((s: any) => 
            s.id !== taskId && !s.independentMaterials
          );

          // Replace materials for each sibling
          for (const sibling of siblingsToSync) {
            await storage.replaceTaskMaterials((sibling as any).id, items as any);
          }
        }
      }

      const updated = await storage.getTaskMaterials(taskId);
      return res.status(200).json(updated as any);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Replace task materials failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.taskMaterials.add.path, async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      if (!Number.isFinite(taskId) || taskId <= 0) {
        return res.status(400).json({ message: "Invalid schedule task id" });
      }

      const input = api.taskMaterials.add.input.parse(req.body);
      const materialData = {
        projectMaterialId: Number(input.projectMaterialId),
        batchId: input.batchId == null ? null : Number(input.batchId),
        qualityDocumentId: input.qualityDocumentId == null ? null : Number(input.qualityDocumentId),
        note: input.note ?? null,
        orderIndex: input.orderIndex,
      };

      const created = await storage.createTaskMaterial(taskId, materialData as any);

      // SPLIT-018: Sync material to split siblings if needed
      const task = await storage.getScheduleTask(taskId);
      if (task) {
        const taskData = task as any;
        if (taskData.splitGroupId && !taskData.independentMaterials) {
          await storage.syncMaterialsAcrossSplitGroup(taskId, [materialData as any]);
        }
      }

      return res.status(201).json(created as any);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Add task material failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete(api.taskMaterials.remove.path, async (req, res) => {
    try {
      const materialId = Number(req.params.materialId);
      if (!Number.isFinite(materialId) || materialId <= 0) {
        return res.status(400).json({ message: "Invalid material id" });
      }

      // SPLIT-019: Get taskId before deletion for sync
      const materials = await storage.getTaskMaterials(Number(req.params.id));
      const material = materials.find((m: any) => m.id === materialId);
      const taskId = material ? (material as any).taskId : null;

      const ok = await storage.deleteTaskMaterial(materialId);
      if (!ok) return res.status(404).json({ message: "Not found" });

      // Sync deletion across split group if needed
      if (taskId) {
        const task = await storage.getScheduleTask(taskId);
        if (task) {
          const taskData = task as any;
          if (taskData.splitGroupId && !taskData.independentMaterials) {
            await storage.syncMaterialDeleteAcrossSplitGroup(taskId, materialId);
          }
        }
      }

      return res.status(204).send();
    } catch (err) {
      console.error("Delete task material failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Estimate routes — extracted to server/routes/estimates.ts
  registerEstimateRoutes(app);

  // Act Templates
  app.get("/api/act-templates", async (_req, res) => {
    try {
      const templates = await storage.getActTemplates();
      
      // If no templates in DB, load from catalog file
      if (templates.length === 0) {
        const catalog = loadTemplateCatalog();
        const templatesData = catalog.templates.map((t: any) => ({
          templateId: t.id,
          code: t.code,
          category: t.category,
          title: t.title,
          titleEn: t.titleEn,
          description: t.description,
          normativeRef: t.normativeRef,
          isActive: true,
        }));
        await storage.seedActTemplates(templatesData);
        const seeded = await storage.getActTemplates();
        return res.json({ templates: seeded, categories: catalog.categories });
      }
      
      const catalog = loadTemplateCatalog();
      res.json({ templates, categories: catalog.categories });
    } catch (err) {
      console.error("Error fetching act templates:", err);
      res.status(500).json({ message: "Failed to load templates" });
    }
  });

  // Generate PDF for act
  app.post("/api/acts/:id/export", ...appAuth, async (req, res) => {
    try {
      const actId = Number(req.params.id);
      const act = await storage.getAct(actId);
      if (!act) {
        return res.status(404).json({ message: "Act not found" });
      }

      const { templateIds, formData } = req.body ?? {};

      // Resolve object-scoped source data (MVP: single current object)
      const objectId = (act as any).objectId ?? (await storage.getCurrentObject(req.user!.id)).id;
      const sourceData = await storage.getObjectSourceData(Number(objectId));
      const objectActData = buildActDataFromSourceData(sourceData);
      const dbP3MaterialsText = await buildP3MaterialsText(actId);
      const dbAttachmentsText = await buildAttachmentsText(actId);

      // Allow exporting without explicit templates (for acts generated from schedule).
      // Strategy:
      // - if templateIds provided -> use them
      // - else use act.actTemplateId (single act type)
      // - else try act_template_selections (legacy)
      // - else generate a single "default" AOSR PDF using worksData aggregated from the act
      let effectiveTemplateIds: string[] = Array.isArray(templateIds) ? templateIds : [];
      if (effectiveTemplateIds.length === 0) {
        const actTemplateId = (act as any).actTemplateId as number | null | undefined;
        if (actTemplateId != null) {
          const tpl = await storage.getActTemplate(Number(actTemplateId));
          if (tpl?.templateId) effectiveTemplateIds.push(tpl.templateId);
        }
      }
      if (effectiveTemplateIds.length === 0) {
        const selections = await storage.getActTemplateSelections(actId);
        for (const s of selections) {
          const tpl = await storage.getActTemplate(Number((s as any).templateId));
          if (tpl?.templateId) effectiveTemplateIds.push(tpl.templateId);
        }
      }

      // Ensure generated PDFs directory exists
      const pdfDir = path.join(process.cwd(), "generated_pdfs");
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }

      const generatedFiles: { templateId: string; filename: string; url: string }[] = [];

      // Вычисляем p1Works один раз (авто из worksData + переопределение через formData)
      const p1WorksAuto =
        Array.isArray(act.worksData) && act.worksData.length > 0
          ? act.worksData
              .map((w, idx) => {
                const qty = typeof (w as any).quantity === "number" ? (w as any).quantity : 0;
                const desc = String((w as any).description ?? "").trim();
                const line = desc || `workId ${(w as any).workId ?? ""}`.trim();
                return `${idx + 1}. ${line}${qty ? ` — ${qty}` : ""}`;
              })
              .join("\n")
          : "";
      const p1Works = formData?.p1Works || p1WorksAuto;

      if (effectiveTemplateIds.length === 0) {
        const actNumber = formData?.actNumber || String(act.actNumber ?? act.id);
        const actDate = formData?.actDate || String(act.dateEnd ?? new Date().toISOString().split("T")[0]);

        const actProjectDrawingsAgg = String((act as any).projectDrawingsAgg ?? "").trim();
        const actNormativeRefsAgg = String((act as any).normativeRefsAgg ?? "").trim();
        const schemesAggRaw = (act as any).executiveSchemesAgg;
        const schemesAgg = Array.isArray(schemesAggRaw) ? schemesAggRaw : [];
        const schemesText = schemesAgg
          .map((s: any) => {
            const title = String(s?.title ?? "").trim();
            const fileUrl = String(s?.fileUrl ?? "").trim();
            if (!title) return "";
            return fileUrl ? `Исполнительная схема: ${title} — ${fileUrl}` : `Исполнительная схема: ${title}`;
          })
          .filter(Boolean)
          .join("\n");
        const combinedDbAttachmentsText = [String(dbAttachmentsText || "").trim(), schemesText].filter(Boolean).join("\n");

        const actData: ActData = {
          ...objectActData,
          actNumber,
          actDate,
          city: formData?.city ?? objectActData.city ?? "Москва",
          objectName: formData?.objectName ?? objectActData.objectName ?? "Объект строительства",
          objectAddress: formData?.objectAddress ?? objectActData.objectAddress ?? act.location ?? "Адрес объекта",
          workDescription: formData?.workDescription || "Работы по акту (из графика)",
          dateStart: act.dateStart || new Date().toISOString().split("T")[0],
          dateEnd: act.dateEnd || new Date().toISOString().split("T")[0],
          p1Works,

          // эталонные поля (005_АОСР 4)
          objectFullName: formData?.objectFullName ?? objectActData.objectFullName,
          developerOrgFull: formData?.developerOrgFull ?? objectActData.developerOrgFull,
          builderOrgFull: formData?.builderOrgFull ?? objectActData.builderOrgFull,
          designerOrgFull: formData?.designerOrgFull ?? objectActData.designerOrgFull,
          repCustomerControlLine: formData?.repCustomerControlLine ?? objectActData.repCustomerControlLine,
          repCustomerControlOrder: formData?.repCustomerControlOrder ?? objectActData.repCustomerControlOrder,
          repBuilderLine: formData?.repBuilderLine ?? objectActData.repBuilderLine,
          repBuilderOrder: formData?.repBuilderOrder ?? objectActData.repBuilderOrder,
          repBuilderControlLine: formData?.repBuilderControlLine ?? objectActData.repBuilderControlLine,
          repBuilderControlOrder: formData?.repBuilderControlOrder ?? objectActData.repBuilderControlOrder,
          repDesignerLine: formData?.repDesignerLine ?? objectActData.repDesignerLine,
          repDesignerOrder: formData?.repDesignerOrder ?? objectActData.repDesignerOrder,
          repWorkPerformerLine: formData?.repWorkPerformerLine ?? objectActData.repWorkPerformerLine,
          repWorkPerformerOrder: formData?.repWorkPerformerOrder ?? objectActData.repWorkPerformerOrder,
          p2ProjectDocs: formData?.p2ProjectDocs ?? actProjectDrawingsAgg,
          p3MaterialsText: formData?.p3MaterialsText ?? (dbP3MaterialsText || objectActData.p3MaterialsText),
          p4AsBuiltDocs: formData?.p4AsBuiltDocs ?? objectActData.p4AsBuiltDocs,
          p6NormativeRefs: formData?.p6NormativeRefs ?? actNormativeRefsAgg,
          p7NextWorks: formData?.p7NextWorks ?? objectActData.p7NextWorks,
          additionalInfo: formData?.additionalInfo ?? objectActData.additionalInfo,
          copiesCount: formData?.copiesCount ?? objectActData.copiesCount,
          attachments: Array.isArray(formData?.attachments) ? formData.attachments : undefined,
          attachmentsText: formData?.attachmentsText ?? (combinedDbAttachmentsText || objectActData.attachmentsText),
          sigCustomerControl: formData?.sigCustomerControl ?? objectActData.sigCustomerControl,
          sigBuilder: formData?.sigBuilder ?? objectActData.sigBuilder,
          sigBuilderControl: formData?.sigBuilderControl ?? objectActData.sigBuilderControl,
          sigDesigner: formData?.sigDesigner ?? objectActData.sigDesigner,
          sigWorkPerformer: formData?.sigWorkPerformer ?? objectActData.sigWorkPerformer,
        };

        const pdfBuffer = await generateAosrPdf(actData);
        const safeActNumber = String(actNumber).replace(/[^0-9A-Za-z_-]+/g, "_");
        const filename = `aosr-act-${safeActNumber}.pdf`;
        const filePath = path.join(pdfDir, filename);
        fs.writeFileSync(filePath, pdfBuffer);
        generatedFiles.push({ templateId: "default", filename, url: `/api/pdfs/${filename}` });

        return res.json({ files: generatedFiles });
      }

      for (const templateId of effectiveTemplateIds) {
        const template = await storage.getActTemplateByTemplateId(templateId);
        if (!template) continue;

        // Build act data from form and database
        const actProjectDrawingsAgg = String((act as any).projectDrawingsAgg ?? "").trim();
        const actNormativeRefsAgg = String((act as any).normativeRefsAgg ?? "").trim();
        const schemesAggRaw = (act as any).executiveSchemesAgg;
        const schemesAgg = Array.isArray(schemesAggRaw) ? schemesAggRaw : [];
        const schemesText = schemesAgg
          .map((s: any) => {
            const title = String(s?.title ?? "").trim();
            const fileUrl = String(s?.fileUrl ?? "").trim();
            if (!title) return "";
            return fileUrl ? `Исполнительная схема: ${title} — ${fileUrl}` : `Исполнительная схема: ${title}`;
          })
          .filter(Boolean)
          .join("\n");
        const combinedDbAttachmentsText = [String(dbAttachmentsText || "").trim(), schemesText].filter(Boolean).join("\n");

        const actData: ActData = {
          ...objectActData,
          actNumber: formData?.actNumber || String(act.actNumber ?? act.id),
          // "Дата составления" по умолчанию = дата окончания акта (если есть)
          actDate: formData?.actDate || String(act.dateEnd ?? new Date().toISOString().split("T")[0]),

          // legacy fields (оставляем для обратной совместимости/фолбэков)
          city: formData?.city ?? objectActData.city ?? "Москва",
          objectName: formData?.objectName ?? objectActData.objectName ?? "Объект строительства",
          objectAddress: formData?.objectAddress ?? objectActData.objectAddress ?? act.location ?? "Адрес объекта",
          developerRepName: formData?.developerRepName || objectActData.developerRepName || "",
          developerRepPosition: formData?.developerRepPosition || objectActData.developerRepPosition || "",
          contractorRepName: formData?.contractorRepName || objectActData.contractorRepName || "",
          contractorRepPosition: formData?.contractorRepPosition || objectActData.contractorRepPosition || "",
          supervisorRepName: formData?.supervisorRepName || objectActData.supervisorRepName || "",
          supervisorRepPosition: formData?.supervisorRepPosition || objectActData.supervisorRepPosition || "",

          workDescription: template.description || template.title,
          projectDocumentation: formData?.projectDocumentation || objectActData.projectDocumentation || "Рабочая документация",
          dateStart: act.dateStart || new Date().toISOString().split("T")[0],
          dateEnd: act.dateEnd || new Date().toISOString().split("T")[0],
          qualityDocuments: formData?.qualityDocuments || "Сертификаты, паспорта качества",
          materials: formData?.materials,
          p1Works,

          // эталонные поля (005_АОСР 4)
          objectFullName: formData?.objectFullName ?? objectActData.objectFullName,
          developerOrgFull: formData?.developerOrgFull ?? objectActData.developerOrgFull,
          builderOrgFull: formData?.builderOrgFull ?? objectActData.builderOrgFull,
          designerOrgFull: formData?.designerOrgFull ?? objectActData.designerOrgFull,

          repCustomerControlLine: formData?.repCustomerControlLine ?? objectActData.repCustomerControlLine,
          repCustomerControlOrder: formData?.repCustomerControlOrder ?? objectActData.repCustomerControlOrder,
          repBuilderLine: formData?.repBuilderLine ?? objectActData.repBuilderLine,
          repBuilderOrder: formData?.repBuilderOrder ?? objectActData.repBuilderOrder,
          repBuilderControlLine: formData?.repBuilderControlLine ?? objectActData.repBuilderControlLine,
          repBuilderControlOrder: formData?.repBuilderControlOrder ?? objectActData.repBuilderControlOrder,
          repDesignerLine: formData?.repDesignerLine ?? objectActData.repDesignerLine,
          repDesignerOrder: formData?.repDesignerOrder ?? objectActData.repDesignerOrder,
          repWorkPerformerLine: formData?.repWorkPerformerLine ?? objectActData.repWorkPerformerLine,
          repWorkPerformerOrder: formData?.repWorkPerformerOrder ?? objectActData.repWorkPerformerOrder,

          p2ProjectDocs: formData?.p2ProjectDocs ?? actProjectDrawingsAgg,
          p3MaterialsText: formData?.p3MaterialsText ?? (dbP3MaterialsText || objectActData.p3MaterialsText),
          p4AsBuiltDocs: formData?.p4AsBuiltDocs ?? objectActData.p4AsBuiltDocs,
          p6NormativeRefs: formData?.p6NormativeRefs ?? actNormativeRefsAgg,
          p7NextWorks: formData?.p7NextWorks ?? objectActData.p7NextWorks,
          additionalInfo: formData?.additionalInfo ?? objectActData.additionalInfo,
          copiesCount: formData?.copiesCount ?? objectActData.copiesCount,

          attachments: Array.isArray(formData?.attachments) ? formData.attachments : undefined,
          attachmentsText: formData?.attachmentsText ?? (combinedDbAttachmentsText || objectActData.attachmentsText),

          sigCustomerControl: formData?.sigCustomerControl ?? objectActData.sigCustomerControl,
          sigBuilder: formData?.sigBuilder ?? objectActData.sigBuilder,
          sigBuilderControl: formData?.sigBuilderControl ?? objectActData.sigBuilderControl,
          sigDesigner: formData?.sigDesigner ?? objectActData.sigDesigner,
          sigWorkPerformer: formData?.sigWorkPerformer ?? objectActData.sigWorkPerformer,
        };

        try {
          const pdfBuffer = await generateAosrPdf(actData);
          const filename = `AOSR_${template.code}_${act.id}_${Date.now()}.pdf`;
          const filePath = path.join(pdfDir, filename);
          fs.writeFileSync(filePath, pdfBuffer);

          generatedFiles.push({
            templateId: template.templateId,
            filename,
            url: `/api/pdfs/${filename}`,
          });
        } catch (pdfError) {
          console.error(`Error generating PDF for template ${templateId}:`, pdfError);
        }
      }

      res.json({
        success: true,
        files: generatedFiles,
        message: `Generated ${generatedFiles.length} PDF(s)`,
      });
    } catch (err) {
      console.error("Error exporting act:", err);
      res.status(500).json({ message: "Failed to export act" });
    }
  });

  // Serve generated PDFs
  app.get("/api/pdfs/:filename", (req, res) => {
    const requested = String(req.params.filename ?? "");
    const filename = path.basename(requested);
    if (!filename || filename !== requested) {
      return res.status(400).json({ message: "Invalid filename" });
    }
    if (!filename.toLowerCase().endsWith(".pdf")) {
      return res.status(400).json({ message: "Invalid file type" });
    }

    const filePath = path.join(process.cwd(), "generated_pdfs", filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }
    
    const download = req.query.download === "1" || req.query.download === "true";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${filename}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.sendFile(filePath);
  });

  // Deprecated: acts can be created only from schedule now.
  app.post("/api/acts/create-with-templates", async (_req, res) => {
    return res.status(410).json({
      message: "Эндпоинт устарел: акты АОСР теперь создаются только из графика работ (/schedule).",
    });
  });

  // Admin routes — extracted to server/routes/admin.ts
  registerAdminRoutes(app);

  return httpServer;
}

// Seed function
async function seedDatabase() {
  // No-op: works are now scoped per user/object and cannot be seeded without user context
}

// Run seed (dev-only, opt-in)
const enableDemoSeed =
  process.env.NODE_ENV !== "production" &&
  String(process.env.ENABLE_DEMO_SEED || "").toLowerCase() === "true";

if (enableDemoSeed) {
  seedDatabase().catch(console.error);
}
