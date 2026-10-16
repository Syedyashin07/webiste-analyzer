import path from "node:path";
import type Redis from "ioredis";
import pLimit from "p-limit";
import { Prisma } from "@prisma/client";
import type { Browser, BrowserContext, Page as PlaywrightPage } from "playwright";
import { analyzeAccessibilityAxe, analyzeAccessibilityHtml, analyzeAccessibilityRuntime } from "@qa-scanner/accessibility-engine";
import { createAiClient, interpretFinding, interpretVisual } from "@qa-scanner/ai-engine";
import {
  createScanContext,
  extractRenderedLinks,
  installPageHelpers,
  launchBrowser,
  looksLikeLoginUrl,
  navigateAndCollect,
  prepareContext,
  screenshotPage,
  signInToSite,
  startTrace,
  stopTrace,
  viewportFor,
} from "@qa-scanner/browser";
import { crawlSite } from "@qa-scanner/crawler";
import { annotateScreenshot, cropScreenshot } from "@qa-scanner/evidence-engine";
import { discoverInteractiveElements, runFormValidationTests, runSafeInteractions } from "@qa-scanner/functional-engine";
import { computeScanHealth } from "@qa-scanner/health-engine";
import { extractLinks, parseHtml } from "@qa-scanner/parser";
import { analyzePerformance, scorePerformance } from "@qa-scanner/performance-engine";
import {
  reportFileName,
  writeBugDetailsPdfReport,
  writeCsvReport,
  writeHtmlReport,
  writeJsonReport,
  writePdfReport,
  writeXlsxReport,
  type ReportPayload,
} from "@qa-scanner/report-engine";
import { analyzeSecurity, analyzeTls, cachedInspectTls, isHttpsOk, type TlsHostResult } from "@qa-scanner/security-engine";
import { analyzeSeo } from "@qa-scanner/seo-engine";
import { runWorkflowPage, catalogWorkflowFields } from "./workflow.js";
import { seedWorkflowGraph, loadGraph } from "../services/workflow-store.js";
import {
  BROKEN_STATUS_CODES,
  CRAWLER_USER_AGENT,
  assertSafeScanTarget,
  coverageLabel,
  normalizeUrl,
  resolveScanCoverage,
  formatApiCall,
  groupedJsFingerprint,
  isApiResource,
  isDetailedEvidenceBug,
  makeFingerprint,
  redactString,
  severityFromHttpStatus,
  strings,
  type BrowserEngine,
  type BugCategory,
  type ScanStatus,
  type Severity,
  type TestMode,
} from "@qa-scanner/shared";
import { analyzeViewport, screenshotViewportsFor, viewportsForMode } from "@qa-scanner/visual-engine";
import { env, STORAGE_ROOT } from "../config.js";
import { emitScanEvent, isCancelled, isPaused, setScanLiveState } from "../lib/events.js";
import { fetchTextSafe, checkResource } from "../lib/http-check.js";
import { prisma } from "../lib/prisma.js";
import { ensureDir, ingestStoredFile, readStoredFile, scanFileKey } from "../lib/storage.js";
import { upsertBug } from "../services/bug-writer.js";
import { createLogger } from "@qa-scanner/shared";

const log = createLogger("scan-pipeline");

type ScanConfig = NonNullable<Awaited<ReturnType<typeof loadScan>>["configuration"]>;

async function loadScan(scanId: string) {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: { configuration: true, project: true },
  });
  if (!scan || !scan.configuration) throw new Error(`Scan ${scanId} not found`);
  return scan;
}

async function setStatus(scanId: string, status: ScanStatus, extra: Record<string, unknown> = {}) {
  await prisma.scan.update({
    where: { id: scanId },
    data: { status, ...extra },
  });
}

async function bumpProgress(
  redis: Redis,
  scanId: string,
  patch: { pagesDiscovered?: number; pagesScanned?: number; pagesFailed?: number; issuesFound?: number; confirmedBugs?: number; progress?: number },
) {
  const scan = await prisma.scan.update({
    where: { id: scanId },
    data: patch,
  });
  await emitScanEvent(redis, scanId, "scan.progress", "Progress updated", {
    pagesDiscovered: scan.pagesDiscovered,
    pagesScanned: scan.pagesScanned,
    pagesFailed: scan.pagesFailed,
    issuesFound: scan.issuesFound,
    confirmedBugs: scan.confirmedBugs,
    progress: scan.progress,
    status: scan.status,
  });
}

type ScanLogin = {
  loginUsername?: string;
  loginPassword?: string;
  loginUrl?: string;
};

export async function runScanPipeline(scanId: string, redis: Redis, login: ScanLogin = {}): Promise<void> {
  const scan = await loadScan(scanId);
  const config = scan.configuration as ScanConfig;
  const startedAt = new Date();
  await setStatus(scanId, "INITIALIZING", { startedAt, errorMessage: null, progress: 2 });
  await emitScanEvent(redis, scanId, "scan.started", `Initializing scan of ${scan.url}`);

  const safety = await assertSafeScanTarget(scan.url, { allowLocal: env.ALLOW_LOCAL_TARGETS });
  if (!safety.ok) throw new Error(safety.reason ?? "Target blocked by SSRF policy");
  if (login.loginUrl) {
    const loginAbs = /^https?:\/\//i.test(login.loginUrl) ? login.loginUrl : new URL(login.loginUrl, scan.url).href;
    const loginSafety = await assertSafeScanTarget(loginAbs, { allowLocal: env.ALLOW_LOCAL_TARGETS });
    if (!loginSafety.ok) throw new Error(loginSafety.reason ?? "Login URL is not allowed");
    if (new URL(loginAbs).origin !== new URL(scan.url).origin) {
      throw new Error("Login URL must be on the same website as the scan URL");
    }
  }

  const deadline = Date.now() + (env.SCAN_MAX_DURATION_MS || 1_800_000);
  let browser: Browser | null = null;

  const throwIfCancelled = async () => {
    if (await isCancelled(redis, scanId)) {
      const error = new Error("Scan cancelled");
      error.name = "CancelledError";
      throw error;
    }
    if (Date.now() > deadline) throw new Error("Maximum scan duration exceeded");
  };

  const checkpoint = async () => {
    await throwIfCancelled();
    while (await isPaused(redis, scanId)) {
      await throwIfCancelled();
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  };

  try {
    browser = await launchBrowser((config.browserEngine as BrowserEngine | undefined) ?? "chromium", {
      headless: false,
      slowMo: resolveScanCoverage(config) === "WORKFLOW" ? 80 : undefined,
    });
    const context = await createScanContext(browser, { viewport: null });
    await throwIfCancelled();

    let crawlStartUrl = scan.url;
    if (login.loginUsername && login.loginPassword) {
      await emitScanEvent(redis, scanId, "scan.progress", "Signing in to open pages inside the site");
      const loginPage = await context.newPage();
      await loginPage.bringToFront().catch(() => undefined);
      try {
        await installPageHelpers(loginPage).catch(() => undefined);
        if (resolveScanCoverage(config) === "SCREENSHOTS") {
          await captureLoginScreenshot(scanId, scan.url, login, loginPage, config, redis);
        }
        const signedIn = await signInToSite(loginPage, {
          startUrl: scan.url,
          username: login.loginUsername,
          password: login.loginPassword,
          loginUrl: login.loginUrl,
          timeoutMs: config.timeoutMs,
        });
        if (!signedIn.ok) {
          throw new Error(signedIn.message);
        }
        crawlStartUrl = signedIn.finalUrl;
        await emitScanEvent(redis, scanId, "scan.progress", signedIn.message);
      } finally {
        await loginPage.close().catch(() => undefined);
      }
    }

    await checkpoint();
    await setStatus(scanId, "CRAWLING", { progress: 8 });
    const discovered = await crawl(scan, config, context, redis, checkpoint, crawlStartUrl);
    const coverage = resolveScanCoverage(config);
    await emitScanEvent(
      redis,
      scanId,
      "scan.progress",
      `${coverageLabel(coverage)}: discovered ${discovered.length} page${discovered.length === 1 ? "" : "s"}`,
      { coverage, pagesDiscovered: discovered.length },
    );
    await bumpProgress(redis, scanId, {
      pagesDiscovered: discovered.length,
      progress: 20,
    });
    if (resolveScanCoverage(config) === "WORKFLOW") {
      await seedWorkflowGraph(scanId);
      const catalogPages = await prisma.page.findMany({
        where: { scanId },
        select: { url: true },
        orderBy: { depth: "asc" },
      });
      await emitScanEvent(redis, scanId, "scan.progress", "Reading every page to remember its fields. Data entry starts after the scan.");
      await catalogWorkflowFields(
        scanId,
        catalogPages.map((item) => item.url),
        context,
        config.dataSeed,
        redis,
        config.timeoutMs,
      );
    }

    await throwIfCancelled();
    await checkpoint();
    await setStatus(scanId, "SCANNING", { progress: 25 });
    const authenticated = Boolean(login.loginUsername && login.loginPassword);
    await scanPages(scanId, config, context, redis, checkpoint, authenticated);

    if (coverage === "WORKFLOW") {
      await fillRecordedWorkflow(scanId, config, context, redis);
    }

    await throwIfCancelled();
    await checkpoint();
    await setStatus(scanId, "ANALYZING", { progress: 75 });
    await analyzeGrouped(scanId, config, redis);

    await throwIfCancelled();
    await checkpoint();
    await setStatus(scanId, "VERIFYING", { progress: 85 });
    await verifySuspected(scanId, config, context, redis);

    await throwIfCancelled();
    await checkpoint();
    await setStatus(scanId, "GENERATING_REPORT", { progress: 92 });
    await generateOutputs(scanId);

    const bugs = await prisma.bug.count({ where: { scanId } });
    const confirmed = await prisma.bug.count({ where: { scanId, status: "CONFIRMED" } });
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        progress: 100,
        issuesFound: bugs,
        confirmedBugs: confirmed,
      },
    });
    await emitScanEvent(redis, scanId, "scan.completed", "Scan completed");
    log.info({ scanId, durationMs: Date.now() - startedAt.getTime() }, "scan completed");
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

