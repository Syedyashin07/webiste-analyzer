import type { PerformanceDomMetrics } from "@qa-scanner/browser";
import type { Severity } from "@qa-scanner/shared";

export interface PerfIssue {
  rule: string;
  severity: Severity;
  message: string;
}

export function scorePerformance(metrics: PerformanceDomMetrics): number {
  let score = 100;
  if ((metrics.lcpMs ?? 0) > 4000) score -= 20;
  else if ((metrics.lcpMs ?? 0) > 2500) score -= 10;
  if ((metrics.fcpMs ?? 0) > 3000) score -= 10;
  if ((metrics.loadEventMs ?? 0) > 5000) score -= 15;
  else if ((metrics.loadEventMs ?? 0) > 3000) score -= 8;
  if ((metrics.cls ?? 0) > 0.25) score -= 15;
  else if ((metrics.cls ?? 0) > 0.1) score -= 8;
  if ((metrics.transferSize ?? 0) > 3_000_000) score -= 12;
  else if ((metrics.transferSize ?? 0) > 1_500_000) score -= 6;
  if ((metrics.requestCount ?? 0) > 120) score -= 8;
  if ((metrics.longTaskCount ?? 0) > 5) score -= 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function analyzePerformance(metrics: PerformanceDomMetrics): PerfIssue[] {
  const issues: PerfIssue[] = [];
  if ((metrics.lcpMs ?? 0) > 4000) {
    issues.push({
      rule: "lcp-slow",
      severity: "HIGH",
      message: `Largest Contentful Paint is ${Math.round(metrics.lcpMs ?? 0)}ms`,
    });
  }
  if ((metrics.loadEventMs ?? 0) > 5000) {
    issues.push({
      rule: "load-slow",
      severity: "MEDIUM",
      message: `Load event fired at ${metrics.loadEventMs}ms`,
    });
  }
  if ((metrics.cls ?? 0) > 0.25) {
    issues.push({
      rule: "cls-high",
      severity: "HIGH",
      message: `Cumulative Layout Shift is ${(metrics.cls ?? 0).toFixed(3)}`,
    });
  }
  if ((metrics.imageSize ?? 0) > 1_500_000) {
    issues.push({
      rule: "images-heavy",
      severity: "MEDIUM",
      message: `Image transfer size is ${Math.round((metrics.imageSize ?? 0) / 1024)} KB`,
    });
  }
  if ((metrics.jsSize ?? 0) > 800_000) {
    issues.push({
      rule: "js-heavy",
      severity: "MEDIUM",
      message: `JavaScript transfer size is ${Math.round((metrics.jsSize ?? 0) / 1024)} KB`,
    });
  }
  if ((metrics.requestCount ?? 0) > 120) {
    issues.push({
      rule: "too-many-requests",
      severity: "LOW",
      message: `Page issued ${metrics.requestCount} network requests`,
    });
  }
  return issues;
}
