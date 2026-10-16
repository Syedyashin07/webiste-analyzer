import fs from "node:fs";
import path from "node:path";
import "./playwright-env.js";
import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page, type Request } from "playwright";
import {
  CRAWLER_USER_AGENT,
  VIEWPORTS,
  pickReplayHeaders,
  safeRequestBody,
  type BrowserEngine,
  type ViewportName,
} from "@qa-scanner/shared";

export { ensurePlaywrightBrowsersPath } from "./playwright-env.js";

export interface ConsoleEntry {
  type: string;
  text: string;
  location?: string;
}

export interface NetworkEntry {
  url: string;
  method: string;
  status: number | null;
  resourceType: string;
  failure: string | null;
  initiator: string | null;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
}

export interface CollectedPage {
  url: string;
  finalUrl: string;
  title: string;
  html: string;
  status: number | null;
  responseTimeMs: number;
  redirectedFrom: string | null;
  consoleEntries: ConsoleEntry[];
  networkEntries: NetworkEntry[];
  cookies: Array<{ name: string; domain: string; secure: boolean; httpOnly: boolean }>;
  localStorageOk: boolean;
  language: string | null;
  resourceCount: number;
  viewport: { width: number; height: number };
  metrics: PerformanceDomMetrics;
}

export interface PerformanceDomMetrics {
  ttfbMs: number | null;
  domContentLoadedMs: number | null;
  loadEventMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number | null;
  transferSize: number | null;
  jsSize: number | null;
  cssSize: number | null;
  imageSize: number | null;
  requestCount: number | null;
  longTaskCount: number | null;
}

export interface VisualGeometryFinding {
  type:
    | "horizontal_overflow"
    | "element_overflow"
    | "outside_viewport"
    | "overlapping"
    | "large_blank"
    | "hidden_button"
    | "broken_image";
  selector: string;
  message: string;
  box: { x: number; y: number; width: number; height: number } | null;
}

const ESBUILD_NAME_HELPER = "globalThis.__name = globalThis.__name || function (target) { return target; };";

export function missingPlaywrightChromiumMessage(): string | null {
  const exe = chromium.executablePath();
  if (fs.existsSync(exe)) return null;
  return `Playwright Chromium is missing (${exe}). Run: npx playwright install chromium`;
}

export async function launchBrowser(engine: BrowserEngine = "chromium", options?: { headless?: boolean; slowMo?: number }): Promise<Browser> {
  const chromiumMissing = missingPlaywrightChromiumMessage();
  if (engine === "chromium" && chromiumMissing) {
    throw new Error(chromiumMissing);
  }
  const headless = options?.headless !== false;
  const args = engine === "chromium" ? ["--disable-dev-shm-usage"] : [];
  if (!headless && engine === "chromium") args.push("--start-maximized", "--window-position=40,40");
  const launchOptions = { headless, slowMo: options?.slowMo, args };
  const launchers = { chromium, firefox, webkit } as const;
  try {
    return await launchers[engine].launch(launchOptions);
  } catch (error) {
    if (engine !== "chromium" && !chromiumMissing) {
      return chromium.launch({ headless, slowMo: options?.slowMo, args: ["--disable-dev-shm-usage", "--start-maximized"] });
    }
    throw chromiumMissing ? new Error(chromiumMissing) : error;
  }
}

export async function prepareContext(context: BrowserContext): Promise<void> {
  await context.addInitScript(ESBUILD_NAME_HELPER);
}

export function viewportFor(name: ViewportName) {
  return { width: VIEWPORTS[name].width, height: VIEWPORTS[name].height };
}

export async function createScanContext(
  browser: Browser,
  options: {
    viewport?: { width: number; height: number } | null;
    recordVideoDir?: string;
  } = {},
): Promise<BrowserContext> {
  const viewport = options.viewport === undefined ? viewportFor("DESKTOP") : options.viewport;
  const context = await browser.newContext({
    viewport,
    userAgent: CRAWLER_USER_AGENT,
    ignoreHTTPSErrors: false,
    recordVideo: options.recordVideoDir ? { dir: options.recordVideoDir, size: viewport ?? viewportFor("DESKTOP") } : undefined,
  });
  await prepareContext(context);
  return context;
}

export async function installPageHelpers(page: Page): Promise<void> {
  await page.evaluate(ESBUILD_NAME_HELPER);
}

function snapshotNetwork(request: Request, status: number | null, failure: string | null): NetworkEntry {
  return {
    url: request.url(),
    method: request.method(),
    status,
    resourceType: request.resourceType(),
    failure,
    initiator: request.redirectedFrom()?.url() ?? null,
    requestHeaders: pickReplayHeaders(request.headers()),
    requestBody: safeRequestBody(request.postData()),
  };
}

