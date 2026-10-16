import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildBugDetailsHtml, buildFlowHtml, buildHtmlReport, inventorySummary, writeCsvReport, type ReportPayload } from "./index.js";

const sample: ReportPayload = {
  scanId: "scan-1",
  website: "https://example.com",
  scannedAt: "2026-08-27T00:00:00.000Z",
  health: {
    overall: 84,
    performance: 88,
    accessibility: 74,
    seo: 91,
    security: 93,
    functional: 79,
    visual: 82,
    technical: 90,
  },
  pagesScanned: 4,
  pagesFailed: 0,
  issueCounts: { CRITICAL: 0, HIGH: 1, MEDIUM: 0, LOW: 0 },
  bugs: [
    {
      bugNumber: "BUG-001",
      title: "<script>alert(1)</script>",
      severity: "HIGH",
      priority: "P1",
      category: "SEO",
      status: "CONFIRMED",
      url: "https://example.com",
      expected: "Title exists",
      actual: "Missing",
      steps: "Open page",
      evidence: "screenshot",
      occurrences: 1,
    },
  ],
  pages: [{ url: "https://example.com", status: 200, title: "Example", responseTimeMs: 120 }],
  brokenLinks: [],
  brokenImages: [],
  consoleErrors: [],
  networkErrors: [],
  seo: [],
  accessibility: [],
  performance: [],
  security: [],
  recommendations: ["Add a title"],
};

describe("report generation", () => {
  it("escapes HTML in bug titles", () => {
    const html = buildHtmlReport(sample);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("84/100");
  });

  it("summarizes coverage, pages, and links", () => {
    const html = buildHtmlReport({
      ...sample,
      inventory: {
        coverage: "LANDING",
        coverageLabel: "Landing page only",
        pagesDiscovered: 1,
        pagesScanned: 1,
        pagesFailed: 0,
        linksFound: 12,
        brokenLinks: 2,
        imagesFound: 8,
        brokenImages: 1,
        formsFound: 3,
        elementsFound: 40,
        apiFailures: 4,
      },
    });
    expect(html).toContain("Landing page only");
    expect(html).toContain("Links found: 12 (2 broken)");
    expect(html).toContain('class="report-layout"');
    expect(html).toContain("inventory-table");
    expect(html).toContain("5. Scan Inventory");
    expect(html).toContain("7. Issues");
    expect(inventorySummary(sample)).toContain("Pages scanned: 4");
  });

  it("embeds screenshot evidence on each bug", () => {
    const html = buildHtmlReport({
      ...sample,
      bugs: [{ ...sample.bugs[0]!, screenshotDataUrl: "data:image/png;base64,abc" }],
    });
    expect(html).toContain('alt="Screenshot evidence for BUG-001"');
    expect(html).toContain("data:image/png;base64,abc");
  });

  it("writes a CSV report", async () => {
    const file = path.join(os.tmpdir(), `qa-csv-test-${Date.now()}.csv`);
    await writeCsvReport(file, sample);
    const csv = await fs.readFile(file, "utf8");
    expect(csv).toContain("BUG-001");
    expect(csv).toContain("https://example.com");
  });

  it("builds a separate bug-details PDF document with location and steps", () => {
    const html = buildBugDetailsHtml({
      ...sample,
      bugs: [
        {
          ...sample.bugs[0]!,
          pageUrl: "https://example.com/register",
          element: "Create Account",
          steps: "1. Open registration page\n2. Enter valid details\n3. Click Create Account",
          screenshotDataUrl: "data:image/png;base64,abc",
        },
      ],
    });
    expect(html).toContain("Bug details report");
    expect(html).toContain("https://example.com/register");
    expect(html).toContain("How to reproduce");
    expect(html).toContain("How to check / verify");
    expect(html).toContain("Create Account");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("builds one PDF document with a flow diagram and a slide per screenshot", () => {
    const html = buildFlowHtml({
      siteName: "distropak",
      website: "https://distropak.example",
      slides: [
        { step: 1, name: "Login", url: "https://distropak.example/login", imageDataUrl: "data:image/png;base64,aaa" },
        { step: 2, name: "Dashboard", url: "https://distropak.example/dashboard", imageDataUrl: "data:image/png;base64,bbb" },
      ],
    });
    expect(html).toContain("Website flow");
    expect(html).toContain("1. Login");
    expect(html).toContain("2. Dashboard");
    expect(html).toContain("Slide 2 of 2");
    expect(html).toContain("→");
  });
});
