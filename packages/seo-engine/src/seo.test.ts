import { describe, expect, it } from "vitest";
import { analyzeSeo } from "./index.js";
import { parseHtml } from "@qa-scanner/parser";

describe("seo engine", () => {
  it("flags missing title and h1", () => {
    const parsed = parseHtml("<html><head></head><body><p>Hi</p></body></html>", "https://example.com/");
    const issues = analyzeSeo(parsed, "https://example.com/", { robotsTxtFound: false, sitemapFound: false });
    expect(issues.some((issue) => issue.rule === "title-missing")).toBe(true);
    expect(issues.some((issue) => issue.rule === "h1-missing")).toBe(true);
  });
});
