export const SCAN_STATUSES = [
  "QUEUED",
  "INITIALIZING",
  "CRAWLING",
  "SCANNING",
  "ANALYZING",
  "VERIFYING",
  "GENERATING_REPORT",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "PAUSED",
] as const;

export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const PAGE_STATUSES = [
  "DISCOVERED",
  "QUEUED",
  "SCANNING",
  "SCANNED",
  "FAILED",
  "SKIPPED",
] as const;

export type PageStatus = (typeof PAGE_STATUSES)[number];

export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const BUG_STATUSES = [
  "OPEN",
  "CONFIRMED",
  "FALSE_POSITIVE",
  "RESOLVED",
  "IGNORED",
  "UNVERIFIED",
] as const;
export type BugStatus = (typeof BUG_STATUSES)[number];

export const BUG_CATEGORIES = [
  "FUNCTIONAL",
  "VISUAL",
  "ACCESSIBILITY",
  "SEO",
  "PERFORMANCE",
  "SECURITY",
  "TECHNICAL",
  "BROKEN_LINK",
  "BROKEN_IMAGE",
  "JAVASCRIPT",
  "NETWORK",
] as const;
export type BugCategory = (typeof BUG_CATEGORIES)[number];

export const VIEWPORT_MODES = ["DESKTOP", "TABLET", "MOBILE", "ALL"] as const;
export type ViewportMode = (typeof VIEWPORT_MODES)[number];

export const VIEWPORTS = {
  DESKTOP: { width: 1920, height: 1080, label: "Desktop 1920x1080" },
  LAPTOP: { width: 1366, height: 768, label: "Laptop 1366x768" },
  WIDE: { width: 1440, height: 900, label: "Desktop 1440x900" },
  TABLET: { width: 768, height: 1024, label: "Tablet" },
  MOBILE: { width: 390, height: 844, label: "Mobile 390x844" },
  COMPACT: { width: 375, height: 812, label: "Mobile 375x812" },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

export const SCAN_EVENT_TYPES = [
  "scan.started",
  "scan.progress",
  "page.discovered",
  "page.started",
  "page.completed",
  "page.failed",
  "issue.detected",
  "verification.started",
  "verification.completed",
  "report.generated",
  "scan.completed",
  "scan.failed",
  "scan.cancelled",
  "scan.paused",
  "scan.resumed",
  "scan.action",
] as const;

export type ScanEventType = (typeof SCAN_EVENT_TYPES)[number];

export const CRAWLER_USER_AGENT = "WebsiteQAHealthScanner/1.0";

export const BROKEN_STATUS_CODES = new Set([404, 410, 500, 502, 503, 504]);

export const SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "password", regex: /password/i },
  { name: "token", regex: /token/i },
  { name: "apiKey", regex: /api[_-]?key/i },
  { name: "authorization", regex: /authorization/i },
  { name: "cookie", regex: /cookie/i },
  { name: "secret", regex: /secret/i },
];

export const DESTRUCTIVE_ACTION_PATTERNS: RegExp[] = [
  /\bdelete\b/i,
  /\bremove\b/i,
  /\bdestroy\b/i,
  /\bpay\b/i,
  /\bpurchase\b/i,
  /\bbuy now\b/i,
  /\bcheckout\b/i,
  /\bplace order\b/i,
  /\border now\b/i,
  /\bunsubscribe\b/i,
  /\bchange password\b/i,
  /\breset password\b/i,
  /\btransfer\b/i,
  /\bwithdraw\b/i,
  /\bsubmit payment\b/i,
  /\bcancel subscription\b/i,
  /\bclose account\b/i,
  /\bdeactivate\b/i,
  /\bdrop account\b/i,
];

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  CRITICAL: 15,
  HIGH: 8,
  MEDIUM: 4,
  LOW: 1,
};

export const CATEGORY_WEIGHTS: Record<string, number> = {
  performance: 15,
  accessibility: 15,
  seo: 15,
  security: 15,
  functional: 15,
  visual: 15,
  technical: 10,
};

export const SEVERITY_TO_PRIORITY: Record<Severity, Priority> = {
  CRITICAL: "P0",
  HIGH: "P1",
  MEDIUM: "P2",
  LOW: "P3",
};

export const QUEUE_NAMES = {
  SCANS: "qa-scans",
} as const;

export const TEST_MODES = ["SAFE", "STANDARD", "AGGRESSIVE", "DEEP"] as const;
export type TestMode = (typeof TEST_MODES)[number];

export const SCAN_COVERAGES = ["LANDING", "FULL", "SCREENSHOTS", "INSIDE", "WORKFLOW"] as const;
export type ScanCoverage = (typeof SCAN_COVERAGES)[number];

export const BROWSER_ENGINES = ["chromium", "firefox", "webkit"] as const;
export type BrowserEngine = (typeof BROWSER_ENGINES)[number];

export const INTERACTION_RISKS = [
  "SAFE",
  "LOW_RISK",
  "STATE_CHANGING",
  "DESTRUCTIVE",
  "EXTERNAL",
  "UNKNOWN",
] as const;
export type InteractionRisk = (typeof INTERACTION_RISKS)[number];

export const REDIS_CHANNELS = {
  scanEvents: (scanId: string) => `scan:${scanId}:events`,
  scanCancel: (scanId: string) => `scan:${scanId}:cancel`,
  scanPause: (scanId: string) => `scan:${scanId}:pause`,
  scanResumePhase: (scanId: string) => `scan:${scanId}:resume-phase`,
  scanLive: (scanId: string) => `scan:${scanId}:live`,
} as const;
