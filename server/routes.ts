import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { getOpenAIClient } from "./routes/_openai";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { registerAuthRoutes } from "./routes/auth";
import { registerAdminRoutes } from "./routes/admin";
import { registerMessageRoutes } from "./routes/messages";
import { registerWorksRoutes } from "./routes/works";
import { registerEstimateRoutes } from "./routes/estimates";
import { registerMaterialsRoutes } from "./routes/materials";
import { registerActsRoutes } from "./routes/acts";
import { registerScheduleRoutes } from "./routes/schedule";
import { registerObjectRoutes } from "./routes/objects";
import { authMiddleware } from "./middleware/auth";
import { db } from "./db";
import { objects } from "@shared/schema";
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

  // Object routes — extracted to server/routes/objects.ts
  registerObjectRoutes(app);

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