export function attachCollectors(page: Page): {
  consoleEntries: ConsoleEntry[];
  networkEntries: NetworkEntry[];
} {
  const consoleEntries: ConsoleEntry[] = [];
  const networkEntries: NetworkEntry[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleEntries.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location().url,
      });
    }
  });

  page.on("pageerror", (error) => {
    consoleEntries.push({
      type: "pageerror",
      text: error.message,
      location: error.stack,
    });
  });

  page.on("requestfailed", (request) => {
    networkEntries.push(snapshotNetwork(request, null, request.failure()?.errorText ?? "requestfailed"));
  });

  page.on("response", (response) => {
    if (response.status() >= 400) {
      networkEntries.push(snapshotNetwork(response.request(), response.status(), null));
    }
  });

  return { consoleEntries, networkEntries };
}

export async function collectPerformance(page: Page): Promise<PerformanceDomMetrics> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const paints = performance.getEntriesByType("paint");
    const fcp = paints.find((entry) => entry.name === "first-contentful-paint")?.startTime ?? null;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const longTasks = performance.getEntriesByType("longtask");

    let lcp: number | null = null;
    let cls = 0;
    const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
    if (lcpEntries.length > 0) lcp = lcpEntries[lcpEntries.length - 1]?.startTime ?? null;
    for (const entry of performance.getEntriesByType("layout-shift")) {
      const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
      if (!shift.hadRecentInput) cls += shift.value ?? 0;
    }

    const sizeOf = (predicate: (item: PerformanceResourceTiming) => boolean) =>
      resources.filter(predicate).reduce((sum, item) => sum + (item.transferSize || 0), 0);

    return {
      ttfbMs: nav ? Math.round(nav.responseStart) : null,
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadEventMs: nav ? Math.round(nav.loadEventEnd) : null,
      fcpMs: fcp,
      lcpMs: lcp,
      cls,
      transferSize: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0),
      jsSize: sizeOf((item) => item.initiatorType === "script"),
      cssSize: sizeOf((item) => item.initiatorType === "link" || item.initiatorType === "css"),
      imageSize: sizeOf((item) => item.initiatorType === "img" || item.initiatorType === "image"),
      requestCount: resources.length,
      longTaskCount: longTasks.length,
    };
  });
}

export async function collectGeometry(page: Page): Promise<VisualGeometryFinding[]> {
  return page.evaluate(() => {
    const findings: Array<{
      type:
        | "horizontal_overflow"
        | "element_overflow"
        | "outside_viewport"
        | "overlapping"
        | "large_blank"
        | "hidden_button"
        | "broken_image";
      selector: string;
      message: string;
      box: { x: number; y: number; width: number; height: number } | null;
    }> = [];

    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth + 8) {
      findings.push({
        type: "horizontal_overflow",
        selector: "html",
        message: `Horizontal overflow detected (${doc.scrollWidth}px vs ${doc.clientWidth}px)`,
        box: { x: 0, y: 0, width: doc.scrollWidth, height: 20 },
      });
    }

    const cssPath = (el: Element): string => {
      if (el.id) return `#${el.id}`;
      const tag = el.tagName.toLowerCase();
      const parent = el.parentElement;
      if (!parent) return tag;
      const index = Array.from(parent.children).indexOf(el) + 1;
      return `${cssPath(parent)} > ${tag}:nth-child(${index})`;
    };

    const boxes: Array<{ el: Element; box: DOMRect }> = [];
    const candidates = Array.from(
      document.querySelectorAll("body *"),
    ).slice(0, 400);

    for (const el of candidates) {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      boxes.push({ el, box });

      if (el.scrollWidth > el.clientWidth + 4 && style.overflowX !== "visible") {
        findings.push({
          type: "element_overflow",
          selector: cssPath(el),
          message: "Element content overflows its box",
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
        });
      }
      if (box.right < -20 || box.left > window.innerWidth + 20) {
        findings.push({
          type: "outside_viewport",
          selector: cssPath(el),
          message: "Element is outside the viewport horizontally",
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
        });
      }
      if (el instanceof HTMLImageElement && (el.naturalWidth === 0 || el.naturalHeight === 0) && el.src) {
        findings.push({
          type: "broken_image",
          selector: cssPath(el),
          message: "Image failed to load (natural dimensions are 0)",
          box: { x: box.x, y: box.y, width: Math.max(box.width, 1), height: Math.max(box.height, 1) },
        });
      }
      if (el instanceof HTMLButtonElement && style.opacity === "0") {
        findings.push({
          type: "hidden_button",
          selector: cssPath(el),
          message: "Button is present but visually hidden (opacity 0)",
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
        });
      }
    }

    const bodyHeight = document.body.scrollHeight || 0;
    if (bodyHeight > window.innerHeight * 3) {
      const children = Array.from(document.body.children);
      for (const child of children) {
        const box = child.getBoundingClientRect();
        if (box.height > window.innerHeight * 1.5 && child.textContent?.trim() === "") {
          findings.push({
            type: "large_blank",
            selector: cssPath(child),
            message: "Large blank region detected",
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
          });
        }
      }
    }

    for (let i = 0; i < Math.min(boxes.length, 80); i += 1) {
      for (let j = i + 1; j < Math.min(boxes.length, i + 12); j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        if (!a || !b) continue;
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const overlapX = Math.max(
          0,
          Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left),
        );
        const overlapY = Math.max(
          0,
          Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top),
        );
        const overlap = overlapX * overlapY;
        const minArea = Math.min(a.box.width * a.box.height, b.box.width * b.box.height);
        if (minArea > 400 && overlap > minArea * 0.6) {
          const styleA = window.getComputedStyle(a.el);
          const styleB = window.getComputedStyle(b.el);
          if (styleA.position === "static" && styleB.position === "static") continue;
          findings.push({
            type: "overlapping",
            selector: cssPath(a.el),
            message: `Overlapping elements: ${a.el.tagName} and ${b.el.tagName}`,
            box: { x: a.box.x, y: a.box.y, width: a.box.width, height: a.box.height },
          });
          break;
        }
      }
    }

    return findings.slice(0, 25);
  });
}