async function crawl(
  scan: Awaited<ReturnType<typeof loadScan>>,
  config: ScanConfig,
  context: BrowserContext,
  redis: Redis,
  throwIfCancelled: () => Promise<void>,
  startUrl = scan.url,
) {
  const page = await context.newPage();
  await page.bringToFront().catch(() => undefined);
  try {
    const pages = await crawlSite({
      startUrl,
      maxPages: config.maxPages,
      maxDepth: config.maxDepth,
      delayMs: config.crawlDelayMs,
      respectRobots: config.respectRobotsTxt,
      fetchHtml: async (url) => {
        await throwIfCancelled();
        try {
          const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: config.timeoutMs,
          });
          await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => undefined);
          const extraUrls = await extractRenderedLinks(page).catch(() => []);
          return {
            html: await page.content(),
            finalUrl: page.url(),
            status: response?.status() ?? 0,
            extraUrls,
          };
        } catch (error) {
          log.warn({ scanId: scan.id, url, error: error instanceof Error ? error.message : error }, "crawl fetch failed");
          return null;
        }
      },
      fetchText: fetchTextSafe,
      extractLinks,
      isAllowedTarget: async (url) => {
        const result = await assertSafeScanTarget(url, { allowLocal: env.ALLOW_LOCAL_TARGETS });
        return result.ok;
      },
      onDiscovered: async (item) => {
        await prisma.page.upsert({
          where: { scanId_normalizedUrl: { scanId: scan.id, normalizedUrl: item.normalizedUrl } },
          update: { depth: item.depth, parentUrl: item.parentUrl },
          create: {
            scanId: scan.id,
            url: item.url,
            normalizedUrl: item.normalizedUrl,
            depth: item.depth,
            parentUrl: item.parentUrl,
            status: "DISCOVERED",
          },
        });
        const count = await prisma.page.count({ where: { scanId: scan.id } });
        await prisma.scan.update({ where: { id: scan.id }, data: { pagesDiscovered: count } });
        await emitScanEvent(redis, scan.id, "page.discovered", `Discovered ${item.url}`, {
          url: item.url,
          depth: item.depth,
        });
      },
    });
    return pages;
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function fillRecordedWorkflow(
  scanId: string,
  config: ScanConfig,
  context: BrowserContext,
  redis: Redis,
) {
  const graph = await loadGraph(scanId);
  const urls = [...new Set(graph.nodes.filter((node) => node.kind === "field" && node.url).map((node) => node.url as string))];
  await emitScanEvent(
    redis,
    scanId,
    "scan.progress",
    urls.length
      ? "All pages are scanned. Filling each required field with its matching dummy data."
      : "All pages are scanned. No form fields were found to fill.",
  );
  for (const url of urls) {
    const row = await prisma.page.findFirst({ where: { scanId, OR: [{ url }, { normalizedUrl: url }] } });
    const page = await context.newPage();
    await page.bringToFront().catch(() => undefined);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: config.timeoutMs }).catch(() => undefined);
      await runWorkflowPage(scanId, url, page, config.aiAnalysis, config.dataSeed, redis);
      if (row) await captureFullPageScreenshot(scanId, row.id, page, "after data entry", "workflow-filled");
    } finally {
      await page.close().catch(() => undefined);
    }
  }
}

async function scanPages(
  scanId: string,
  config: ScanConfig,
  context: BrowserContext,
  redis: Redis,
  throwIfCancelled: () => Promise<void>,
  authenticated: boolean,
) {
  const screenshotTour = resolveScanCoverage(config) === "SCREENSHOTS";
  const pages = await prisma.page.findMany({
    where: { scanId },
    orderBy: screenshotTour ? { discoveredAt: "asc" } : { depth: "asc" },
  });
  const limit = pLimit(screenshotTour ? 1 : config.concurrency);
  const tlsCache = new Map<string, Promise<TlsHostResult>>();
  let scanned = 0;
  let failed = 0;

  await Promise.all(
    pages.map((pageRow) =>
      limit(async () => {
        await throwIfCancelled();
        try {
          await scanSinglePage(scanId, pageRow.id, pageRow.url, config, context, redis, tlsCache, authenticated);
          scanned += 1;
        } catch (error) {
          failed += 1;
          const message = error instanceof Error ? error.message : "Page scan failed";
          log.warn({ scanId, url: pageRow.url, error: message }, "page failed");
          await prisma.page.update({
            where: { id: pageRow.id },
            data: { status: "FAILED", errorMessage: message, scannedAt: new Date() },
          });
          await emitScanEvent(redis, scanId, "page.failed", `Failed ${pageRow.url}`, { error: message });
        }
        const progress = 25 + Math.round(((scanned + failed) / Math.max(pages.length, 1)) * 50);
        await bumpProgress(redis, scanId, {
          pagesScanned: scanned,
          pagesFailed: failed,
          progress,
        });
      }),
    ),
  );
}

