import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { getOpenAIClient } from "./routes/_openai";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { telegramAuthMiddleware } from "./middleware/telegramAuth";
import { registerAuthRoutes } from "./routes/auth";
import { registerAdminRoutes } from "./routes/admin";
import { registerMessageRoutes } from "./routes/messages";
import { registerWorksRoutes } from "./routes/works";
import { registerEstimateRoutes } from "./routes/estimates";
import { registerMaterialsRoutes } from "./routes/materials";
import { registerActsRoutes } from "./routes/acts";
import { registerScheduleRoutes } from "./routes/schedule";
import { authMiddleware } from "./middleware/auth";
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

  // Works routes — extracted to server/routes/works.ts
  registerWorksRoutes(app);

  // Message routes — extracted to server/routes/messages.ts
  registerMessageRoutes(app);

  // Schedule routes — extracted to server/routes/schedule.ts
  registerScheduleRoutes(app);


  // Estimate routes — extracted to server/routes/estimates.ts
  registerEstimateRoutes(app);

  // Acts routes — extracted to server/routes/acts.ts
  registerActsRoutes(app);

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