export async function navigateAndCollect(
  page: Page,
  url: string,
  timeoutMs: number,
): Promise<CollectedPage> {
  const collectors = attachCollectors(page);
  const started = Date.now();
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 8000) }).catch(() => undefined);
  await installPageHelpers(page).catch(() => undefined);
  const responseTimeMs = Date.now() - started;
  const html = await page.content();
  const title = await page.title();
  const cookies = (await page.context().cookies()).map((cookie) => ({
    name: cookie.name,
    domain: cookie.domain,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
  }));

  const localStorageOk = await page
    .evaluate(() => {
      try {
        const key = "__qa_scanner_probe";
        localStorage.setItem(key, "1");
        localStorage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    })
    .catch(() => false);

  const language = await page.locator("html").getAttribute("lang");
  const metrics = await collectPerformance(page);
  const viewportSize = page.viewportSize() ?? { width: 1920, height: 1080 };

  return {
    url,
    finalUrl: page.url(),
    title,
    html,
    status: response?.status() ?? null,
    responseTimeMs,
    redirectedFrom: response?.request().redirectedFrom()?.url() ?? (page.url() !== url ? url : null),
    consoleEntries: collectors.consoleEntries,
    networkEntries: collectors.networkEntries,
    cookies,
    localStorageOk,
    language,
    resourceCount: metrics.requestCount ?? 0,
    viewport: viewportSize,
    metrics,
  };
}

export async function screenshotPage(
  page: Page,
  filePath: string,
  fullPage = true,
): Promise<void> {
  await page.screenshot({ path: filePath, fullPage, type: "png" });
}

export async function startTrace(context: BrowserContext): Promise<void> {
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
}

export async function stopTrace(context: BrowserContext, filePath: string): Promise<void> {
  await context.tracing.stop({ path: filePath });
}

export async function videoPathFromPage(page: Page): Promise<string | null> {
  const video = page.video();
  if (!video) return null;
  return video.path();
}

export async function closePageVideo(page: Page, targetPath: string): Promise<string | null> {
  const video = page.video();
  await page.close();
  if (!video) return null;
  await video.saveAs(targetPath);
  await video.delete().catch(() => undefined);
  return targetPath;
}

export async function extractRenderedLinks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const urls = new Set<string>();
    const isPageUrl = (href: string) => {
      try {
        const parsed = new URL(href, location.href);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
        if (parsed.pathname.includes("/_next/")) return false;
        if (/\.(css|js|map|woff2?|ttf|eot|png|jpe?g|gif|svg|ico|webp|mp4|webm|pdf|txt|json)$/i.test(parsed.pathname)) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    };
    const add = (raw: string | null | undefined) => {
      if (!raw) return;
      const value = raw.trim();
      if (!value || value.startsWith("javascript:") || value.startsWith("mailto:") || value.startsWith("tel:")) return;
      try {
        const href = new URL(value, location.href).href;
        if (isPageUrl(href)) urls.add(href);
      } catch {
        /* ignore invalid */
      }
    };
    document.querySelectorAll("[href], [data-href], [data-to], [data-url], [routerlink], [ng-href]").forEach((node) => {
      const el = node as HTMLElement;
      add(el.getAttribute("href"));
      add(el.getAttribute("data-href"));
      add(el.getAttribute("data-to"));
      add(el.getAttribute("data-url"));
      add(el.getAttribute("routerlink"));
      add(el.getAttribute("ng-href"));
    });
    document.querySelectorAll("button, [role='link'], [role='tab']").forEach((node) => {
      const el = node as HTMLElement;
      add(el.getAttribute("data-href"));
      add(el.dataset.href);
    });
    return [...urls];
  });
}

export { path };
export { signInToSite, looksLikeLoginUrl, type SiteLoginOptions, type SiteLoginResult } from "./login.js";
