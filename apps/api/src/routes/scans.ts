import type { FastifyInstance } from "fastify";
import type { Queue } from "bullmq";
import type Redis from "ioredis";
import {
  assertSafeScanTarget,
  coverageLabel,
  coverageLimits,
  createScanSchema,
  hostOf,
  isDetailedEvidenceBug,
  normalizeUrl,
  resolveScanCoverage,
  sanitizeFilePart,
  screenshotFileName,
  uniqueScreenshotCaptions,
} from "@qa-scanner/shared";
import { env } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { emitScanEvent, getScanLiveState, isPaused, markCancelled, markPaused, markResumed } from "../lib/events.js";
import { readStoredFile, removeScanFiles } from "../lib/storage.js";
import { zipStoredFiles } from "../lib/zip.js";
import { buildFlowPdf, buildScanPpt } from "@qa-scanner/report-engine";
import type { ScanJobData } from "../lib/queue.js";
import { queuedWaitMessage } from "../lib/queue-health.js";
import { countFailedApis, listFailedApis, replayNetworkErrors } from "../lib/failed-apis.js";
import { getLocalContext } from "../services/local-context.js";
import { ensureSite, siteNameFromUrl } from "../services/sites.js";
import { readSessionUser } from "../lib/session.js";
import { assertWorkflowOwner } from "../lib/scan-access.js";
import { workflowReport } from "../services/workflow-store.js";

