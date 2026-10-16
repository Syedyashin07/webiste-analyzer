import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import "@qa-scanner/browser/playwright-env";
import { chromium } from "playwright";
import { sanitizeFilePart, strings } from "@qa-scanner/shared";

export interface ReportBug {
  bugNumber: string;
  title: string;
  severity: string;
  priority: string;
  category: string;
  status: string;
  url: string;
  pageUrl?: string;
  pageTitle?: string;
  element?: string;
  selector?: string;
  description?: string;
  expected: string;
  actual: string;
  steps: string;
  rootCause?: string;
  recommendedAction?: string;
  evidence: string;
  occurrences: number;
  affectedUrls?: string[];
  browser?: string;
  viewport?: string;
  consoleErrors?: string[];
  networkErrors?: string[];
  screenshotDataUrl?: string;
}

export interface ReportPage {
  url: string;
  status: number | null;
  title: string | null;
  responseTimeMs: number | null;
  testsExecuted?: number;
  errors?: number;
  screenshotDataUrl?: string;
}

export interface ReportPayload {
  scanId: string;
  website: string;
  scannedAt: string;
  health: {
    overall: number;
    performance: number;
    accessibility: number;
    seo: number;
    security: number;
    functional: number;
    visual: number;
    technical: number;
  };
  pagesScanned: number;
  pagesFailed: number;
  inventory?: {
    coverage: string;
    coverageLabel: string;
    pagesDiscovered: number;
    pagesScanned: number;
    pagesFailed: number;
    linksFound: number;
    brokenLinks: number;
    imagesFound: number;
    brokenImages: number;
    formsFound: number;
    elementsFound: number;
    apiFailures: number;
  };
  issueCounts: Record<string, number>;
  bugs: ReportBug[];
  pages: ReportPage[];
  brokenLinks: Array<{ page: string; href: string; status: number | null; text: string | null }>;
  brokenImages: Array<{ page: string; src: string; status: number | null }>;
  consoleErrors: Array<{ page: string; message: string }>;
  networkErrors: Array<{ page: string; method?: string; url: string; status: number | null }>;
  seo: Array<{ page: string; message: string }>;
  accessibility: Array<{ page: string; message: string }>;
  performance: Array<{ page: string; score: number | null; loadEventMs: number | null }>;
  security: Array<{ page: string; message: string }>;
  recommendations: string[];
  screenshotDataUrls?: string[];
}

