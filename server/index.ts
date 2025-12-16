// server/index.ts
import "dotenv/config";

import express, { type Request, Response, NextFunction } from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
// NOTE: remove the static routes import!
// import { registerRoutes } from "./routes";
import { createSchedulerService } from "./services/scheduler";
import { serializeRecord } from "./utils/serialize";

import { createEmailService } from "./services/email";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = (...args: any[]) => console.log("[server]", ...args);

process.env.NODE_ENV = process.env.NODE_ENV || "development";
const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";

const app = express();

// typing for app.locals (optional)
declare module "express-serve-static-core" {
  interface Locals {
    emailService?: any;
  }
}

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

// Integrated logging + serialization middleware
app.use((req, res, next) => {
  const start = Date.now();
  const pathReq = req.path;
  let capturedJsonResponse: any = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    // Serialize the response payload based on type
    let serialized: any;

    if (bodyJson === null || bodyJson === undefined) {
      serialized = bodyJson;
    } else if (Array.isArray(bodyJson)) {
      serialized = bodyJson.map((item) => {
        if (item && typeof item === "object" && !(item instanceof Date)) {
          return serializeRecord(item);
        }
        return item;
      });
    } else if (typeof bodyJson === "object" && !(bodyJson instanceof Date)) {
      serialized = serializeRecord(bodyJson);
    } else {
      serialized = bodyJson;
    }

    capturedJsonResponse = serialized;
    // @ts-ignore - keep original signature
    return originalResJson.apply(res, [serialized, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (pathReq.startsWith("/api")) {
      let logLine = `${req.method} ${pathReq} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse !== undefined) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {

    const emailService = await createEmailService();

    // DYNAMICALLY import routes AFTER email service created
    const routesModule = await import("./routes");
    if (typeof routesModule.registerRoutes !== "function") {
      throw new Error("routes module does not export registerRoutes()");
    }
    const registerRoutes = routesModule.registerRoutes as (app: express.Express, emailService: any) => Promise<unknown>;
    await registerRoutes(app, emailService);

    // Create and start scheduler with emailService
    const schedulerService = createSchedulerService(emailService);

    // centralized error handler (after registerRoutes)
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      console.error("[server] Unhandled error:", err);
    });

    // create http server and attach vite or static serving...
    const httpServer = http.createServer(app);

    if (isDev) {
      const { setupVite } = await import("./vite.js");
      await setupVite(app, httpServer);
      log("Vite middleware configured (development)");
    } else {
      const { serveStatic } = await import("./vite.js");
      serveStatic(app);
      log("Configured static file serving (production)");
    }

    const port = parseInt(process.env.PORT || "5000", 10);
    const isWindows = process.platform === "win32";
    const host = process.env.HOST ?? (isWindows ? "127.0.0.1" : "0.0.0.0");

    httpServer.listen(port, host, () => {
      log(`Server running at http://${host}:${port}`);
      if (!isProd) {
        schedulerService.start();
        log("Scheduler service started (development)");
      } else {
        log("Scheduler service DISABLED in production (low-memory environment)");
      }
    });

    process.on("SIGTERM", () => {
      log("SIGTERM received, shutting down gracefully");
      if (!isProd) schedulerService.stop();
      httpServer.close(() => {
        log("Server closed");
        process.exit(0);
      });
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
})();
