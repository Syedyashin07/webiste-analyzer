import {
  calculateHealthScore,
  type BugCategory,
  type HealthScoreResult,
  type Severity,
} from "@qa-scanner/shared";

export interface ScoreableIssue {
  category: BugCategory;
  severity: Severity;
}

export interface HealthExplanation {
  score: number;
  criteria: string;
  issueCount: number;
  recommendations: string[];
}

const CRITERIA: Record<string, string> = {
  overall: "Weighted average of category scores. Critical findings deduct more than low findings.",
  performance: "Navigation timing, transfer size, request count, and Core Web Vitals-style metrics when available.",
  accessibility: "Labels, names, heading structure, duplicate IDs, and measurable contrast issues.",
  seo: "Title, meta description, canonical, headings, language, robots, and indexability checks.",
  security: "Passive HTTPS/SSL certificate checks on every page, mixed content, security headers, and insecure form checks. No exploitation.",
  functional: "Safe interaction failures, form validation gaps, and broken controls.",
  visual: "Overflow, clipping, overlap, broken images, and viewport-specific layout defects.",
  technical: "HTTP failures, JavaScript exceptions, broken links/images, and network errors.",
};

export function computeScanHealth(
  issues: ScoreableIssue[],
  skipped: Partial<Record<string, boolean>> = {},
): HealthScoreResult {
  return calculateHealthScore(
    issues.map((issue) => ({ category: issue.category, severity: issue.severity })),
    { skipped },
  );
}

export function explainScore(
  result: HealthScoreResult,
  category: keyof HealthScoreResult | "overall",
  recommendations: string[],
): HealthExplanation {
  if (category === "overall" || category === "categories") {
    return {
      score: result.overall,
      criteria: CRITERIA.overall,
      issueCount: Object.values(result.categories).reduce((sum, item) => sum + item.issueCount, 0),
      recommendations,
    };
  }
  const key = String(category);
  return {
    score: result[key as keyof HealthScoreResult] as number,
    criteria: CRITERIA[key] ?? CRITERIA.technical,
    issueCount: result.categories[key]?.issueCount ?? 0,
    recommendations,
  };
}

export { CRITERIA };
