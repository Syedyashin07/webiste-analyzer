import { SCAN_COVERAGES, type ScanCoverage } from "./constants.js";

export interface ScanInventory {
  coverage: ScanCoverage;
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
}

export function coverageLimits(
  coverage: ScanCoverage | undefined,
  requested: { maxPages?: number; maxDepth?: number },
  defaults: { maxPages: number; maxDepth: number },
): { maxPages: number; maxDepth: number } {
  if (coverage === "LANDING") {
    return { maxPages: 1, maxDepth: 0 };
  }
  if (coverage === "SCREENSHOTS" || coverage === "INSIDE" || coverage === "WORKFLOW") {
    return { maxPages: defaults.maxPages, maxDepth: defaults.maxDepth };
  }
  return {
    maxPages: requested.maxPages ?? defaults.maxPages,
    maxDepth: requested.maxDepth ?? defaults.maxDepth,
  };
}

export function coverageFromLimits(maxPages: number, maxDepth: number): ScanCoverage {
  return maxPages <= 1 && maxDepth <= 0 ? "LANDING" : "FULL";
}

export function resolveScanCoverage(config?: {
  coverage?: string | null;
  maxPages?: number | null;
  maxDepth?: number | null;
} | null): ScanCoverage {
  if (config?.coverage && isScanCoverage(config.coverage)) return config.coverage;
  return coverageFromLimits(config?.maxPages ?? 100, config?.maxDepth ?? 5);
}

export function coverageLabel(coverage: ScanCoverage): string {
  if (coverage === "LANDING") return "Landing page only";
  if (coverage === "SCREENSHOTS") return "Screenshot every page";
  if (coverage === "INSIDE") return "Inside every page";
  if (coverage === "WORKFLOW") return "Autonomous workflow";
  return "Full website (end to end)";
}

export function isScanCoverage(value: string): value is ScanCoverage {
  return (SCAN_COVERAGES as readonly string[]).includes(value);
}
