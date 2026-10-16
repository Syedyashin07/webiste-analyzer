import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import type { Queue } from "bullmq";
import type Redis from "ioredis";
import { env } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { registerScanRoutes } from "./routes/scans.js";
import { registerBugRoutes } from "./routes/bugs.js";
import { registerEvidenceRoutes, registerReportRoutes } from "./routes/reports.js";
import { registerDashboardRoutes, registerSettingsRoutes } from "./routes/dashboard.js";
import { registerSiteRoutes } from "./routes/sites.js";
import { registerAuthRoutes } from "./routes/auth.js";
import type { ScanJobData } from "./lib/queue.js";
import { createLogger } from "@qa-scanner/shared";

const log = createLogger("api");

export async function buildApp(queue: Queue<ScanJobData>, redis: Redis) {
  const app = Fastify({ logger: false });
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    const text = typeof body === "string" ? body.trim() : "";
    if (!text) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(text) as unknown);
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  await app.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    redis,
    allowList: (request) => request.method === "GET",
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: "Validation failed", details: error.issues });
    }
    const err = error as { message?: string; statusCode?: number };
    log.error({ err: err.message }, "unhandled error");
    const status = typeof err.statusCode === "number" ? err.statusCode : 500;
    return reply.status(status).send({ error: err.message || "Internal error" });
  });

  app.get("/", async (_request, reply) => {
    return reply.redirect(env.FRONTEND_URL);
  });

  app.get("/api/health", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redis.ping();
      return { ok: true, database: "up", redis: "up" };
    } catch (error) {
      return reply.status(503).send({
        ok: false,
        error: error instanceof Error ? error.message : "Health check failed",
      });
    }
  });

  registerAuthRoutes(app);
  registerDashboardRoutes(app);
  registerSiteRoutes(app);
  registerScanRoutes(app, queue, redis);
  registerBugRoutes(app);
  registerReportRoutes(app);
  registerEvidenceRoutes(app);
  registerSettingsRoutes(app, queue, redis);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  return app;
}
