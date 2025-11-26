import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { schedulerService } from "./services/scheduler";
import { serializeRecord } from "./utils/serialize";

const app = express();

// Serve uploaded files (chat uploads, etc.) as static files
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Integrated logging + serialization middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: any = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    // Serialize the response payload based on type
    let serialized: any;
    
    if (bodyJson === null || bodyJson === undefined) {
      // Pass through null/undefined
      serialized = bodyJson;
    } else if (Array.isArray(bodyJson)) {
      // For arrays, map over items and serialize each object
      serialized = bodyJson.map(item => {
        if (item && typeof item === 'object' && !(item instanceof Date)) {
          return serializeRecord(item);
        }
        return item;
      });
    } else if (typeof bodyJson === 'object' && !(bodyJson instanceof Date)) {
      // For objects, use serializeRecord to handle nested Dates
      serialized = serializeRecord(bodyJson);
    } else {
      // For primitives (string, number, boolean), pass through
      serialized = bodyJson;
    }
    
    capturedJsonResponse = serialized;
    return originalResJson.apply(res, [serialized, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
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
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start scheduler for email reminders
    schedulerService.start();
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down gracefully');
    schedulerService.stop();
    server.close(() => {
      log('Server closed');
      process.exit(0);
    });
  });
})();
