import type { FastifyInstance } from "fastify";
import type { Queue } from "bullmq";
import type Redis from "ioredis";
import { isDetailedEvidenceBug, settingsSchema } from "@qa-scanner/shared";
import { prisma } from "../lib/prisma.js";
import { countFailedApis } from "../lib/failed-apis.js";
import { getLocalContext } from "../services/local-context.js";
import { assertWorkflowOwner } from "../lib/scan-access.js";
import { resetProjectData } from "../services/reset-data.js";
import type { ScanJobData } from "../lib/queue.js";

export function registerSettingsRoutes(app: FastifyInstance, queue: Queue<ScanJobData>, redis: Redis) {
  app.get("/api/settings", async () => {
    const { settings, user } = await getLocalContext();
    return { settings: settings ?? { userId: user.id } };
  });

  app.put("/api/settings", async (request) => {
    const body = settingsSchema.parse(request.body);
    const { user } = await getLocalContext();
    const settings = await prisma.appSettings.upsert({
      where: { userId: user.id },
      update: body,
      create: { ...body, userId: user.id },
    });
    return { settings };
  });

  app.post("/api/settings/reset-data", { config: { rateLimit: { max: 3, timeWindow: "1 minute" } } }, async () => {
    const result = await resetProjectData(queue, redis);
    return { ok: true, ...result };
  });
}

export function registerDashboardRoutes(app: FastifyInstance) {
  app.get("/api/dashboard", async () => {
    const totalScans = await prisma.scan.count();
    const latest = await prisma.scan.findFirst({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { bugs: true, pages: true } } },
    });
    const latestBugs = latest
      ? await prisma.bug.findMany({
          where: { scanId: latest.id },
          select: { severity: true, category: true, title: true, description: true, actual: true },
        })
      : [];
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const bug of latestBugs) {
      if (!isDetailedEvidenceBug(bug)) continue;
      counts[bug.severity] += 1;
    }
    let stats = {
      elements: 0,
      forms: 0,
      links: 0,
      apiFailures: 0,
      consoleErrors: 0,
      accessibilityIssues: 0,
      visualIssues: 0,
    };
    if (latest) {
      const pages = await prisma.page.findMany({
        where: { scanId: latest.id },
        select: { _count: { select: { elements: true, forms: true, links: true, accessibility: true } } },
      });
      stats = {
        elements: pages.reduce((sum, page) => sum + page._count.elements, 0),
        forms: pages.reduce((sum, page) => sum + page._count.forms, 0),
        links: pages.reduce((sum, page) => sum + page._count.links, 0),
        apiFailures: await countFailedApis(latest.id),
        consoleErrors: await prisma.consoleError.count({ where: { scanId: latest.id } }),
        accessibilityIssues: pages.reduce((sum, page) => sum + page._count.accessibility, 0),
        visualIssues: await prisma.bug.count({ where: { scanId: latest.id, category: "VISUAL" } }),
      };
    }
    return {
      totalScans,
      latest,
      counts,
      stats,
    };
  });

  app.get("/api/compare", async (request, reply) => {
    const query = request.query as { scanAId?: string; scanBId?: string };
    if (!query.scanAId || !query.scanBId) {
      return reply.status(400).send({ error: "scanAId and scanBId are required" });
    }
    if (!(await assertWorkflowOwner(request, reply, query.scanAId))) return reply;
    if (!(await assertWorkflowOwner(request, reply, query.scanBId))) return reply;
    const [a, b] = await Promise.all([
      prisma.scan.findUnique({ where: { id: query.scanAId }, include: { bugs: true } }),
      prisma.scan.findUnique({ where: { id: query.scanBId }, include: { bugs: true } }),
    ]);
    if (!a || !b) return reply.status(404).send({ error: "Scan not found" });

    const mapA = new Map(a.bugs.map((bug) => [bug.fingerprint, bug]));
    const mapB = new Map(b.bugs.map((bug) => [bug.fingerprint, bug]));
    const newBugs = b.bugs.filter((bug) => !mapA.has(bug.fingerprint));
    const fixedBugs = a.bugs.filter((bug) => !mapB.has(bug.fingerprint));
    const unchanged = b.bugs.filter((bug) => mapA.has(bug.fingerprint));
    const regressions = newBugs.filter((bug) => bug.severity === "CRITICAL" || bug.severity === "HIGH");

    return {
      scanA: summarize(a),
      scanB: summarize(b),
      healthDelta: (b.overallScore ?? 0) - (a.overallScore ?? 0),
      performanceDelta: (b.performanceScore ?? 0) - (a.performanceScore ?? 0),
      pageCountDelta: b.pagesScanned - a.pagesScanned,
      newBugs,
      fixedBugs,
      unchangedBugs: unchanged,
      regressions,
    };
  });
}

function summarize(scan: {
  id: string;
  url: string;
  overallScore: number | null;
  performanceScore: number | null;
  pagesScanned: number;
  confirmedBugs: number;
}) {
  return {
    id: scan.id,
    url: scan.url,
    overallScore: scan.overallScore,
    performanceScore: scan.performanceScore,
    pagesScanned: scan.pagesScanned,
    confirmedBugs: scan.confirmedBugs,
  };
}