async function scanSinglePage(
  scanId: string,
  pageId: string,
  url: string,
  config: ScanConfig,
  context: BrowserContext,
  redis: Redis,
  tlsCache: Map<string, Promise<TlsHostResult>>,
  authenticated: boolean,
) {
  await emitScanEvent(redis, scanId, "page.started", `Scanning ${url}`, { url });
  await setScanLiveState(redis, scanId, { url, action: `Opening ${url}` });
  await prisma.page.update({ where: { id: pageId }, data: { status: "SCANNING" } });

  const page = await context.newPage();
  await page.bringToFront().catch(() => undefined);
  try {
    const collected = await withRetry(() => navigateAndCollect(page, url, config.timeoutMs), 2);
    const bouncedToLogin = authenticated && looksLikeLoginUrl(collected.finalUrl) && !looksLikeLoginUrl(url);
    if (bouncedToLogin) {
      await emitScanEvent(redis, scanId, "scan.action", `Login screen opened for ${url}, so form tests were skipped`, { url });
    }
    const parsed = parseHtml(collected.html, collected.finalUrl);

    const origin = new URL(collected.finalUrl).origin;
    const [robotsTxt, sitemap] = await Promise.all([
      fetchTextSafe(`${origin}/robots.txt`),
      fetchTextSafe(`${origin}/sitemap.xml`),
    ]);

    await prisma.page.update({
      where: { id: pageId },
      data: {
        status: "SCANNED",
        url: collected.finalUrl,
        httpStatus: collected.status,
        responseTimeMs: collected.responseTimeMs,
        title: collected.title,
        metaDescription: parsed.metaDescription,
        canonical: parsed.canonical,
        robotsMeta: parsed.robotsMeta,
        language: collected.language ?? parsed.language,
        htmlSize: parsed.htmlSize,
        resourceCount: collected.resourceCount,
        viewport: `${collected.viewport.width}x${collected.viewport.height}`,
        redirectedFrom: collected.redirectedFrom,
        headingsJson: parsed.headings as Prisma.InputJsonValue,
        cookiesJson: collected.cookies as Prisma.InputJsonValue,
        localStorageOk: collected.localStorageOk,
        scannedAt: new Date(),
      },
    });

    const tlsPromise = cachedInspectTls(tlsCache, collected.finalUrl);
    const pageScreenshot = await captureViewportScreenshots(scanId, pageId, page, config, redis, url);
    const tls = await tlsPromise;
    await prisma.page.update({
      where: { id: pageId },
      data: {
        httpsOk: isHttpsOk(tls),
        tlsJson: tls as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.pageLink.deleteMany({ where: { pageId } });
    await prisma.pageImage.deleteMany({ where: { pageId } });
    await prisma.pageForm.deleteMany({ where: { pageId } });

    const caps = resourceCheckCaps(config);
    const uniqueLinks = [...new Map(parsed.links.map((link) => [link.href, link])).values()].slice(0, caps.links);
    const uniqueImages = parsed.images.slice(0, caps.images);
    await setScanLiveState(redis, scanId, {
      url,
      action: `Checking ${uniqueLinks.length} links and ${uniqueImages.length} images`,
    });
    const checkLimit = pLimit(caps.checkConcurrency);
    const imageSizes = await collectImageSizes(page);

    const linkResults = await Promise.all(
      uniqueLinks.map((link) =>
        checkLimit(async () => {
          const checked = await checkResource(link.href, caps.checkTimeoutMs);
          const isBroken =
            checked.error !== null ||
            (checked.status !== null && BROKEN_STATUS_CODES.has(checked.status)) ||
            (checked.status !== null && checked.status >= 400);
          return { link, checked, isBroken };
        }),
      ),
    );
    if (linkResults.length) {
      await prisma.pageLink.createMany({
        data: linkResults.map(({ link, checked, isBroken }) => ({
          pageId,
          href: link.href,
          text: link.text,
          isInternal: link.isInternal,
          statusCode: checked.status,
          error: checked.error,
          isBroken,
        })),
      });
    }
    for (const { link, checked } of linkResults.filter((row) => row.isBroken)) {
      const bug = await upsertBug({
        scanId,
        fingerprint: makeFingerprint({ category: "BROKEN_LINK", signature: link.href }),
        title: `Broken link: ${link.href}`,
        description: `Link from ${url} to ${link.href} failed.`,
        category: "BROKEN_LINK",
        severity: severityFromHttpStatus(checked.status),
        url,
        pageUrl: url,
        expected: "Link should return a successful HTTP status",
        actual: checked.error ?? `HTTP ${checked.status}`,
        stepsToReproduce: `1. Open ${url}\n2. Follow link "${link.text || link.href}"`,
        recommendedAction: strings.recommendations.BROKEN_LINK,
        verified: true,
        source: "rule",
        status: "CONFIRMED",
        technicalDetails: { href: link.href, status: checked.status, error: checked.error },
      });
      await linkScreenshotToBug(bug.id, pageScreenshot);
      await emitScanEvent(redis, scanId, "issue.detected", `Broken link ${link.href}`);
    }

    const imageResults = await Promise.all(
      uniqueImages.map((image) =>
        checkLimit(async () => {
          const checked = image.src.startsWith("http")
            ? await checkResource(image.src, caps.checkTimeoutMs)
            : { status: null, error: "invalid source", redirectCount: 0 };
          const dims =
            imageSizes.get(image.src) ??
            [...imageSizes.entries()].find(([src]) => src.includes(image.src) || image.src.includes(src))?.[1] ??
            { w: 0, h: 0 };
          const isBroken =
            Boolean(checked.error) ||
            (checked.status !== null && checked.status >= 400) ||
            !image.src ||
            (dims.w === 0 && dims.h === 0 && image.src.startsWith("http"));
          return { image, checked, dims, isBroken };
        }),
      ),
    );
    if (imageResults.length) {
      await prisma.pageImage.createMany({
        data: imageResults.map(({ image, checked, dims, isBroken }) => ({
          pageId,
          src: image.src,
          alt: image.alt,
          statusCode: checked.status,
          naturalWidth: dims.w,
          naturalHeight: dims.h,
          isBroken,
          error: checked.error,
        })),
      });
    }
    for (const { image, checked, dims } of imageResults.filter((row) => row.isBroken)) {
      const bug = await upsertBug({
        scanId,
        fingerprint: makeFingerprint({ category: "BROKEN_IMAGE", signature: image.src || "empty" }),
        title: `Broken image: ${image.src || "(missing src)"}`,
        description: `Image failed to load on ${url}`,
        category: "BROKEN_IMAGE",
        severity: "HIGH",
        url,
        pageUrl: url,
        expected: "Image should load with valid dimensions",
        actual: checked.error ?? `HTTP ${checked.status ?? "n/a"}; natural ${dims.w}x${dims.h}`,
        stepsToReproduce: `1. Open ${url}\n2. Observe image ${image.src}`,
        recommendedAction: strings.recommendations.BROKEN_IMAGE,
        verified: true,
        source: "rule",
        status: "CONFIRMED",
      });
      await linkScreenshotToBug(bug.id, pageScreenshot);
      await emitScanEvent(redis, scanId, "issue.detected", `Broken image ${image.src}`);
    }

    for (const form of parsed.forms) {
      await prisma.pageForm.create({
        data: {
          pageId,
          action: form.action,
          method: form.method,
          fieldCount: form.fields.length,
          fieldsJson: JSON.parse(JSON.stringify(form.fields)) as Prisma.InputJsonValue,
          hasSubmit: form.hasSubmit,
        },
      });
    }

    await prisma.pageElement.deleteMany({ where: { pageId } });
    const discovered = await discoverInteractiveElements(page).catch(() => []);
    await emitScanEvent(redis, scanId, "scan.action", `${discovered.length} interactive elements found on ${url}`, {
      url,
      elements: discovered.length,
    });
    for (const element of discovered.slice(0, 200)) {
      await prisma.pageElement.create({
        data: {
          pageId,
          type: element.type,
          selector: element.selector,
          text: element.text.slice(0, 200) || null,
          name: element.name,
          role: element.role,
          href: element.href,
          visible: element.visible,
          bounds: element.bounds as Prisma.InputJsonValue,
          risk: element.risk,
        },
      });
    }

    for (const entry of collected.consoleEntries.filter((item) => item.type === "error" || item.type === "pageerror")) {
      const fingerprint = groupedJsFingerprint(entry.text);
      await prisma.consoleError.create({
        data: {
          scanId,
          pageId,
          type: entry.type,
          message: redactString(entry.text).slice(0, 2000),
          stack: entry.location ? redactString(entry.location).slice(0, 4000) : null,
          fingerprint,
        },
      });
    }

    const seenApis = new Set<string>();
    for (const entry of collected.networkEntries) {
      const fingerprint = makeFingerprint({
        category: "NETWORK",
        signature: `${entry.method} ${entry.url} ${entry.status ?? entry.failure ?? ""}`,
      });
      await prisma.networkError.create({
        data: {
          scanId,
          pageId,
          requestUrl: entry.url,
          method: entry.method,
          statusCode: entry.status,
          resourceType: entry.resourceType,
          initiator: entry.initiator,
          error: entry.failure,
          fingerprint,
        },
      });
      if (isApiResource(entry.resourceType, entry.url)) {
        const api = formatApiCall(entry.method, entry.url);
        if (!seenApis.has(api)) {
          seenApis.add(api);
          const result = entry.status ? `HTTP ${entry.status}` : entry.failure ?? "error";
          await emitScanEvent(redis, scanId, "issue.detected", `API failed: ${api} → ${result}`, {
            url,
            api,
            method: entry.method,
            requestUrl: entry.url,
            status: entry.status,
          });
          await setScanLiveState(redis, scanId, { url, action: `API failed: ${api}` });
        }
      }
    }

    if (config.runPerformance) {
      const perfIssues = analyzePerformance(collected.metrics);
      await prisma.performanceMetric.upsert({
        where: { pageId },
        update: { ...collected.metrics, score: scorePerformance(collected.metrics) },
        create: { pageId, ...collected.metrics, score: scorePerformance(collected.metrics) },
      });
      for (const issue of perfIssues) {
        await prisma.page.update({ where: { id: pageId }, data: {} });
        await upsertEngineIssue("PERFORMANCE", scanId, url, issue.rule, issue.severity, issue.message, page, pageScreenshot);
      }
    }

    if (config.runSeo) {
      const seoIssues = analyzeSeo(parsed, collected.finalUrl, {
        robotsTxtFound: Boolean(robotsTxt),
        sitemapFound: Boolean(sitemap),
      });
      for (const issue of seoIssues) {
        if (!isDetailedEvidenceBug({ category: "SEO", rule: issue.rule, title: issue.message, description: issue.message })) continue;
        await prisma.sEOIssue.create({
          data: {
            pageId,
            rule: issue.rule,
            severity: issue.severity,
            message: issue.message,
            fingerprint: makeFingerprint({ category: "SEO", signature: issue.rule, url }),
          },
        });
        await upsertEngineIssue("SEO", scanId, url, issue.rule, issue.severity, issue.message, page, pageScreenshot);
      }
    }

    if (config.runAccessibility) {
      const htmlIssues = analyzeAccessibilityHtml(parsed, collected.html);
      const runtimeIssues = await analyzeAccessibilityRuntime(page);
      const axeIssues = await analyzeAccessibilityAxe(page).catch(() => []);
      for (const issue of [...htmlIssues, ...runtimeIssues, ...axeIssues]) {
        if (!isDetailedEvidenceBug({ category: "ACCESSIBILITY", rule: issue.rule, title: issue.message, description: issue.message })) {
          continue;
        }
        await prisma.accessibilityIssue.create({
          data: {
            pageId,
            rule: issue.rule,
            severity: issue.severity,
            message: issue.message,
            selector: issue.selector,
            fingerprint: makeFingerprint({ category: "ACCESSIBILITY", signature: `${issue.rule}:${issue.message}`, url }),
          },
        });
        await upsertEngineIssue("ACCESSIBILITY", scanId, url, issue.rule, issue.severity, issue.message, page, pageScreenshot);
      }
    }

    const tlsIssues = analyzeTls(tls);
    let headerIssues: typeof tlsIssues = [];
    if (config.runSecurity) {
      const headers = await page
        .evaluate(async () => {
          const res = await fetch(location.href, { method: "HEAD" }).catch(() => null);
          if (!res) return {};
          const result: Record<string, string> = {};
          res.headers.forEach((value, key) => {
            result[key] = value;
          });
          return result;
        })
        .catch(() => ({} as Record<string, string>));
      const resourceUrls = [...parsed.scripts, ...parsed.stylesheets, ...parsed.images.map((img) => img.src)];
      headerIssues = analyzeSecurity({
        pageUrl: collected.finalUrl,
        html: collected.html,
        parsed,
        headers,
        resourceUrls,
        cookies: collected.cookies,
      });
    }
    for (const issue of [...tlsIssues, ...headerIssues]) {
      if (!isDetailedEvidenceBug({ category: "SECURITY", rule: issue.rule, title: issue.message, description: issue.message })) continue;
      await prisma.securityIssue.create({
        data: {
          pageId,
          rule: issue.rule,
          severity: issue.severity,
          message: issue.message,
          fingerprint: makeFingerprint({ category: "SECURITY", signature: issue.rule, url }),
        },
      });
      await upsertEngineIssue("SECURITY", scanId, url, issue.rule, issue.severity, issue.message, page, pageScreenshot);
    }

    const visualViewports = viewportsForMode(config.viewport);
    for (const viewport of visualViewports) {
      const visualIssues = await analyzeViewport(page, viewport);
      for (const issue of visualIssues) {
        if (!isDetailedEvidenceBug({ category: "VISUAL", title: issue.message, description: issue.message })) continue;
        const bug = await upsertBug({
          scanId,
          fingerprint: makeFingerprint({
            category: "VISUAL",
            signature: `${issue.type}:${issue.selector}`,
            url,
            element: issue.selector,
          }),
          title: `Visual: ${issue.message}`,
          description: issue.message,
          category: "VISUAL",
          severity: issue.severity,
          url,
          pageUrl: url,
          expected: "Layout should not overflow, clip, or overlap unexpectedly",
          actual: issue.message,
          stepsToReproduce: `1. Open ${url}\n2. Set viewport ${viewport}\n3. Observe ${issue.selector}`,
          recommendedAction: strings.recommendations.VISUAL,
          verified: !issue.needsAi,
          source: issue.needsAi ? "ai" : "rule",
          status: issue.needsAi ? "UNVERIFIED" : "CONFIRMED",
          viewport,
          technicalDetails: { selector: issue.selector, box: issue.box, type: issue.type },
        });
        await attachAnnotated(scanId, pageId, bug.id, page, issue.box);
        await linkScreenshotToBug(bug.id, pageScreenshot);
        if (issue.needsAi && config.aiAnalysis && env.OPENAI_API_KEY) {
          const client = createAiClient({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL });
          if (client) {
            const finding = await interpretVisual(client, env.OPENAI_MODEL, {
              url,
              pageTitle: collected.title,
              viewport,
              element: issue.selector,
              actual: issue.message,
              geometry: issue,
            }).catch(() => null);
            if (finding) {
              await prisma.bug.update({
                where: { id: bug.id },
                data: {
                  aiAnalysis: finding.reason,
                  confidence: finding.confidence,
                  recommendedAction: finding.recommendedAction,
                  rootCause: finding.rootCause ? `Likely cause: ${finding.rootCause}` : undefined,
                },
              });
            }
          }
        }
        await emitScanEvent(redis, scanId, "issue.detected", issue.message);
      }
    }

    if (!bouncedToLogin && resolveScanCoverage(config) !== "WORKFLOW" && config.runFunctionalTests) {
      await runFunctional(scanId, pageId, url, page, config, redis);
    }

    await emitScanEvent(redis, scanId, "page.completed", `Completed ${url}`, { url });
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function runFunctional(
  scanId: string,
  pageId: string,
  url: string,
  page: PlaywrightPage,
  config: ScanConfig,
  redis: Redis,
) {
  const beforeKey = scanFileKey("screenshots", scanId, `${pageId}-func-before.png`);
  const beforeAbs = path.join(STORAGE_ROOT, beforeKey);
  await ensureDir(path.posix.dirname(beforeKey));
  await screenshotPage(page, beforeAbs, true).catch(() => undefined);
  await ingestStoredFile(beforeKey, beforeAbs, "image/png");
  const pageShot = await prisma.screenshot.findFirst({
    where: { pageId, kind: "original" },
    orderBy: { createdAt: "asc" },
  });

  let videoContext: BrowserContext | null = null;
  let funcPage = page;
  if (config.recordVideos) {
    const dir = await ensureDir(`videos/${scanId}/tmp-${pageId}`);
    videoContext =
      (await page.context().browser()?.newContext({
        viewport: page.viewportSize() ?? viewportFor("DESKTOP"),
        userAgent: CRAWLER_USER_AGENT,
        recordVideo: { dir },
      })) ?? null;
    if (videoContext) {
      await prepareContext(videoContext);
      await startTrace(videoContext);
      funcPage = await videoContext.newPage();
      await funcPage.goto(url, { waitUntil: "domcontentloaded", timeout: config.timeoutMs }).catch(() => undefined);
      await installPageHelpers(funcPage).catch(() => undefined);
    }
  }

  const mode = ((config as ScanConfig & { testMode?: string }).testMode ?? "STANDARD") as TestMode;
  const onAction = async (message: string) => {
    await setScanLiveState(redis, scanId, { url, action: message });
    await emitScanEvent(redis, scanId, "scan.action", message, { url });
  };
  const results = [
    ...(await runSafeInteractions(funcPage, { mode, onAction })),
    ...(await runFormValidationTests(funcPage, { mode, onAction })),
  ];
  const failed = results.filter((result) => !result.skipped && !result.passed);
  const review = results.filter((result) => result.needsManualVerification && result.skipped === false);

  const afterKey = scanFileKey("screenshots", scanId, `${pageId}-func-after.png`);
  const afterAbs = path.join(STORAGE_ROOT, afterKey);
  await ensureDir(path.posix.dirname(afterKey));
  await screenshotPage(funcPage, afterAbs, true).catch(() => undefined);
  await ingestStoredFile(afterKey, afterAbs, "image/png");

  for (const result of failed) {
    const title = `Functional failure: ${result.action} ${result.element}`;
    if (!isDetailedEvidenceBug({ category: "FUNCTIONAL", title, description: result.actual, actual: result.actual })) continue;
    const bug = await upsertBug({
      scanId,
      fingerprint: makeFingerprint({
        category: "FUNCTIONAL",
        signature: `${result.action}:${result.element}`,
        url,
      }),
      title,
      description: result.actual,
      category: "FUNCTIONAL",
      severity: "HIGH",
      url,
      pageUrl: url,
      expected: result.expected,
      actual: result.actual,
      stepsToReproduce: `1. Open ${url}\n2. ${result.action} "${result.element}"\n3. Observe result`,
      recommendedAction: strings.recommendations.FUNCTIONAL,
      verified: true,
      source: "rule",
      status: "CONFIRMED",
      technicalDetails: { consoleErrors: result.consoleErrors, networkErrors: result.networkErrors },
    });

    const beforeShot = await prisma.screenshot.create({
      data: { pageId, kind: "before", storageKey: beforeKey, filePath: beforeAbs },
    });
    const afterShot = await prisma.screenshot.create({
      data: { pageId, kind: "after", storageKey: afterKey, filePath: afterAbs },
    });
    await prisma.bugEvidence.createMany({
      data: [
        { bugId: bug.id, type: "screenshot", screenshotId: beforeShot.id, path: beforeKey, mimeType: "image/png" },
        { bugId: bug.id, type: "screenshot", screenshotId: afterShot.id, path: afterKey, mimeType: "image/png" },
      ],
    });
    if (pageShot) await linkScreenshotToBug(bug.id, pageShot);
    await emitScanEvent(redis, scanId, "issue.detected", result.actual);
  }

  for (const result of review) {
    const title = `Needs Manual Verification: ${result.action} ${result.element}`;
    if (!isDetailedEvidenceBug({ category: "FUNCTIONAL", title, description: result.actual, actual: result.actual })) continue;
    await upsertBug({
      scanId,
      fingerprint: makeFingerprint({
        category: "FUNCTIONAL",
        signature: `manual:${result.action}:${result.element}`,
        url,
      }),
      title,
      description: result.actual,
      category: "FUNCTIONAL",
      severity: "LOW",
      url,
      pageUrl: url,
      expected: result.expected,
      actual: result.actual,
      stepsToReproduce: `1. Open ${url}\n2. ${result.action} "${result.element}"\n3. Confirm expected behavior manually`,
      recommendedAction: "Needs Manual Verification",
      verified: false,
      source: "rule",
      status: "UNVERIFIED",
    });
  }

  if (videoContext) {
    if (failed.length > 0) {
      const videoKey = scanFileKey("videos", scanId, `${pageId}.webm`);
      const videoAbs = path.join(STORAGE_ROOT, videoKey);
      await ensureDir(path.posix.dirname(videoKey));
      const traceKey = scanFileKey("traces", scanId, `${pageId}.zip`);
      const traceAbs = path.join(STORAGE_ROOT, traceKey);
      await ensureDir(path.posix.dirname(traceKey));
      await stopTrace(videoContext, traceAbs).catch(() => undefined);
      const pageVideo = funcPage.video();
      await funcPage.close().catch(() => undefined);
      if (pageVideo) {
        await pageVideo.saveAs(videoAbs).catch(() => undefined);
      }
      await videoContext.close().catch(() => undefined);
      await ingestStoredFile(videoKey, videoAbs, "video/webm");
      await ingestStoredFile(traceKey, traceAbs, "application/zip");
      const video = await prisma.video.create({ data: { storageKey: videoKey, filePath: videoAbs } });
      const trace = await prisma.trace.create({ data: { storageKey: traceKey, filePath: traceAbs } });
      const latest = await prisma.bug.findFirst({
        where: { scanId, category: "FUNCTIONAL", url },
        orderBy: { detectedAt: "desc" },
      });
      if (latest) {
        await prisma.bugEvidence.createMany({
          data: [
            { bugId: latest.id, type: "video", videoId: video.id, path: videoKey, mimeType: "video/webm" },
            { bugId: latest.id, type: "trace", traceId: trace.id, path: traceKey },
          ],
        });
      }
    } else {
      await funcPage.close().catch(() => undefined);
      await videoContext.close().catch(() => undefined);
    }
  }
}

async function analyzeGrouped(scanId: string, config: ScanConfig, redis: Redis) {
  const errors = await prisma.consoleError.findMany({ where: { scanId } });
  const byFinger = new Map<string, typeof errors>();
  for (const error of errors) {
    const list = byFinger.get(error.fingerprint) ?? [];
    list.push(error);
    byFinger.set(error.fingerprint, list);
  }
  for (const [fingerprint, list] of byFinger) {
    const first = list[0];
    if (!first) continue;
    const urls = [...new Set(list.map((item) => item.pageId ?? ""))];
    const pages = await prisma.page.findMany({
      where: { id: { in: list.map((item) => item.pageId).filter((id): id is string => Boolean(id)) } },
    });
    const affected = pages.map((page) => page.url);
    const title = `JavaScript error on ${list.length} page${list.length === 1 ? "" : "s"}`;
    if (!isDetailedEvidenceBug({ category: "JAVASCRIPT", title, description: first.message, actual: first.message })) continue;
    const bug = await upsertBug({
      scanId,
      fingerprint,
      title,
      description: first.message,
      category: "JAVASCRIPT",
      severity: "HIGH",
      url: affected[0] ?? "",
      expected: "Page should not throw uncaught JavaScript errors",
      actual: first.message,
      stepsToReproduce: `1. Open affected pages\n2. Observe browser console`,
      recommendedAction: strings.recommendations.JAVASCRIPT,
      verified: true,
      source: "rule",
      status: "CONFIRMED",
      technicalDetails: { stack: first.stack, occurrences: list.length },
    });
    await prisma.bug.update({
      where: { id: bug.id },
      data: { occurrences: list.length, affectedUrls: affected },
    });
    await attachScreenshotFromPageId(bug.id, first.pageId);

    if (config.aiAnalysis && env.OPENAI_API_KEY) {
      const client = createAiClient({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL });
      if (client) {
        const finding = await interpretFinding(client, env.OPENAI_MODEL, {
          url: affected[0] ?? "",
          consoleError: first.message,
          category: "JAVASCRIPT",
        }).catch(() => null);
        if (finding) {
          await prisma.bug.update({
            where: { id: bug.id },
            data: {
              aiAnalysis: finding.reason,
              confidence: finding.confidence,
              rootCause: finding.rootCause ? `Likely cause: ${finding.rootCause}` : undefined,
              recommendedAction: finding.recommendedAction,
            },
          });
        }
      }
    }
    await emitScanEvent(redis, scanId, "issue.detected", first.message, { urls });
  }

  const network = await prisma.networkError.findMany({ where: { scanId } });
  const netMap = new Map<string, typeof network>();
  for (const item of network) {
    const list = netMap.get(item.fingerprint) ?? [];
    list.push(item);
    netMap.set(item.fingerprint, list);
  }
  for (const [fingerprint, list] of netMap) {
    const first = list[0];
    if (!first) continue;
    const page = first.pageId
      ? await prisma.page.findUnique({ where: { id: first.pageId }, select: { url: true } })
      : null;
    const api = isApiResource(first.resourceType, first.requestUrl);
    const apiName = formatApiCall(first.method, first.requestUrl);
    const result = first.error ?? (first.statusCode ? `HTTP ${first.statusCode}` : "request failed");
    const pageLabel = page?.url || "the page";
    const title = api ? `API failed: ${apiName}` : `Network failure: ${apiName}`;
    if (!isDetailedEvidenceBug({ category: "NETWORK", title, description: result, actual: result })) continue;
    const bug = await upsertBug({
      scanId,
      fingerprint,
      title,
      description: api
        ? `${apiName} failed with ${result} while opening ${pageLabel}.`
        : `${apiName} failed with ${result}.`,
      category: "NETWORK",
      severity: severityFromHttpStatus(first.statusCode),
      url: first.requestUrl,
      pageUrl: page?.url ?? first.requestUrl,
      expected: api ? "API should return a successful HTTP status" : "Network request should succeed",
      actual: result,
      stepsToReproduce: `1. Open ${pageLabel}\n2. Watch the network call ${apiName}\n3. Confirm it still returns ${result}`,
      recommendedAction: strings.recommendations.NETWORK,
      verified: true,
      source: "rule",
      status: "CONFIRMED",
      technicalDetails: {
        method: first.method,
        resourceType: first.resourceType,
        status: first.statusCode,
        api: apiName,
        pageUrl: page?.url ?? null,
        isApi: api,
      },
    });
    await attachScreenshotFromPageId(bug.id, first.pageId);
  }
}

async function verifySuspected(
  scanId: string,
  config: ScanConfig,
  context: BrowserContext,
  redis: Redis,
) {
  const suspected = await prisma.bug.findMany({
    where: { scanId, status: "UNVERIFIED" },
  });
  for (const bug of suspected) {
    await emitScanEvent(redis, scanId, "verification.started", `Verifying ${bug.bugNumber}`);
    const page = await context.newPage();
    try {
      await page.goto(bug.url, { waitUntil: "domcontentloaded", timeout: config.timeoutMs });
      const issues = await analyzeViewport(page, "DESKTOP");
      const details = bug.technicalDetails as { type?: string } | null;
      const reproduced = issues.some((issue) => issue.type === details?.type);
      await prisma.bug.update({
        where: { id: bug.id },
        data: reproduced
          ? { status: "CONFIRMED", verified: true }
          : { status: "FALSE_POSITIVE", verified: false },
      });
      await emitScanEvent(
        redis,
        scanId,
        "verification.completed",
        reproduced ? `${bug.bugNumber} confirmed` : `${bug.bugNumber} not reproduced`,
      );
    } catch {
      await prisma.bug.update({
        where: { id: bug.id },
        data: { status: "UNVERIFIED", verified: false },
      });
    } finally {
      await page.close().catch(() => undefined);
    }
  }
}

async function generateOutputs(scanId: string) {
  await backfillBugScreenshots(scanId);
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      configuration: true,
      pages: { include: { links: true, images: true, performance: true, seoIssues: true, accessibility: true, securityIssues: true, screenshots: true, consoleErrors: true, elements: true, forms: true } },
      bugs: { include: { evidence: { include: { screenshot: true } } } },
      consoleErrors: true,
      networkErrors: true,
    },
  });
  if (!scan) return;

  const skipped = {
    performance: !scan.configuration?.runPerformance,
    accessibility: !scan.configuration?.runAccessibility,
    seo: !scan.configuration?.runSeo,
    security: !scan.configuration?.runSecurity,
    functional: !scan.configuration?.runFunctionalTests,
  };
  const evidenceBugs = scan.bugs.filter((bug) =>
    isDetailedEvidenceBug({
      category: bug.category,
      title: bug.title,
      description: bug.description,
      actual: bug.actual,
    }),
  );
  const health = computeScanHealth(
    evidenceBugs.map((bug) => ({ category: bug.category, severity: bug.severity })),
    skipped,
  );

  const issueCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const bug of evidenceBugs) issueCounts[bug.severity] += 1;

  await prisma.scan.update({
    where: { id: scanId },
    data: {
      overallScore: health.overall,
      performanceScore: health.performance,
      accessibilityScore: health.accessibility,
      seoScore: health.seo,
      securityScore: health.security,
      functionalScore: health.functional,
      visualScore: health.visual,
      technicalScore: health.technical,
      scoreBreakdown: health.categories as unknown as Prisma.InputJsonValue,
      issuesFound: evidenceBugs.length,
      confirmedBugs: evidenceBugs.filter((bug) => bug.status === "CONFIRMED").length,
    },
  });

  const payload: ReportPayload = {
    scanId,
    website: scan.url,
    scannedAt: (scan.completedAt ?? new Date()).toISOString(),
    health: {
      overall: health.overall,
      performance: health.performance,
      accessibility: health.accessibility,
      seo: health.seo,
      security: health.security,
      functional: health.functional,
      visual: health.visual,
      technical: health.technical,
    },
    pagesScanned: scan.pagesScanned,
    pagesFailed: scan.pagesFailed,
    inventory: (() => {
      const coverage = resolveScanCoverage(scan.configuration);
      const apiKeys = new Set<string>();
      for (const item of scan.networkErrors) {
        if (!isApiResource(item.resourceType, item.requestUrl)) continue;
        apiKeys.add(`${item.method.toUpperCase()} ${item.requestUrl}`);
      }
      return {
        coverage,
        coverageLabel: coverageLabel(coverage),
        pagesDiscovered: scan.pagesDiscovered,
        pagesScanned: scan.pagesScanned,
        pagesFailed: scan.pagesFailed,
        linksFound: scan.pages.reduce((sum, page) => sum + page.links.length, 0),
        brokenLinks: scan.pages.reduce((sum, page) => sum + page.links.filter((link) => link.isBroken).length, 0),
        imagesFound: scan.pages.reduce((sum, page) => sum + page.images.length, 0),
        brokenImages: scan.pages.reduce((sum, page) => sum + page.images.filter((image) => image.isBroken).length, 0),
        formsFound: scan.pages.reduce((sum, page) => sum + page.forms.length, 0),
        elementsFound: scan.pages.reduce((sum, page) => sum + page.elements.length, 0),
        apiFailures: apiKeys.size,
      };
    })(),
    issueCounts,
    bugs: [],
    pages: scan.pages.map((page) => ({
      url: page.url,
      status: page.httpStatus,
      title: page.title,
      responseTimeMs: page.responseTimeMs,
      testsExecuted: page.elements.length + page.forms.length,
      errors: page.consoleErrors.length + page.accessibility.length,
    })),
    brokenLinks: scan.pages.flatMap((page) =>
      page.links.filter((link) => link.isBroken).map((link) => ({
        page: page.url,
        href: link.href,
        status: link.statusCode,
        text: link.text,
      })),
    ),
    brokenImages: scan.pages.flatMap((page) =>
      page.images.filter((image) => image.isBroken).map((image) => ({
        page: page.url,
        src: image.src,
        status: image.statusCode,
      })),
    ),
    consoleErrors: scan.consoleErrors.map((item) => ({
      page: item.pageId ?? "",
      message: item.message,
    })),
    networkErrors: scan.networkErrors.map((item) => ({
      page: item.pageId ?? "",
      method: item.method,
      url: item.requestUrl,
      status: item.statusCode,
    })),
    seo: scan.pages.flatMap((page) =>
      page.seoIssues
        .filter((issue) => isDetailedEvidenceBug({ category: "SEO", rule: issue.rule, title: issue.message }))
        .map((issue) => ({ page: page.url, message: issue.message })),
    ),
    accessibility: scan.pages.flatMap((page) =>
      page.accessibility
        .filter((issue) => isDetailedEvidenceBug({ category: "ACCESSIBILITY", rule: issue.rule, title: issue.message }))
        .map((issue) => ({ page: page.url, message: issue.message })),
    ),
    performance: scan.pages.map((page) => ({
      page: page.url,
      score: page.performance?.score ?? null,
      loadEventMs: page.performance?.loadEventMs ?? null,
    })),
    security: scan.pages.flatMap((page) =>
      page.securityIssues
        .filter((issue) => isDetailedEvidenceBug({ category: "SECURITY", rule: issue.rule, title: issue.message }))
        .map((issue) => ({ page: page.url, message: issue.message })),
    ),
    recommendations: [
      strings.recommendations.BROKEN_LINK,
      strings.recommendations.missingAlt,
      strings.recommendations.PERFORMANCE,
      strings.recommendations.SECURITY,
    ],
  };

  const screenshotCache = new Map<string, string>();
  async function toDataUrl(storageKey: string, id: string): Promise<string | undefined> {
    const cached = screenshotCache.get(id);
    if (cached) return cached;
    const buf = await readStoredFile(storageKey, "image/png");
    if (!buf) return undefined;
    const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    screenshotCache.set(id, dataUrl);
    return dataUrl;
  }

  payload.bugs = [];
  for (const bug of evidenceBugs) {
    const shot = bug.evidence.find((item) => item.screenshot)?.screenshot;
    const details = (bug.technicalDetails ?? {}) as {
      selector?: string;
      element?: string;
      consoleErrors?: string[];
      networkErrors?: string[];
    };
    const pageMatch = scan.pages.find((page) => page.url === bug.url || page.url === bug.pageUrl);
    const pageConsoles = pageMatch
      ? scan.consoleErrors.filter((item) => item.pageId === pageMatch.id).map((item) => item.message)
      : [];
    const pageNetworks = pageMatch
      ? scan.networkErrors
          .filter((item) => item.pageId === pageMatch.id)
          .map((item) => `${item.method ?? "GET"} ${item.requestUrl} ${item.statusCode ?? item.error ?? ""}`.trim())
      : [];
    const affected = Array.isArray(bug.affectedUrls) ? (bug.affectedUrls as string[]) : [];
    payload.bugs.push({
      bugNumber: bug.bugNumber,
      title: bug.title,
      severity: bug.severity,
      priority: bug.priority,
      category: bug.category,
      status: bug.status,
      url: bug.url,
      pageUrl: bug.pageUrl ?? bug.url,
      pageTitle: pageMatch?.title ?? undefined,
      element: details.element,
      selector: details.selector,
      description: bug.description,
      expected: bug.expected ?? "",
      actual: bug.actual ?? "",
      steps: bug.stepsToReproduce ?? "",
      rootCause: bug.rootCause ?? undefined,
      recommendedAction: bug.recommendedAction ?? undefined,
      evidence: bug.evidence.map((item) => item.path ?? item.type).join(", "),
      occurrences: bug.occurrences,
      affectedUrls: affected,
      browser: bug.browser ?? undefined,
      viewport: bug.viewport ?? undefined,
      consoleErrors: details.consoleErrors?.length ? details.consoleErrors : pageConsoles.slice(0, 8),
      networkErrors: details.networkErrors?.length ? details.networkErrors : pageNetworks.slice(0, 8),
      screenshotDataUrl: shot ? await toDataUrl(shot.storageKey, shot.id) : undefined,
    });
  }

  for (const page of scan.pages) {
    for (const shot of page.screenshots) {
      if (!["DESKTOP", "TABLET", "MOBILE", "WIDE", "LAPTOP", "COMPACT", "original"].includes(shot.kind)) continue;
      await toDataUrl(shot.storageKey, shot.id);
    }
  }
  const coverage = resolveScanCoverage(scan.configuration);
  payload.screenshotDataUrls = [...screenshotCache.values()].slice(0, coverage === "SCREENSHOTS" ? 60 : 24);

  payload.pages = await Promise.all(
    scan.pages.map(async (page) => {
      const shot =
        page.screenshots.find((item) => item.kind === "DESKTOP" || item.kind === "original") ?? page.screenshots[0];
      return {
        url: page.url,
        status: page.httpStatus,
        title: page.title,
        responseTimeMs: page.responseTimeMs,
        testsExecuted: page.elements.length + page.forms.length,
        errors: page.consoleErrors.length + page.accessibility.length,
        screenshotDataUrl: shot ? await toDataUrl(shot.storageKey, shot.id) : undefined,
      };
    }),
  );

  const formats: Array<{
    format: "JSON" | "HTML" | "PDF" | "XLSX" | "CSV";
    ext: string;
    kind?: string;
    writer: (file: string) => Promise<void>;
  }> = [
    {
      format: "JSON",
      ext: "json",
      writer: (file) =>
        writeJsonReport(file, {
          ...payload,
          bugs: payload.bugs.map(({ screenshotDataUrl: _shot, ...bug }) => bug),
          pages: payload.pages.map(({ screenshotDataUrl: _pageShot, ...page }) => page),
        }),
    },
    { format: "HTML", ext: "html", writer: (file) => writeHtmlReport(file, payload) },
    { format: "XLSX", ext: "xlsx", writer: (file) => writeXlsxReport(file, payload) },
    { format: "CSV", ext: "csv", writer: (file) => writeCsvReport(file, payload) },
    { format: "PDF", ext: "pdf", kind: "qa-report", writer: (file) => writePdfReport(file, payload) },
    { format: "PDF", ext: "pdf", kind: "qa-bug-details", writer: (file) => writeBugDetailsPdfReport(file, payload) },
  ];

  for (const item of formats) {
    const fileName = reportFileName(scan.host, item.ext, item.kind);
    const key = scanFileKey("reports", scanId, fileName);
    const abs = path.join(STORAGE_ROOT, key);
    await ensureDir(path.posix.dirname(key));
    await item.writer(abs);
    await ingestStoredFile(key, abs, mimeForReport(item.format, item.ext));
    await prisma.report.create({
      data: { scanId, format: item.format, storageKey: key, filePath: abs, fileName },
    });
  }
}

function mimeForReport(format: string, ext: string): string {
  if (format === "PDF" || ext === "pdf") return "application/pdf";
  if (format === "XLSX" || ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (format === "HTML" || ext === "html") return "text/html";
  if (format === "CSV" || ext === "csv") return "text/csv";
  return "application/json";
}

async function upsertEngineIssue(
  category: BugCategory,
  scanId: string,
  url: string,
  rule: string,
  severity: Severity,
  message: string,
  page: PlaywrightPage,
  screenshot: { id: string; storageKey: string } | null,
) {
  if (!isDetailedEvidenceBug({ category, rule, title: message, description: message, actual: message })) {
    return { bug: null, page };
  }
  const bug = await upsertBug({
    scanId,
    fingerprint: makeFingerprint({ category, signature: `${rule}:${message}`, url }),
    title: `${category}: ${message}`,
    description: message,
    category,
    severity,
    url,
    pageUrl: url,
    expected: "Page should satisfy the check",
    actual: message,
    stepsToReproduce: `1. Open ${url}\n2. Inspect ${rule}`,
    recommendedAction: strings.recommendations[category] ?? strings.recommendations.TECHNICAL,
    verified: true,
    source: "rule",
    status: "CONFIRMED",
  });
  if (screenshot) await linkScreenshotToBug(bug.id, screenshot);
  return { bug, page };
}

function loginAbsoluteUrl(startUrl: string, loginUrl?: string): string {
  if (loginUrl && /^https?:\/\//i.test(loginUrl)) return loginUrl;
  if (loginUrl?.startsWith("/")) return new URL(loginUrl, startUrl).href;
  return new URL("/login", startUrl).href;
}

async function captureLoginScreenshot(
  scanId: string,
  startUrl: string,
  login: ScanLogin,
  page: PlaywrightPage,
  config: ScanConfig,
  redis: Redis,
): Promise<void> {
  const loginUrl = loginAbsoluteUrl(startUrl, login.loginUrl);
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: config.timeoutMs }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => undefined);
  const finalUrl = page.url() && page.url() !== "about:blank" ? page.url() : loginUrl;
  const normalized = normalizeUrl(finalUrl, startUrl);
  const row = await prisma.page.upsert({
    where: { scanId_normalizedUrl: { scanId, normalizedUrl: normalized } },
    update: {},
    create: {
      scanId,
      url: finalUrl,
      normalizedUrl: normalized,
      depth: 0,
      parentUrl: null,
      status: "SCANNING",
      title: (await page.title().catch(() => "Login")) || "Login",
    },
  });
  await captureViewportScreenshots(scanId, row.id, page, config, redis, finalUrl);
  await prisma.page.update({
    where: { id: row.id },
    data: { status: "SCANNED", title: (await page.title().catch(() => row.title)) || row.title, scannedAt: new Date() },
  });
}

async function captureViewportScreenshots(
  scanId: string,
  pageId: string,
  page: PlaywrightPage,
  config: ScanConfig,
  redis: Redis,
  url: string,
): Promise<{ id: string; storageKey: string } | null> {
  const coverage = resolveScanCoverage(config);
  if (!config.captureScreenshots && coverage !== "SCREENSHOTS") return null;
  const modes = screenshotViewportsFor(coverage, config.viewport);
  await setScanLiveState(redis, scanId, { url, action: `Capturing screenshots of ${url}` });
  let first: { id: string; storageKey: string } | null = null;
  for (const name of modes) {
    const size = viewportFor(name);
    await page.setViewportSize(size).catch(() => undefined);
    await page.waitForTimeout(200);
    const shot = await captureFullPageScreenshot(
      scanId,
      pageId,
      page,
      `${name} ${size.width}x${size.height}`,
      name,
    );
    if (!first) first = shot;
  }
  await page.setViewportSize(viewportFor("DESKTOP")).catch(() => undefined);
  if (first) {
    await emitScanEvent(
      redis,
      scanId,
      "scan.progress",
      `Captured ${modes.length} screenshot${modes.length === 1 ? "" : "s"} of ${url}`,
      { url, viewports: modes },
    );
  }
  return first;
}

async function captureFullPageScreenshot(
  scanId: string,
  pageId: string,
  page: PlaywrightPage,
  viewport: string,
  kind = "original",
): Promise<{ id: string; storageKey: string } | null> {
  try {
    const key = scanFileKey("screenshots", scanId, `${pageId}-${kind}-full.png`);
    const abs = path.join(STORAGE_ROOT, key);
    await ensureDir(path.posix.dirname(key));
    await screenshotPage(page, abs, true);
    await ingestStoredFile(key, abs, "image/png");
    return prisma.screenshot.create({
      data: {
        pageId,
        kind,
        storageKey: key,
        filePath: abs,
        viewport,
      },
    });
  } catch {
    return null;
  }
}

async function linkScreenshotToBug(
  bugId: string,
  screenshot: { id: string; storageKey: string } | null,
): Promise<void> {
  if (!screenshot) return;
  const existing = await prisma.bugEvidence.findFirst({
    where: { bugId, screenshotId: { not: null } },
  });
  if (existing) return;
  await prisma.bugEvidence.create({
    data: {
      bugId,
      type: "screenshot",
      screenshotId: screenshot.id,
      path: screenshot.storageKey,
      mimeType: "image/png",
    },
  });
}

async function attachScreenshotFromPageId(bugId: string, pageId: string | null | undefined): Promise<void> {
  if (!pageId) return;
  const screenshot = await prisma.screenshot.findFirst({
    where: { pageId },
    orderBy: { createdAt: "asc" },
  });
  await linkScreenshotToBug(bugId, screenshot);
}

async function backfillBugScreenshots(scanId: string): Promise<void> {
  const bugs = await prisma.bug.findMany({
    where: { scanId, evidence: { none: { screenshotId: { not: null } } } },
  });
  if (bugs.length === 0) return;

  const pages = await prisma.page.findMany({
    where: { scanId },
    include: { screenshots: { orderBy: { createdAt: "asc" }, take: 1 } },
  });

  for (const bug of bugs) {
    const page =
      pages.find((item) => item.url === bug.pageUrl || item.url === bug.url) ??
      pages.find((item) => bug.url.startsWith(item.url)) ??
      pages[0];
    const screenshot = page?.screenshots[0];
    await linkScreenshotToBug(bug.id, screenshot ?? null);
  }
}

async function attachAnnotated(
  scanId: string,
  pageId: string,
  bugId: string,
  page: PlaywrightPage,
  box: { x: number; y: number; width: number; height: number } | null,
) {
  const originalKey = scanFileKey("screenshots", scanId, `${pageId}-${bugId.slice(-6)}-orig.png`);
  const annotatedKey = scanFileKey("screenshots", scanId, `${pageId}-${bugId.slice(-6)}-ann.png`);
  const cropKey = scanFileKey("screenshots", scanId, `${pageId}-${bugId.slice(-6)}-crop.png`);
  const originalAbs = path.join(STORAGE_ROOT, originalKey);
  const annotatedAbs = path.join(STORAGE_ROOT, annotatedKey);
  const cropAbs = path.join(STORAGE_ROOT, cropKey);
  await ensureDir(path.posix.dirname(originalKey));
  await screenshotPage(page, originalAbs, true);
  await annotateScreenshot(originalAbs, annotatedAbs, box).catch(() => undefined);
  if (box) await cropScreenshot(originalAbs, cropAbs, box).catch(() => undefined);
  await ingestStoredFile(originalKey, originalAbs, "image/png");
  await ingestStoredFile(annotatedKey, annotatedAbs, "image/png");
  if (box) await ingestStoredFile(cropKey, cropAbs, "image/png");
  const orig = await prisma.screenshot.create({
    data: { pageId, kind: "original", storageKey: originalKey, filePath: originalAbs },
  });
  const ann = await prisma.screenshot.create({
    data: { pageId, kind: "annotated", storageKey: annotatedKey, filePath: annotatedAbs },
  });
  await prisma.bugEvidence.createMany({
    data: [
      { bugId, type: "screenshot", screenshotId: orig.id, path: originalKey, mimeType: "image/png" },
      { bugId, type: "annotated", screenshotId: ann.id, path: annotatedKey, mimeType: "image/png" },
    ],
  });
}

async function withRetry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const transient = /timeout|502|503|crash|net::/.test(message);
      if (!transient || i === attempts - 1) throw error;
    }
  }
  throw last instanceof Error ? last : new Error("Retry failed");
}

function resourceCheckCaps(config: ScanConfig) {
  const full = resolveScanCoverage(config) !== "LANDING";
  return {
    links: full ? 250 : 80,
    images: full ? 150 : 60,
    checkTimeoutMs: 4000,
    checkConcurrency: Math.min(12, Math.max(6, config.concurrency * 3)),
  };
}

async function collectImageSizes(page: PlaywrightPage): Promise<Map<string, { w: number; h: number }>> {
  const rows = await page
    .evaluate(() =>
      Array.from(document.images).map((img) => ({
        src: img.currentSrc || img.src,
        w: img.naturalWidth,
        h: img.naturalHeight,
      })),
    )
    .catch(() => [] as Array<{ src: string; w: number; h: number }>);
  return new Map(rows.map((row) => [row.src, { w: row.w, h: row.h }]));
}
