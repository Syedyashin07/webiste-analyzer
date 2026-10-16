import { CATEGORY_WEIGHTS, SEVERITY_WEIGHTS, type Severity } from "./constants.js";

export interface ScoreIssue {
  category: keyof typeof CATEGORY_WEIGHTS | "broken_link" | "broken_image" | "javascript" | "network";
  severity: Severity;
}

const ISSUE_CATEGORY_MAP: Record<string, keyof typeof CATEGORY_WEIGHTS> = {
  performance: "performance",
  accessibility: "accessibility",
  seo: "seo",
  security: "security",
  functional: "functional",
  visual: "visual",
  technical: "technical",
  broken_link: "technical",
  broken_image: "technical",
  javascript: "technical",
  network: "technical",
  BROKEN_LINK: "technical",
  BROKEN_IMAGE: "technical",
  JAVASCRIPT: "technical",
  NETWORK: "technical",
  FUNCTIONAL: "functional",
  VISUAL: "visual",
  ACCESSIBILITY: "accessibility",
  SEO: "seo",
  PERFORMANCE: "performance",
  SECURITY: "security",
  TECHNICAL: "technical",
};

export interface CategoryScore {
  score: number;
  deductions: number;
  issueCount: number;
}

export interface HealthScoreResult {
  overall: number;
  performance: number;
  accessibility: number;
  seo: number;
  security: number;
  functional: number;
  visual: number;
  technical: number;
  categories: Record<string, CategoryScore>;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreCategory(issues: Array<{ severity: Severity }>): CategoryScore {
  const deductions = issues.reduce((sum, issue) => sum + SEVERITY_WEIGHTS[issue.severity], 0);
  return {
    score: clamp(100 - deductions),
    deductions,
    issueCount: issues.length,
  };
}

export function calculateHealthScore(
  issues: ScoreIssue[],
  options: { skipped?: Partial<Record<keyof typeof CATEGORY_WEIGHTS, boolean>> } = {},
): HealthScoreResult {
  const grouped: Record<string, Array<{ severity: Severity }>> = {
    performance: [],
    accessibility: [],
    seo: [],
    security: [],
    functional: [],
    visual: [],
    technical: [],
  };

  for (const issue of issues) {
    const mapped = ISSUE_CATEGORY_MAP[issue.category] ?? "technical";
    grouped[mapped].push({ severity: issue.severity });
  }

  const categories: Record<string, CategoryScore> = {};
  for (const [key, list] of Object.entries(grouped)) {
    categories[key] = scoreCategory(list);
  }

  let weightTotal = 0;
  let weighted = 0;
  for (const [key, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    if (options.skipped?.[key as keyof typeof CATEGORY_WEIGHTS]) continue;
    weightTotal += weight;
    weighted += categories[key].score * weight;
  }

  const overall = weightTotal === 0 ? 100 : clamp(weighted / weightTotal);

  return {
    overall,
    performance: categories.performance.score,
    accessibility: categories.accessibility.score,
    seo: categories.seo.score,
    security: categories.security.score,
    functional: categories.functional.score,
    visual: categories.visual.score,
    technical: categories.technical.score,
    categories,
  };
}

export function severityFromHttpStatus(status: number | null): Severity {
  if (status === null) return "HIGH";
  if (status >= 500) return "CRITICAL";
  if (status === 404 || status === 410) return "HIGH";
  if (status >= 400) return "MEDIUM";
  return "LOW";
}
