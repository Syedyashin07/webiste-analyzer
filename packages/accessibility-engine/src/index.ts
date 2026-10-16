import * as cheerio from "cheerio";
import type { Page } from "playwright";
import axe from "axe-core";
import type { ParsedPage } from "@qa-scanner/parser";
import type { Severity } from "@qa-scanner/shared";

export interface A11yIssue {
  rule: string;
  severity: Severity;
  message: string;
  selector?: string;
}

export function analyzeAccessibilityHtml(parsed: ParsedPage, html: string): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const $ = cheerio.load(html);

  parsed.images.forEach((image, index) => {
    if (image.alt === null) {
      issues.push({
        rule: "img-alt",
        severity: "HIGH",
        message: `Image is missing an alt attribute: ${image.src || "(empty src)"}`,
        selector: `img[src="${image.src}"]`,
      });
    }
    if (index === -1) return;
  });

  $("input, select, textarea").each((_, el) => {
    const $el = $(el);
    const type = ($el.attr("type") || "").toLowerCase();
    if (["hidden", "submit", "button", "image"].includes(type)) return;
    const id = $el.attr("id");
    const aria = $el.attr("aria-label") || $el.attr("aria-labelledby");
    const hasLabel = Boolean(aria) || Boolean(id && $(`label[for="${id}"]`).length);
    if (!hasLabel) {
      issues.push({
        rule: "form-label",
        severity: "HIGH",
        message: `Form control "${$el.attr("name") || type || el.tagName}" has no associated label`,
        selector: $el.attr("name") ? `[name="${$el.attr("name")}"]` : undefined,
      });
    }
  });

  $("button").each((_, el) => {
    const $el = $(el);
    const name = ($el.text() || $el.attr("aria-label") || $el.attr("title") || "").trim();
    if (!name) {
      issues.push({
        rule: "button-name",
        severity: "HIGH",
        message: "Button has no accessible name",
        selector: "button",
      });
    }
  });

  $("a[href]").each((_, el) => {
    const $el = $(el);
    const name = ($el.text() || $el.attr("aria-label") || $el.attr("title") || "").trim();
    if (!name) {
      issues.push({
        rule: "link-name",
        severity: "MEDIUM",
        message: `Link has no accessible name (${$el.attr("href")})`,
        selector: `a[href="${$el.attr("href")}"]`,
      });
    }
  });

  const ids = new Map<string, number>();
  $("[id]").each((_, el) => {
    const id = $(el).attr("id");
    if (!id) return;
    ids.set(id, (ids.get(id) ?? 0) + 1);
  });
  for (const [id, count] of ids.entries()) {
    if (count > 1) {
      issues.push({
        rule: "duplicate-id",
        severity: "MEDIUM",
        message: `Duplicate id "${id}" found ${count} times`,
        selector: `#${id}`,
      });
    }
  }

  $("[tabindex]").each((_, el) => {
    const value = Number($(el).attr("tabindex"));
    if (Number.isFinite(value) && value > 0) {
      issues.push({
        rule: "positive-tabindex",
        severity: "LOW",
        message: `Positive tabindex="${value}" disrupts natural keyboard order`,
      });
    }
  });

  const headingLevels = parsed.headings.map((heading) => heading.level);
  if (headingLevels.length > 0) {
    let previous = headingLevels[0] ?? 1;
    for (const level of headingLevels.slice(1)) {
      if (level > previous + 1) {
        issues.push({
          rule: "heading-hierarchy",
          severity: "LOW",
          message: `Heading level skipped from h${previous} to h${level}`,
        });
        break;
      }
      previous = level;
    }
  }

  return issues;
}

export async function analyzeAccessibilityRuntime(page: Page): Promise<A11yIssue[]> {
  const issues: A11yIssue[] = [];
  const contrast = await page.evaluate(() => {
    const hex = (color: string): [number, number, number] | null => {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return null;
      return [Number(match[1]), Number(match[2]), Number(match[3])];
    };
    const luminance = ([r, g, b]: [number, number, number]) => {
      const toLin = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
    };
    const ratio = (a: [number, number, number], b: [number, number, number]) => {
      const l1 = luminance(a);
      const l2 = luminance(b);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    };
    const nodes = Array.from(document.querySelectorAll("p, h1, h2, h3, button, a, label, span")).slice(0, 80);
    const failures: Array<{ selector: string; ratio: number }> = [];
    for (const node of nodes) {
      const style = window.getComputedStyle(node);
      const fg = hex(style.color);
      const bg = hex(style.backgroundColor);
      if (!fg || !bg) continue;
      if (style.backgroundColor === "rgba(0, 0, 0, 0)" || style.backgroundColor === "transparent") continue;
      const value = ratio(fg, bg);
      if (value < 3) {
        failures.push({ selector: node.tagName.toLowerCase(), ratio: Number(value.toFixed(2)) });
      }
    }
    return failures.slice(0, 10);
  });

  for (const item of contrast) {
    issues.push({
      rule: "contrast",
      severity: "MEDIUM",
      message: `Low color contrast ratio ${item.ratio}:1 on ${item.selector}`,
      selector: item.selector,
    });
  }

  const focus = await page.evaluate(() => {
    const button = document.querySelector("button, a[href], input, select, textarea");
    if (!button || !(button instanceof HTMLElement)) return true;
    button.focus();
    return document.activeElement === button;
  });
  if (!focus) {
    issues.push({
      rule: "keyboard-focus",
      severity: "HIGH",
      message: "Interactive element could not receive keyboard focus",
    });
  }

  return issues;
}

function axeImpactToSeverity(impact?: string | null): Severity {
  if (impact === "critical") return "CRITICAL";
  if (impact === "serious") return "HIGH";
  if (impact === "minor") return "LOW";
  return "MEDIUM";
}

export async function analyzeAccessibilityAxe(page: Page): Promise<A11yIssue[]> {
  const source = (axe as unknown as { source?: string }).source;
  if (!source) return [];
  await page.addScriptTag({ content: source });
  const violations = await page.evaluate(async () => {
    const runner = (
      window as unknown as {
        axe: {
          run: (
            context: Document,
            options: Record<string, unknown>,
          ) => Promise<{
            violations: Array<{ id: string; impact?: string; help: string; nodes: Array<{ target: string[] }> }>;
          }>;
        };
      }
    ).axe;
    const results = await runner.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      resultTypes: ["violations"],
    });
    return results.violations.slice(0, 40).map((item) => ({
      id: item.id,
      impact: item.impact ?? "moderate",
      help: item.help,
      selector: item.nodes[0]?.target?.[0],
    }));
  });

  return violations.map((item) => ({
    rule: `axe-${item.id}`,
    severity: axeImpactToSeverity(item.impact),
    message: item.help,
    selector: item.selector,
  }));
}
