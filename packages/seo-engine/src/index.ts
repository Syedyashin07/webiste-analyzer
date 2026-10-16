import type { ParsedPage } from "@qa-scanner/parser";
import type { Severity } from "@qa-scanner/shared";

export interface SeoIssue {
  rule: string;
  severity: Severity;
  message: string;
}

export interface SiteSeoContext {
  robotsTxtFound: boolean;
  sitemapFound: boolean;
}

export function analyzeSeo(parsed: ParsedPage, pageUrl: string, site: SiteSeoContext): SeoIssue[] {
  const issues: SeoIssue[] = [];
  if (!parsed.title) {
    issues.push({ rule: "title-missing", severity: "HIGH", message: "Document title is missing" });
  } else {
    if (parsed.title.length < 10) {
      issues.push({ rule: "title-short", severity: "LOW", message: `Title is short (${parsed.title.length} chars)` });
    }
    if (parsed.title.length > 60) {
      issues.push({ rule: "title-long", severity: "LOW", message: `Title is long (${parsed.title.length} chars)` });
    }
  }

  if (!parsed.metaDescription) {
    issues.push({ rule: "meta-description-missing", severity: "MEDIUM", message: "Meta description is missing" });
  } else if (parsed.metaDescription.length < 50 || parsed.metaDescription.length > 160) {
    issues.push({
      rule: "meta-description-length",
      severity: "LOW",
      message: `Meta description length is ${parsed.metaDescription.length} (recommended 50-160)`,
    });
  }

  if (!parsed.canonical) {
    issues.push({ rule: "canonical-missing", severity: "LOW", message: "Canonical URL is missing" });
  }

  if (!parsed.language) {
    issues.push({ rule: "lang-missing", severity: "MEDIUM", message: "html lang attribute is missing" });
  }

  const h1s = parsed.headings.filter((heading) => heading.level === 1);
  if (h1s.length === 0) {
    issues.push({ rule: "h1-missing", severity: "MEDIUM", message: "Page has no H1" });
  } else if (h1s.length > 1) {
    issues.push({ rule: "h1-multiple", severity: "LOW", message: `Page has ${h1s.length} H1 elements` });
  }

  parsed.images.forEach((image) => {
    if (!image.alt) {
      issues.push({
        rule: "img-alt-seo",
        severity: "LOW",
        message: `Image missing alt text: ${image.src}`,
      });
    }
  });

  if (parsed.robotsMeta?.toLowerCase().includes("noindex")) {
    issues.push({
      rule: "noindex",
      severity: "MEDIUM",
      message: `robots meta contains noindex (${parsed.robotsMeta})`,
    });
  }

  if (!site.robotsTxtFound) {
    issues.push({
      rule: "robots-txt-missing",
      severity: "LOW",
      message: `robots.txt was not found at origin of ${pageUrl}`,
    });
  }
  if (!site.sitemapFound) {
    issues.push({
      rule: "sitemap-missing",
      severity: "LOW",
      message: "sitemap.xml was not found at /sitemap.xml",
    });
  }

  return issues;
}