export function inventorySummary(payload: ReportPayload): string {
  const inventory = payload.inventory;
  if (!inventory) {
    return `Pages scanned: ${payload.pagesScanned}. Failed pages: ${payload.pagesFailed}. Issues: ${payload.bugs.length}.`;
  }
  return [
    `Coverage: ${inventory.coverageLabel}.`,
    `Pages discovered: ${inventory.pagesDiscovered}. Scanned: ${inventory.pagesScanned}. Failed: ${inventory.pagesFailed}.`,
    `Links found: ${inventory.linksFound} (${inventory.brokenLinks} broken).`,
    `Images found: ${inventory.imagesFound} (${inventory.brokenImages} broken).`,
    `Forms: ${inventory.formsFound}. Elements: ${inventory.elementsFound}. API failures: ${inventory.apiFailures}.`,
    `Issues: ${payload.bugs.length}.`,
  ].join(" ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildHtmlReport(payload: ReportPayload): string {
  const bugs = payload.bugs
    .map(
      (bug) => `<article class="bug">
        <h3>${escapeHtml(bug.bugNumber)} — ${escapeHtml(bug.title)}</h3>
        <p><strong>${escapeHtml(bug.severity)}</strong> · ${escapeHtml(bug.category)} · ${escapeHtml(bug.status)}</p>
        <p>URL: ${escapeHtml(bug.url)}</p>
        <p>Expected: ${escapeHtml(bug.expected)}</p>
        <p>Actual: ${escapeHtml(bug.actual)}</p>
        <pre>${escapeHtml(bug.steps)}</pre>
        ${bug.screenshotDataUrl ? `<img src="${bug.screenshotDataUrl}" alt="Screenshot evidence for ${escapeHtml(bug.bugNumber)}" />` : ""}
      </article>`,
    )
    .join("\n");

  const shots = (payload.screenshotDataUrls ?? [])
    .slice(0, 12)
    .map((src) => `<img src="${src}" alt="Evidence screenshot" />`)
    .join("\n");

  const inventoryRows = payload.inventory
    ? [
        ["Coverage", payload.inventory.coverageLabel],
        ["Pages discovered", String(payload.inventory.pagesDiscovered)],
        ["Pages scanned", String(payload.inventory.pagesScanned)],
        ["Pages failed", String(payload.inventory.pagesFailed)],
        ["Links found", `${payload.inventory.linksFound} (${payload.inventory.brokenLinks} broken)`],
        ["Images found", `${payload.inventory.imagesFound} (${payload.inventory.brokenImages} broken)`],
        ["Forms", String(payload.inventory.formsFound)],
        ["Elements", String(payload.inventory.elementsFound)],
        ["API failures", String(payload.inventory.apiFailures)],
      ]
    : [
        ["Pages scanned", String(payload.pagesScanned)],
        ["Pages failed", String(payload.pagesFailed)],
      ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(strings.appName)} — ${escapeHtml(payload.website)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Segoe UI, sans-serif; color: #0f172a; margin: 0; padding: 24px 28px; line-height: 1.45; }
    h1,h2,h3 { color: #0f766e; margin: 0 0 10px; }
    h1 { font-size: 26px; }
    h2 { font-size: 18px; margin-top: 28px; padding-bottom: 6px; border-bottom: 2px solid #ccfbf1; }
    h3 { font-size: 15px; }
    p { margin: 0 0 10px; }
    .masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
    .score { font-size: 42px; font-weight: 700; line-height: 1; white-space: nowrap; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
    .card { border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; background: #fff; }
    .card strong { display: block; text-transform: capitalize; font-size: 12px; color: #475569; }
    .card div { margin-top: 4px; font-size: 20px; font-weight: 700; }
    .bug { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin: 10px 0; }
    img { max-width: 100%; height: auto; border: 1px solid #e2e8f0; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
    th, td { border: 1px solid #e2e8f0; padding: 8px; vertical-align: top; text-align: left; word-break: break-word; overflow-wrap: anywhere; }
    th { background: #f8fafc; }
    pre { white-space: pre-wrap; background: #f8fafc; padding: 8px; margin: 0; }
    .inventory-table th { width: 34%; }
    .pages-table th:nth-child(1) { width: 32%; }
    .pages-table th:nth-child(2) { width: 8%; }
    .pages-table th:nth-child(3) { width: 22%; }
    .pages-table th:nth-child(4), .pages-table th:nth-child(5) { width: 8%; }
    .pages-table th:nth-child(6) { width: 22%; }
    .shots { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    @media print {
      body { padding: 12mm; }
      .bug, .card, table { break-inside: avoid; }
    }
  </style>
</head>
<body class="report-layout">
  <header class="masthead">
    <div>
      <h1>${escapeHtml(strings.appName)}</h1>
      <p>${escapeHtml(payload.website)} · ${escapeHtml(payload.scannedAt)}</p>
    </div>
    <p class="score">${payload.health.overall}/100</p>
  </header>
  <div class="grid">
    ${Object.entries(payload.health)
      .filter(([key]) => key !== "overall")
      .map(([key, value]) => `<div class="card"><strong>${escapeHtml(key)}</strong><div>${value}</div></div>`)
      .join("")}
  </div>
  <h2>1. Executive Summary</h2>
  <p>${escapeHtml(inventorySummary(payload))}</p>
  <h2>2. Website Information</h2>
  <p>${escapeHtml(payload.website)}</p>
  <h2>3. Overall Health Score</h2>
  <p>${payload.health.overall}</p>
  <h2>4. Category Scores</h2>
  <ul>${Object.entries(payload.issueCounts)
    .map(([key, value]) => `<li>${escapeHtml(key)}: ${value}</li>`)
    .join("")}</ul>
  <h2>5. Scan Inventory</h2>
  <table class="inventory-table">
    <tbody>${inventoryRows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}</tbody>
  </table>
  <h2>6. Pages Scanned</h2>
  <table class="pages-table">
    <thead><tr><th>URL</th><th>Status</th><th>Title</th><th>Tests</th><th>Errors</th><th>Screenshot</th></tr></thead>
    <tbody>
      ${payload.pages
        .map(
          (page) => `<tr>
            <td>${escapeHtml(page.url)}</td>
            <td>${page.status ?? "n/a"}</td>
            <td>${escapeHtml(page.title ?? "")}</td>
            <td>${page.testsExecuted ?? "n/a"}</td>
            <td>${page.errors ?? 0}</td>
            <td>${page.screenshotDataUrl ? `<img src="${page.screenshotDataUrl}" alt="Page screenshot" />` : ""}</td>
          </tr>`,
        )
        .join("")}
    </tbody>
  </table>
  <h2>7. Issues</h2>
  ${bugs || "<p>No issues found.</p>"}
  <h2>8. Broken Links</h2>
  <ul>${payload.brokenLinks.length ? payload.brokenLinks.map((item) => `<li>${escapeHtml(item.href)} from ${escapeHtml(item.page)}</li>`).join("") : "<li>None</li>"}</ul>
  <h2>9. Broken Images</h2>
  <ul>${payload.brokenImages.length ? payload.brokenImages.map((item) => `<li>${escapeHtml(item.src)}</li>`).join("") : "<li>None</li>"}</ul>
  <h2>10. Evidence</h2>
  <div class="shots">${shots || "<p>No screenshots attached.</p>"}</div>
  <h2>11. Recommendations</h2>
  <ul>${payload.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
</body>
</html>`;
}

export async function writeJsonReport(filePath: string, payload: ReportPayload): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

export async function writeHtmlReport(filePath: string, payload: ReportPayload): Promise<void> {
  await fs.writeFile(filePath, buildHtmlReport(payload), "utf8");
}

export async function writePdfReport(filePath: string, payload: ReportPayload): Promise<void> {
  await htmlToPdf(filePath, buildHtmlReport(payload));
}

export function buildBugDetailsHtml(payload: ReportPayload): string {
  const index = payload.bugs
    .map(
      (bug) => `<tr>
        <td>${escapeHtml(bug.bugNumber)}</td>
        <td>${escapeHtml(bug.severity)}</td>
        <td>${escapeHtml(bug.title)}</td>
        <td>${escapeHtml(bug.pageUrl || bug.url)}</td>
      </tr>`,
    )
    .join("");

  const cards = payload.bugs
    .map((bug) => {
      const location = bug.pageUrl || bug.url;
      const steps = stepLines(bug.steps, location, bug.element);
      const checkList = [
        `Open this location: ${location}`,
        bug.element ? `Find the control or area: ${bug.element}` : "Inspect the reported area on the page",
        ...steps,
        `Expected: ${bug.expected || "See expected result below"}`,
        `Actual: ${bug.actual || "Observe what happens"}`,
        "Confirm the screenshot and logs match what you see",
      ];
      const affected = (bug.affectedUrls ?? []).filter(Boolean);
      const consoles = bug.consoleErrors ?? [];
      const networks = bug.networkErrors ?? [];
      return `<article class="bug-page">
        <p class="kicker">${escapeHtml(bug.bugNumber)} · ${escapeHtml(bug.severity)} · ${escapeHtml(bug.priority)} · ${escapeHtml(bug.status)}</p>
        <h2>${escapeHtml(bug.title)}</h2>
        <table class="meta">
          <tr><th>Category</th><td>${escapeHtml(bug.category)}</td></tr>
          <tr><th>Location / URL</th><td>${escapeHtml(location)}</td></tr>
          <tr><th>Page title</th><td>${escapeHtml(bug.pageTitle || "—")}</td></tr>
          <tr><th>Element</th><td>${escapeHtml(bug.element || "—")}</td></tr>
          <tr><th>Selector</th><td>${escapeHtml(bug.selector || "—")}</td></tr>
          <tr><th>Browser / viewport</th><td>${escapeHtml([bug.browser, bug.viewport].filter(Boolean).join(" · ") || "—")}</td></tr>
          <tr><th>Occurrences</th><td>${bug.occurrences}</td></tr>
        </table>
        <h3>What this bug is</h3>
        <p>${escapeHtml(bug.description || bug.actual || bug.title)}</p>
        <h3>How to reproduce</h3>
        <ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
        <h3>How to check / verify</h3>
        <ol>${checkList.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
        <h3>Expected result</h3>
        <p>${escapeHtml(bug.expected || "—")}</p>
        <h3>Actual result</h3>
        <p>${escapeHtml(bug.actual || "—")}</p>
        <h3>Likely cause</h3>
        <p>${escapeHtml(bug.rootCause || "Needs investigation")}</p>
        <h3>Recommended action</h3>
        <p>${escapeHtml(bug.recommendedAction || "—")}</p>
        ${affected.length ? `<h3>Also seen on</h3><ul>${affected.map((url) => `<li>${escapeHtml(url)}</li>`).join("")}</ul>` : ""}
        ${consoles.length ? `<h3>Console errors</h3><pre>${escapeHtml(consoles.join("\n"))}</pre>` : ""}
        ${networks.length ? `<h3>Network errors</h3><pre>${escapeHtml(networks.join("\n"))}</pre>` : ""}
        <h3>Evidence</h3>
        <p>${escapeHtml(bug.evidence || "See screenshot if available")}</p>
        ${bug.screenshotDataUrl ? `<img src="${bug.screenshotDataUrl}" alt="Screenshot evidence for ${escapeHtml(bug.bugNumber)}" />` : "<p>No screenshot captured for this bug.</p>"}
      </article>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Bug details — ${escapeHtml(payload.website)}</title>
  <style>
    body { font-family: Segoe UI, sans-serif; color: #0f172a; margin: 28px; }
    h1,h2,h3 { color: #0f766e; }
    .kicker { color: #334155; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0 16px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; text-align: left; }
    th { width: 180px; background: #f8fafc; }
    pre { white-space: pre-wrap; background: #f8fafc; padding: 8px; }
    img { max-width: 100%; border: 1px solid #e2e8f0; margin: 8px 0; }
    .bug-page { page-break-after: always; padding-bottom: 16px; }
    .cover { page-break-after: always; }
    ol { padding-left: 20px; }
  </style>
</head>
<body>
  <section class="cover">
    <h1>Bug details report</h1>
    <p>${escapeHtml(payload.website)}</p>
    <p>Scan ${escapeHtml(payload.scanId)} · ${escapeHtml(payload.scannedAt)}</p>
    <p>This PDF is a separate reproduction guide. Each bug includes location, steps to reproduce, expected vs actual, and evidence so a tester can check it.</p>
    <p>Bugs: ${payload.bugs.length}. Critical ${payload.issueCounts.CRITICAL ?? 0} · High ${payload.issueCounts.HIGH ?? 0} · Medium ${payload.issueCounts.MEDIUM ?? 0} · Low ${payload.issueCounts.LOW ?? 0}.</p>
    <h2>Index</h2>
    <table>
      <thead><tr><th>Bug ID</th><th>Severity</th><th>Title</th><th>Location</th></tr></thead>
      <tbody>${index || `<tr><td colspan="4">No bugs found.</td></tr>`}</tbody>
    </table>
  </section>
  ${cards || "<p>No bugs to document.</p>"}
</body>
</html>`;
}

function stepLines(steps: string, location: string, element?: string): string[] {
  const fromReport = steps
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  if (fromReport.length > 0) return fromReport;
  return [
    `Open ${location}`,
    element ? `Locate "${element}"` : "Inspect the page",
    "Perform the reported action",
    "Compare expected and actual results",
  ];
}

async function htmlToPdf(filePath: string, html: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({ path: filePath, format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" } });
  } finally {
    await browser.close();
  }
}

export async function writeBugDetailsPdfReport(filePath: string, payload: ReportPayload): Promise<void> {
  await htmlToPdf(filePath, buildBugDetailsHtml(payload));
}

export async function writeXlsxReport(filePath: string, payload: ReportPayload): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = strings.appName;

  const summary = workbook.addWorksheet("Summary");
  summary.addRows([
    ["Website", payload.website],
    ["Scan ID", payload.scanId],
    ["Scanned at", payload.scannedAt],
    ["Overall", payload.health.overall],
    ["Performance", payload.health.performance],
    ["Accessibility", payload.health.accessibility],
    ["SEO", payload.health.seo],
    ["Security", payload.health.security],
    ["Functional", payload.health.functional],
    ["Visual", payload.health.visual],
    ["Technical", payload.health.technical],
    ["Pages scanned", payload.pagesScanned],
    ["Pages failed", payload.pagesFailed],
    ...(payload.inventory
      ? [
          ["Coverage", payload.inventory.coverageLabel],
          ["Pages discovered", payload.inventory.pagesDiscovered],
          ["Links found", payload.inventory.linksFound],
          ["Broken links", payload.inventory.brokenLinks],
          ["Images found", payload.inventory.imagesFound],
          ["Broken images", payload.inventory.brokenImages],
          ["Forms", payload.inventory.formsFound],
          ["Elements", payload.inventory.elementsFound],
          ["API failures", payload.inventory.apiFailures],
        ]
      : []),
  ]);

  const bugs = workbook.addWorksheet("Bugs");
  bugs.columns = [
    { header: "Bug ID", key: "bugNumber", width: 14 },
    { header: "Title", key: "title", width: 40 },
    { header: "Severity", key: "severity", width: 12 },
    { header: "Priority", key: "priority", width: 10 },
    { header: "Category", key: "category", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "URL", key: "url", width: 40 },
    { header: "Expected", key: "expected", width: 30 },
    { header: "Actual", key: "actual", width: 30 },
    { header: "Steps", key: "steps", width: 30 },
    { header: "Evidence", key: "evidence", width: 24 },
    { header: "Occurrences", key: "occurrences", width: 14 },
  ];
  bugs.addRows(payload.bugs);

  const pages = workbook.addWorksheet("Pages");
  pages.columns = [
    { header: "URL", key: "url", width: 50 },
    { header: "Status", key: "status", width: 10 },
    { header: "Title", key: "title", width: 40 },
    { header: "Response ms", key: "responseTimeMs", width: 14 },
    { header: "Tests", key: "testsExecuted", width: 10 },
    { header: "Errors", key: "errors", width: 10 },
  ];
  pages.addRows(payload.pages);

  addSimpleSheet(workbook, "Broken Links", ["page", "href", "status", "text"], payload.brokenLinks);
  addSimpleSheet(workbook, "Broken Images", ["page", "src", "status"], payload.brokenImages);
  addSimpleSheet(workbook, "Console Errors", ["page", "message"], payload.consoleErrors);
  addSimpleSheet(workbook, "Network Errors", ["page", "method", "url", "status"], payload.networkErrors);
  addSimpleSheet(workbook, "SEO", ["page", "message"], payload.seo);
  addSimpleSheet(workbook, "Accessibility", ["page", "message"], payload.accessibility);
  addSimpleSheet(workbook, "Performance", ["page", "score", "loadEventMs"], payload.performance);
  addSimpleSheet(workbook, "Security", ["page", "message"], payload.security);

  await workbook.xlsx.writeFile(filePath);
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export async function writeCsvReport(filePath: string, payload: ReportPayload): Promise<void> {
  const lines: string[] = [];
  lines.push(["Website", payload.website].map(csvCell).join(","));
  lines.push(["Scan ID", payload.scanId].map(csvCell).join(","));
  lines.push(["Pages scanned", payload.pagesScanned].map(csvCell).join(","));
  lines.push(["Pages failed", payload.pagesFailed].map(csvCell).join(","));
  if (payload.inventory) {
    lines.push(["Coverage", payload.inventory.coverageLabel].map(csvCell).join(","));
    lines.push(["Pages discovered", payload.inventory.pagesDiscovered].map(csvCell).join(","));
    lines.push(["Links found", payload.inventory.linksFound].map(csvCell).join(","));
    lines.push(["Broken links", payload.inventory.brokenLinks].map(csvCell).join(","));
    lines.push(["Images found", payload.inventory.imagesFound].map(csvCell).join(","));
    lines.push(["Broken images", payload.inventory.brokenImages].map(csvCell).join(","));
    lines.push(["Forms", payload.inventory.formsFound].map(csvCell).join(","));
    lines.push(["Elements", payload.inventory.elementsFound].map(csvCell).join(","));
    lines.push(["API failures", payload.inventory.apiFailures].map(csvCell).join(","));
  }
  lines.push(["Bugs", payload.bugs.length].map(csvCell).join(","));
  lines.push("");
  lines.push(["Bug ID", "Title", "Severity", "Priority", "Category", "Status", "URL", "Expected", "Actual", "Steps", "Occurrences"].join(","));
  for (const bug of payload.bugs) {
    lines.push(
      [bug.bugNumber, bug.title, bug.severity, bug.priority, bug.category, bug.status, bug.url, bug.expected, bug.actual, bug.steps, bug.occurrences]
        .map(csvCell)
        .join(","),
    );
  }
  lines.push("");
  lines.push(["Page URL", "Status", "Title", "Response ms", "Tests", "Errors"].join(","));
  for (const page of payload.pages) {
    lines.push([page.url, page.status, page.title, page.responseTimeMs, page.testsExecuted ?? "", page.errors ?? 0].map(csvCell).join(","));
  }
  await fs.writeFile(filePath, lines.join("\n"), "utf8");
}

function addSimpleSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  keys: string[],
  rows: Array<Record<string, unknown>>,
) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = keys.map((key) => ({ header: key, key, width: 32 }));
  sheet.addRows(rows);
}

export interface FlowSlide {
  step: number;
  name: string;
  url: string;
  imageDataUrl: string;
}

export function buildFlowHtml(input: { siteName: string; website: string; slides: FlowSlide[] }): string {
  const boxes = input.slides
    .map((slide, index) => {
      const arrow = index < input.slides.length - 1 ? `<span class="arrow">→</span>` : "";
      return `<div class="step"><div class="box"><img src="${slide.imageDataUrl}" alt="${escapeHtml(slide.name)}" /><p>${slide.step}. ${escapeHtml(slide.name)}</p></div></div>${arrow}`;
    })
    .join("");
  const slides = input.slides
    .map(
      (slide) => `<section class="slide">
        <p class="kicker">Slide ${slide.step} of ${input.slides.length}</p>
        <h1>${escapeHtml(slide.name)}</h1>
        <p class="url">${escapeHtml(slide.url)}</p>
        <img class="shot" src="${slide.imageDataUrl}" alt="${escapeHtml(slide.name)}" />
      </section>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.siteName)} website flow</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Segoe UI, sans-serif; color: #1C1916; margin: 0; }
    h1 { color: #BF5700; margin: 0 0 8px; font-size: 28px; }
    .kicker { letter-spacing: 0.08em; text-transform: uppercase; font-size: 12px; color: #7D6E5D; margin: 0 0 6px; }
    .cover, .slide { page-break-after: always; }
    .flow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 4px; margin-top: 18px; }
    .box { width: 150px; border: 2px solid #BF5700; border-radius: 12px; background: #FFFBF5; padding: 8px; text-align: center; }
    .box img { width: 100%; height: 78px; object-fit: cover; object-position: top; border-radius: 8px; background: #F7F1E6; }
    .box p { margin: 6px 0 0; font-size: 12px; font-weight: 700; }
    .arrow { font-size: 22px; color: #BF5700; padding: 0 2px; }
    .url { margin: 0 0 10px; font-size: 12px; color: #5F5348; word-break: break-all; }
    img.shot { width: 100%; max-height: 150mm; object-fit: contain; object-position: top; border: 1px solid #E4D7C3; background: #F7F1E6; }
  </style>
</head>
<body>
  <section class="cover">
    <p class="kicker">Website flow</p>
    <h1>${escapeHtml(input.siteName)}</h1>
    <p>${escapeHtml(input.website)}</p>
    <p>${input.slides.length} screens, in the order the scan opened them.</p>
    <div class="flow">${boxes}</div>
  </section>
  ${slides}
</body>
</html>`;
}

export async function buildFlowPdf(input: { siteName: string; website: string; slides: FlowSlide[] }): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(buildFlowHtml(input), { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export function reportFileName(website: string, format: string, kind = "qa-report"): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${kind}-${sanitizeFilePart(website)}-${stamp}.${format}`;
}

export { buildScanPpt } from "./pptx.js";
export type { ScanPptInput, PptBug, PptPage, PptScore, PptShot, PptTemplate } from "./pptx.js";
export { PPT_TEMPLATES } from "./pptx.js";

export { path };
