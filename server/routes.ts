import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerAuthRoutes } from "./routes/auth";
import { registerAdminRoutes } from "./routes/admin";
import { registerMessageRoutes } from "./routes/messages";
import { registerWorksRoutes } from "./routes/works";
import { registerEstimateRoutes } from "./routes/estimates";
import { registerMaterialsRoutes } from "./routes/materials";
import { registerActsRoutes } from "./routes/acts";
import { registerScheduleRoutes } from "./routes/schedule";
import { registerObjectRoutes } from "./routes/objects";
import { registerVoiceRoutes } from "./routes/voice";
import { authMiddleware } from "./middleware/auth";
import { db } from "./db";
import { objects } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { getQuota } from "@shared/tariff-features";



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
  
  // Voice routes — extracted to server/routes/voice.ts
  registerVoiceRoutes(app);

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
