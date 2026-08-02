import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { telegramAuthMiddleware } from "./middleware/telegramAuth";
import { handleMcpRequest, mcpBodyErrorHandler, mcpBodyParser, mcpRateLimiter } from "./mcp/httpTransport";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// CORS configuration — must run before every route, including /mcp.
app.use((req, res, next) => {
  const origin = req.get('origin') || req.get('referer')?.split('/').slice(0, 3).join('/');
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// MCP endpoint (Streamable HTTP, stateless). Mounted BEFORE the app-wide body parser
// and Telegram auth middleware below, on purpose:
//   - its own body parser enforces a real 256kb limit instead of inheriting the
//     10mb REST limit (which would already have consumed/allowed the body by the
//     time a route-only check ran);
//   - it must not depend on Telegram init-data resolution, which is REST/MiniApp
//     specific and irrelevant to MCP's Bearer-JWT-only auth contract.
// Disabled by default; requires an explicit opt-in (MCP_ENABLED=true), especially
// in production, since it never touches REST behavior when off.
const mcpEnabled = process.env.MCP_ENABLED === "true";
if (mcpEnabled) {
  app.all("/mcp", mcpRateLimiter, mcpBodyParser, mcpBodyErrorHandler, handleMcpRequest);
}

app.use(
  express.json({
    limit: '10mb', // Увеличен лимит для импорта смет с большим количеством ресурсов
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ limit: '10mb', extended: false }));

// Telegram authentication middleware (устанавливает req.telegramUser если есть X-Telegram-Init-Data)
app.use(telegramAuthMiddleware({ required: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
