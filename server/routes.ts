import type { Express } from "express";
import type { Server } from "http";
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
import { registerTariffRoutes } from "./routes/tariff";


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Register auth routes (login, register, JWT)
  await registerAuthRoutes(app);

  // Tariff routes — extracted to server/routes/tariff.ts
  registerTariffRoutes(app);

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
