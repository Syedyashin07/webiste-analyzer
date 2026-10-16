import type { Page } from "playwright";
import { collectGeometry, type VisualGeometryFinding, viewportFor } from "@qa-scanner/browser";
import { VIEWPORTS, type ScanCoverage, type ViewportName, type Severity } from "@qa-scanner/shared";

export interface VisualIssue {
  type: VisualGeometryFinding["type"];
  selector: string;
  message: string;
  box: VisualGeometryFinding["box"];
  viewport: ViewportName;
  severity: Severity;
  needsAi: boolean;
}

const SEVERITY_MAP: Record<VisualGeometryFinding["type"], Severity> = {
  horizontal_overflow: "HIGH",
  element_overflow: "MEDIUM",
  outside_viewport: "MEDIUM",
  overlapping: "HIGH",
  large_blank: "LOW",
  hidden_button: "HIGH",
  broken_image: "HIGH",
};

export function mapGeometry(findings: VisualGeometryFinding[], viewport: ViewportName): VisualIssue[] {
  return findings.map((finding) => ({
    ...finding,
    viewport,
    severity: SEVERITY_MAP[finding.type],
    needsAi: finding.type === "overlapping" || finding.type === "large_blank",
  }));
}

export async function analyzeViewport(page: Page, viewport: ViewportName): Promise<VisualIssue[]> {
  await page.setViewportSize(viewportFor(viewport));
  await page.waitForTimeout(200);
  const findings = await collectGeometry(page);
  return mapGeometry(findings, viewport);
}

export function viewportsForMode(mode: "DESKTOP" | "TABLET" | "MOBILE" | "ALL"): ViewportName[] {
  if (mode === "ALL") return ["DESKTOP", "WIDE", "LAPTOP", "TABLET", "MOBILE"];
  if (mode === "TABLET") return ["TABLET"];
  if (mode === "MOBILE") return ["MOBILE", "COMPACT"];
  return ["DESKTOP"];
}

export function screenshotViewportsFor(
  coverage: ScanCoverage | string | undefined,
  mode: "DESKTOP" | "TABLET" | "MOBILE" | "ALL",
): ViewportName[] {
  if (coverage === "SCREENSHOTS") return ["DESKTOP"];
  if (mode === "ALL") return ["DESKTOP", "TABLET", "MOBILE"];
  return viewportsForMode(mode);
}

export { VIEWPORTS };
