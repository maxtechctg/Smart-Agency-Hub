// server/vite.ts

import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Dynamically import Vite only when running in dev.
 * This prevents Node from trying to resolve `vite` in production.
 */
export async function setupVite(app: Express, server: Server) {
  // All Vite-related code is only referenced in dev
  let viteModule: any;
  let viteConfig: any;
  let nanoid: any;
  try {
    viteModule = await import("vite");
    viteConfig = (await import("../vite.config.ts")).default;
    nanoid = (await import("nanoid")).nanoid;
  } catch (err) {
    console.error(
      "[server] Vite is not available. If you are trying to run in development, install vite locally:\n  npm install --save-dev vite",
    );
    throw err;
  }

  const { createServer: createViteServer, createLogger } = viteModule;
  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: any, options: any) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(__dirname, "..", "client", "index.html");

      // always reload the index.html file from disk in case it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      // try to fix stacktrace for easier debugging in dev
      if (typeof vite?.ssrFixStacktrace === "function") {
        vite.ssrFixStacktrace(e as Error);
      }
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // point to your production client build output (adjust if your client build uses a different folder)
  const distPath = path.resolve(__dirname, "..", "client", "dist");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the client build directory: ${distPath}. Make sure to run the client build before starting in production.`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