function queryText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function registerScanRoutes(app: FastifyInstance, queue: Queue<ScanJobData>, redis: Redis) {
  app.addHook("preHandler", async (request, reply) => {
    const path = request.url.split("?")[0] ?? "";
    const match = path.match(/^\/api\/scans\/([^/]+)/);
    if (!match) return;
    const allowed = await assertWorkflowOwner(request, reply, match[1]);
    if (!allowed) return reply;
  });

  app.post("/api/scans", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = createScanSchema.parse(request.body);
    const normalized = normalizeUrl(body.url);
    const safety = await assertSafeScanTarget(normalized, { allowLocal: env.ALLOW_LOCAL_TARGETS });
    if (!safety.ok) {
      return reply.status(400).send({ error: safety.reason ?? "URL is not allowed" });
    }

    const workflow = body.coverage === "WORKFLOW";
    const session = await readSessionUser(request);
    if (workflow && !session) {
      return reply.status(401).send({ error: "Sign in before starting an autonomous workflow scan" });
    }
    const local = workflow ? null : await getLocalContext();
    const userId = workflow ? session!.id : local!.user.id;
    const settings = workflow ? await prisma.appSettings.findUnique({ where: { userId } }) : local!.settings;
    const project = await ensureSite(userId, body.name?.trim() || siteNameFromUrl(normalized));
    const existing = await prisma.scan.findFirst({
      where: {
        projectId: project.id,
        url: normalized,
        status: {
          in: [
            "QUEUED",
            "INITIALIZING",
            "CRAWLING",
            "SCANNING",
            "ANALYZING",
            "VERIFYING",
            "GENERATING_REPORT",
            "PAUSED",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return reply.status(409).send({
        error: "A scan of this website is already running or queued. Open that scan instead of starting another.",
        scanId: existing.id,
        status: existing.status,
      });
    }

    const limits = coverageLimits(body.coverage, body, {
      maxPages: settings?.defaultMaxPages ?? env.SCAN_MAX_PAGES,
      maxDepth: settings?.defaultMaxDepth ?? env.SCAN_MAX_DEPTH,
    });
    const scan = await prisma.scan.create({
      data: {
        projectId: project.id,
        url: normalized,
        host: hostOf(normalized),
        status: "QUEUED",
        configuration: {
          create: {
            maxPages: limits.maxPages,
            maxDepth: limits.maxDepth,
            coverage: body.coverage ?? "FULL",
            dataSeed: body.dataSeed,
            authorizedTest: body.coverage === "WORKFLOW",
            viewport: body.coverage === "SCREENSHOTS" ? "DESKTOP" : (body.viewport ?? (settings?.viewport as "DESKTOP") ?? "DESKTOP"),
            captureScreenshots:
              body.coverage === "SCREENSHOTS" || body.coverage === "INSIDE"
                ? true
                : body.coverage === "FULL"
                  ? false
                  : (body.captureScreenshots ?? settings?.screenshotEnabled ?? true),
            recordVideos: body.coverage === "SCREENSHOTS" ? false : (body.recordVideos ?? settings?.videoEnabled ?? true),
            aiAnalysis: body.coverage === "SCREENSHOTS" ? false : (body.aiAnalysis ?? settings?.aiEnabled ?? true),
            runFunctionalTests: body.coverage === "SCREENSHOTS" ? false : body.coverage === "INSIDE" || body.coverage === "WORKFLOW" ? true : (body.runFunctionalTests ?? true),
            runAccessibility: body.coverage === "SCREENSHOTS" ? false : (body.runAccessibility ?? true),
            runPerformance: body.coverage === "SCREENSHOTS" ? false : (body.runPerformance ?? true),
            runSeo: body.coverage === "SCREENSHOTS" ? false : (body.runSeo ?? true),
            runSecurity: body.coverage === "SCREENSHOTS" ? false : (body.runSecurity ?? true),
            timeoutMs: settings?.timeoutMs ?? env.SCAN_TIMEOUT_MS,
            crawlDelayMs: settings?.crawlDelayMs ?? env.SCAN_CRAWL_DELAY_MS,
            concurrency: body.coverage === "SCREENSHOTS" || body.coverage === "INSIDE" || body.coverage === "WORKFLOW" ? 1 : (settings?.concurrency ?? env.SCAN_CONCURRENCY),
            respectRobotsTxt: settings?.respectRobotsTxt ?? true,
            testMode: body.coverage === "INSIDE" ? "DEEP" : (body.testMode ?? "STANDARD"),
            browserEngine: body.browserEngine ?? settings?.browser ?? "chromium",
          },
        },
      },
    });

    await queue.add(
      "scan",
      {
        scanId: scan.id,
        loginUsername: body.loginUsername,
        loginPassword: body.loginPassword,
        loginUrl: body.loginUrl,
      },
      { jobId: scan.id },
    );
    await emitScanEvent(redis, scan.id, "scan.started", `${coverageLabel(body.coverage ?? "FULL")} scan queued`, {
      url: normalized,
      coverage: body.coverage ?? "FULL",
    });
    await prisma.project.update({ where: { id: project.id }, data: { updatedAt: new Date() } });
    return reply.status(201).send({ scanId: scan.id, status: "QUEUED", siteId: project.id, siteName: project.name });
  });

  app.get("/api/scans", async (request) => {
    const projectId = queryText((request.query as { projectId?: unknown }).projectId);
    const session = await readSessionUser(request);
    const { user } = await getLocalContext();
    const scans = await prisma.scan.findMany({
      where: {
        AND: [
          projectId ? { projectId } : {},
          {
            OR: [
              { project: { userId: user.id }, NOT: { configuration: { is: { coverage: "WORKFLOW" } } } },
              ...(session ? [{ project: { userId: session.id }, configuration: { is: { coverage: "WORKFLOW" } } }] : []),
            ],
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { configuration: true, project: { select: { id: true, name: true } } },
    });
    return {
      scans: scans.map((scan) => {
        const coverage = resolveScanCoverage(scan.configuration);
        return { ...scan, coverage, coverageLabel: coverageLabel(coverage) };
      }),
    };
  });

  app.get("/api/scans/:id/workflow", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await prisma.scan.findUnique({ where: { id }, select: { id: true } });
    if (!scan) return reply.status(404).send({ error: "Scan not found" });
    return workflowReport(id);
  });

  app.get("/api/scans/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await prisma.scan.findUnique({
      where: { id },
      include: {
        configuration: true,
        reports: true,
        project: { select: { id: true, name: true } },
        _count: { select: { pages: true, bugs: true } },
      },
    });
    if (!scan) return reply.status(404).send({ error: "Scan not found" });
    const live = await getScanLiveState(redis, id);
    const paused = await isPaused(redis, id);
    const waitingMessage = await queuedWaitMessage(queue, id, scan.status);
    const failedApis = await listFailedApis(id);
    const pageStats = await prisma.page.findMany({
      where: { scanId: id },
      select: { _count: { select: { elements: true, forms: true, links: true, images: true, accessibility: true } } },
    });
    const [brokenLinks, brokenImages] = await Promise.all([
      prisma.pageLink.count({ where: { page: { scanId: id }, isBroken: true } }),
      prisma.pageImage.count({ where: { page: { scanId: id }, isBroken: true } }),
    ]);
    const coverage = resolveScanCoverage(scan.configuration);
    const linksFound = pageStats.reduce((sum, page) => sum + page._count.links, 0);
    const imagesFound = pageStats.reduce((sum, page) => sum + page._count.images, 0);
    return {
      scan: {
        ...scan,
        paused,
        currentUrl: live?.url ?? null,
        currentAction: live?.action ?? waitingMessage,
        coverage,
        coverageLabel: coverageLabel(coverage),
        elementsDiscovered: pageStats.reduce((sum, page) => sum + page._count.elements, 0),
        formsTested: pageStats.reduce((sum, page) => sum + page._count.forms, 0),
        linksTested: linksFound,
        imagesFound,
        brokenLinks,
        brokenImages,
        inventory: {
          coverage,
          coverageLabel: coverageLabel(coverage),
          pagesDiscovered: scan.pagesDiscovered,
          pagesScanned: scan.pagesScanned,
          pagesFailed: scan.pagesFailed,
          linksFound,
          brokenLinks,
          imagesFound,
          brokenImages,
          formsFound: pageStats.reduce((sum, page) => sum + page._count.forms, 0),
          elementsFound: pageStats.reduce((sum, page) => sum + page._count.elements, 0),
          apiFailures: failedApis.length,
        },
        apiFailures: failedApis.length,
        failedApis,
        consoleErrors: await prisma.consoleError.count({ where: { scanId: id } }),
        accessibilityIssues: pageStats.reduce((sum, page) => sum + page._count.accessibility, 0),
        visualIssues: await prisma.bug.count({ where: { scanId: id, category: "VISUAL" } }),
      },
    };
  });

  app.get("/api/scans/:id/progress", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await prisma.scan.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        progress: true,
        pagesDiscovered: true,
        pagesScanned: true,
        pagesFailed: true,
        issuesFound: true,
        confirmedBugs: true,
        errorMessage: true,
      },
    });
    if (!scan) return reply.status(404).send({ error: "Scan not found" });
    const events = await prisma.scanEvent.findMany({
      where: { scanId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const live = await getScanLiveState(redis, id);
    const paused = await isPaused(redis, id);
    const stats = await prisma.page.findMany({
      where: { scanId: id },
      select: {
        _count: { select: { elements: true, forms: true, links: true, accessibility: true } },
      },
    });
    const elementsDiscovered = stats.reduce((sum, page) => sum + page._count.elements, 0);
    const formsTested = stats.reduce((sum, page) => sum + page._count.forms, 0);
    const linksTested = stats.reduce((sum, page) => sum + page._count.links, 0);
    const accessibilityIssues = stats.reduce((sum, page) => sum + page._count.accessibility, 0);
    const [apiFailures, consoleErrors, visualIssues] = await Promise.all([
      countFailedApis(id),
      prisma.consoleError.count({ where: { scanId: id } }),
      prisma.bug.count({ where: { scanId: id, category: "VISUAL" } }),
    ]);
    return {
      ...scan,
      events,
      paused,
      currentUrl: live?.url ?? null,
      currentAction: live?.action ?? null,
      elementsDiscovered,
      formsTested,
      linksTested,
      buttonsTested: elementsDiscovered,
      apiFailures,
      consoleErrors,
      accessibilityIssues,
      visualIssues,
    };
  });

  app.get("/api/scans/:id/pages", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await prisma.scan.findUnique({ where: { id }, select: { id: true } });
    if (!scan) return reply.status(404).send({ error: "Scan not found" });
    const pages = await prisma.page.findMany({
      where: { scanId: id },
      orderBy: { discoveredAt: "asc" },
      include: {
        _count: { select: { links: true, images: true, forms: true, consoleErrors: true, networkErrors: true } },
        screenshots: { select: { id: true, kind: true, viewport: true }, orderBy: { createdAt: "asc" } },
      },
    });
    return { pages };
  });

  app.get("/api/scans/:id/screenshots.zip", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await prisma.scan.findUnique({
      where: { id },
      select: { id: true, host: true, configuration: true },
    });
    if (!scan) return reply.status(404).send({ error: "Scan not found" });
    const pages = await prisma.page.findMany({
      where: { scanId: id },
      orderBy: { discoveredAt: "asc" },
      include: { screenshots: { orderBy: { createdAt: "asc" } } },
    });
    const files: Array<{ name: string; data: Buffer }> = [];
    const used = new Set<string>();
    const labeled = uniqueScreenshotCaptions(pages);
    const oneFolder = resolveScanCoverage(scan.configuration) === "SCREENSHOTS";
    for (const page of labeled) {
      const folder = oneFolder
        ? "screenshots"
        : sanitizeFilePart(`${String(page.step).padStart(2, "0")}-${page.caption}`) || "page";
      for (const shot of page.screenshots) {
        if (!["DESKTOP", "TABLET", "MOBILE", "WIDE", "LAPTOP", "COMPACT", "original"].includes(shot.kind)) continue;
        const data = await readStoredFile(shot.storageKey, shot.mimeType);
        if (!data) continue;
        const fileBase = oneFolder
          ? screenshotFileName(page.flowName)
          : sanitizeFilePart(shot.kind || shot.viewport || "page") || "page";
        let name = `${folder}/${fileBase}.png`;
        if (used.has(name)) name = `${folder}/${fileBase}-${shot.id.slice(-6)}.png`;
        used.add(name);
        files.push({ name, data });
      }
    }
    if (files.length === 0) return reply.status(404).send({ error: "No screenshots captured yet" });
    const zip = zipStoredFiles(files);
    const fileName = `screenshots-${sanitizeFilePart(scan.host) || "scan"}-${id.slice(-6)}.zip`;
    return reply
      .header("Content-Type", "application/zip")
      .header("Content-Disposition", `attachment; filename="${fileName}"`)
      .send(zip);
  });

  app.get("/api/scans/:id/flow.pdf", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await prisma.scan.findUnique({
      where: { id },
      select: { id: true, url: true, host: true, configuration: true, project: { select: { name: true } } },
    });
    if (!scan) return reply.status(404).send({ error: "Scan not found" });
    if (resolveScanCoverage(scan.configuration) !== "SCREENSHOTS") {
      return reply.status(400).send({ error: "The flow PDF is available for screenshot scans" });
    }
    const pages = await prisma.page.findMany({
      where: { scanId: id },
      orderBy: { discoveredAt: "asc" },
      include: { screenshots: { orderBy: { createdAt: "asc" } } },
    });
    const labeled = uniqueScreenshotCaptions(pages);
    const slides: Array<{ step: number; name: string; url: string; imageDataUrl: string }> = [];
    for (const page of labeled) {
      const shot =
        ["DESKTOP", "original", "WIDE", "LAPTOP", "TABLET", "MOBILE", "COMPACT"]
          .map((kind) => page.screenshots.find((item) => item.kind === kind))
          .find(Boolean) ?? page.screenshots[0];
      if (!shot || !["DESKTOP", "TABLET", "MOBILE", "WIDE", "LAPTOP", "COMPACT", "original"].includes(shot.kind)) continue;
      const data = await readStoredFile(shot.storageKey, shot.mimeType);
      if (!data) continue;
      slides.push({
        step: slides.length + 1,
        name: page.flowName,
        url: page.url,
        imageDataUrl: `data:image/png;base64,${data.toString("base64")}`,
      });
      if (slides.length >= 60) break;
    }
    if (slides.length === 0) return reply.status(404).send({ error: "No screenshots captured yet" });
    const pdf = await buildFlowPdf({
      siteName: scan.project?.name || scan.host,
      website: scan.url,
      slides,
    });
    const fileName = `${sanitizeFilePart(scan.project?.name || scan.host) || "website"}-flow.pdf`;
    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="${fileName}"`)
      .send(pdf);
  });

  app.post("/api/scans/:id/presentation.pptx", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { name?: unknown; companyName?: unknown; template?: unknown };
    const presenterName = typeof body.name === "string" ? body.name.trim() : "";
    const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
    const template = body.template === "ivory" || body.template === "split" || body.template === "sand" || body.template === "ink"
      ? body.template
      : "";
    if (!presenterName || presenterName.length > 80 || !companyName || companyName.length > 80 || !template) {
      return reply.status(400).send({ error: "Enter a name, a company name, and a design." });
    }
    const scan = await prisma.scan.findUnique({
      where: { id },
      select: {
        id: true,
        url: true,
        host: true,
        status: true,
        completedAt: true,
        pagesScanned: true,
        pagesDiscovered: true,
        issuesFound: true,
        overallScore: true,
        performanceScore: true,
        accessibilityScore: true,
        seoScore: true,
        securityScore: true,
        functionalScore: true,
        visualScore: true,
        technicalScore: true,
        configuration: true,
        project: { select: { name: true } },
      },
    });
    if (!scan) return reply.status(404).send({ error: "Scan not found" });
    if (scan.status !== "COMPLETED") {
      return reply.status(409).send({ error: "The presentation is available after the scan completes." });
    }
    const pages = await prisma.page.findMany({
      where: { scanId: id },
      orderBy: { discoveredAt: "asc" },
      include: { screenshots: { orderBy: { createdAt: "asc" } } },
    });
    const labeled = uniqueScreenshotCaptions(pages);
    const shots: Array<{ name: string; url: string; png: Buffer }> = [];
    for (const page of labeled) {
      const shot =
        ["DESKTOP", "original", "WIDE", "LAPTOP", "TABLET", "MOBILE", "COMPACT"]
          .map((kind) => page.screenshots.find((item) => item.kind === kind))
          .find(Boolean) ?? page.screenshots[0];
      if (!shot || !["DESKTOP", "TABLET", "MOBILE", "WIDE", "LAPTOP", "COMPACT", "original"].includes(shot.kind)) continue;
      const data = await readStoredFile(shot.storageKey, shot.mimeType);
      if (!data) continue;
      shots.push({ name: page.flowName, url: page.url, png: data });
    }
    const bugs = (
      await prisma.bug.findMany({
        where: { scanId: id },
        orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
        select: { title: true, severity: true, category: true, url: true, description: true, actual: true },
      })
    )
      .filter((bug) =>
        isDetailedEvidenceBug({
          category: bug.category,
          title: bug.title,
          description: bug.description,
          actual: bug.actual,
        }),
      )
      .slice(0, 12);
    const ppt = await buildScanPpt({
      presenterName,
      companyName,
      siteName: scan.project?.name || scan.host,
      website: scan.url,
      coverageLabel: coverageLabel(resolveScanCoverage(scan.configuration)),
      completedAt: scan.completedAt?.toISOString() ?? null,
      pagesScanned: scan.pagesScanned,
      pagesDiscovered: scan.pagesDiscovered,
      issuesFound: scan.issuesFound,
      scores: [
        { label: "Overall", value: scan.overallScore },
        { label: "SEO", value: scan.seoScore },
        { label: "Performance", value: scan.performanceScore },
        { label: "Accessibility", value: scan.accessibilityScore },
        { label: "Security", value: scan.securityScore },
        { label: "Functional", value: scan.functionalScore },
        { label: "Visual", value: scan.visualScore },
        { label: "Technical", value: scan.technicalScore },
      ],
      pages: labeled.map((page) => ({ name: page.flowName, url: page.url })),
      shots,
      bugs,
      template,
    });
    const fileName = `${sanitizeFilePart(companyName) || "website"}-presentation.pptx`;
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation")
      .header("Content-Disposition", `attachment; filename="${fileName}"`)
      .send(ppt);
  });

  app.get("/api/scans/:id/pages/:pageId", async (request, reply) => {
    const { id, pageId } = request.params as { id: string; pageId: string };
    const page = await prisma.page.findFirst({
      where: { id: pageId, scanId: id },
      include: {
        links: true,
        images: true,
        forms: true,
        elements: true,
        screenshots: true,
        consoleErrors: true,
        networkErrors: true,
        performance: true,
        accessibility: true,
        seoIssues: true,
        securityIssues: true,
      },
    });
    if (!page) return reply.status(404).send({ error: "Page not found" });
    return { page };
  });

  app.get("/api/scans/:id/bugs", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await prisma.scan.findUnique({ where: { id }, select: { id: true } });
    if (!scan) return reply.status(404).send({ error: "Scan not found" });
    const bugs = await prisma.bug.findMany({
      where: { scanId: id },
      orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
      include: { evidence: { include: { screenshot: true } } },
    });
    return {
      bugs: bugs.filter((bug) =>
        isDetailedEvidenceBug({
          category: bug.category,
          title: bug.title,
          description: bug.description,
          actual: bug.actual,
        }),
      ),
    };
  });

  app.post("/api/scans/:id/replay-apis", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await prisma.scan.findUnique({ where: { id }, select: { id: true } });
    if (!scan) return reply.status(404).send({ error: "Scan not found" });
    const raw = (request.body ?? {}) as { ids?: unknown };
    const ids = Array.isArray(raw.ids)
      ? raw.ids.filter((value): value is string => typeof value === "string").slice(0, 40)
      : undefined;
    return replayNetworkErrors(id, ids?.length ? ids : undefined);
  });

  app.post("/api/scans/:id/cancel", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await prisma.scan.findUnique({ where: { id } });
    if (!scan) return reply.status(404).send({ error: "Scan not found" });
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(scan.status)) {
      return reply.status(409).send({ error: `Scan is already ${scan.status}` });
    }
    await markCancelled(redis, id);
    await prisma.scan.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    const job = await queue.getJob(id);
    if (job) {
      try {
        await job.remove();
      } catch {
        try {
          job.discard();
        } catch {
          /* already finished */
        }
      }
    }
    await emitScanEvent(redis, id, "scan.cancelled", "Scan cancelled by user");
    return { scanId: id, status: "CANCELLED" };
  });

  app.post("/api/scans/:id/pause", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await prisma.scan.findUnique({ where: { id } });
    if (!scan) return reply.status(404).send({ error: "Scan not found" });
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(scan.status)) {
      return reply.status(409).send({ error: `Scan is already ${scan.status}` });
    }
    await markPaused(redis, id, scan.status);
    await prisma.scan.update({ where: { id }, data: { status: "PAUSED" } });
    await emitScanEvent(redis, id, "scan.paused", "Scan paused. Collected results are kept.");
    return { scanId: id, status: "PAUSED" };
  });

  app.post("/api/scans/:id/resume", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await prisma.scan.findUnique({ where: { id } });
    if (!scan) return reply.status(404).send({ error: "Scan not found" });
    if (scan.status !== "PAUSED") {
      return reply.status(409).send({ error: "Scan is not paused" });
    }
    const phase = (await markResumed(redis, id)) ?? "SCANNING";
    const status = ["INITIALIZING", "CRAWLING", "SCANNING", "ANALYZING", "VERIFYING", "GENERATING_REPORT"].includes(phase)
      ? (phase as typeof scan.status)
      : "SCANNING";
    await prisma.scan.update({ where: { id }, data: { status } });
    await emitScanEvent(redis, id, "scan.resumed", "Scan resumed");
    return { scanId: id, status };
  });

  app.post("/api/scans/:id/restart", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await prisma.scan.findUnique({
      where: { id },
      include: { configuration: true },
    });
    if (!scan?.configuration) return reply.status(404).send({ error: "Scan not found" });
    if (!["COMPLETED", "FAILED", "CANCELLED"].includes(scan.status)) {
      return reply.status(409).send({ error: "Stop or wait for the current scan before restarting" });
    }
    const alreadyRunning = await prisma.scan.findFirst({
      where: {
        projectId: scan.projectId,
        url: scan.url,
        status: {
          in: ["QUEUED", "INITIALIZING", "CRAWLING", "SCANNING", "ANALYZING", "VERIFYING", "GENERATING_REPORT", "PAUSED"],
        },
      },
      orderBy: { createdAt: "desc" },
    });
    if (alreadyRunning) {
      return reply.status(200).send({ scanId: alreadyRunning.id, status: alreadyRunning.status });
    }
    const config = scan.configuration;
    const created = await prisma.scan.create({
      data: {
        projectId: scan.projectId,
        url: scan.url,
        host: scan.host,
        status: "QUEUED",
        configuration: {
          create: {
            maxPages: config.maxPages,
            maxDepth: config.maxDepth,
            viewport: config.viewport,
            captureScreenshots: config.captureScreenshots,
            recordVideos: config.recordVideos,
            aiAnalysis: config.aiAnalysis,
            runFunctionalTests: config.runFunctionalTests,
            runAccessibility: config.runAccessibility,
            runPerformance: config.runPerformance,
            runSeo: config.runSeo,
            runSecurity: config.runSecurity,
            timeoutMs: config.timeoutMs,
            crawlDelayMs: config.crawlDelayMs,
            concurrency: config.concurrency,
            respectRobotsTxt: config.respectRobotsTxt,
            testMode: config.testMode,
            browserEngine: config.browserEngine,
            coverage: config.coverage,
            dataSeed: config.dataSeed,
            authorizedTest: config.authorizedTest,
          },
        },
      },
    });
    await prisma.project.update({ where: { id: scan.projectId }, data: { updatedAt: new Date() } });
    await queue.add("scan", { scanId: created.id }, { jobId: created.id });
    await emitScanEvent(redis, created.id, "scan.started", "Scan restarted from previous options", { url: scan.url });
    return reply.status(201).send({ scanId: created.id, status: "QUEUED" });
  });

  app.delete("/api/scans/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await prisma.scan.findUnique({ where: { id } });
    if (!scan) return reply.status(404).send({ error: "Scan not found" });
    await markCancelled(redis, id);
    await prisma.scan.delete({ where: { id } });
    await removeScanFiles(id);
    return { deleted: true };
  });

  app.get("/api/scans/:id/events", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await prisma.scan.findUnique({ where: { id }, select: { id: true } });
    if (!scan) return reply.status(404).send({ error: "Scan not found" });

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": env.FRONTEND_URL,
    });

    const existing = await prisma.scanEvent.findMany({
      where: { scanId: id },
      orderBy: { createdAt: "asc" },
    });
    for (const event of existing) {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    const subscriber = redis.duplicate();
    await subscriber.subscribe(`scan:${id}:events`);
    subscriber.on("message", (_channel, message) => {
      reply.raw.write(`data: ${message}\n\n`);
    });

    const heartbeat = setInterval(() => {
      reply.raw.write(`event: ping\ndata: {}\n\n`);
    }, 15000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      subscriber.disconnect();
    });
  });
}
