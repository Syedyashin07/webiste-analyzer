export interface ScanInventory {
  coverage: "LANDING" | "FULL" | "SCREENSHOTS" | "INSIDE" | "WORKFLOW";
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

export interface SiteSummary {
  id: string;
  name: string;
  url: string | null;
  updatedAt?: string;
  scanCount: number;
  bugCount: number;
  reportCount: number;
}

export interface ScanFormPayload {
  name?: string;
  url: string;
  coverage: "LANDING" | "FULL" | "SCREENSHOTS" | "INSIDE" | "WORKFLOW";
  maxPages?: number;
  maxDepth?: number;
  viewport: "DESKTOP" | "TABLET" | "MOBILE" | "ALL";
  captureScreenshots: boolean;
  recordVideos: boolean;
  aiAnalysis: boolean;
  runFunctionalTests: boolean;
  runAccessibility: boolean;
  runPerformance: boolean;
  runSeo: boolean;
  runSecurity: boolean;
  loginUsername?: string;
  loginPassword?: string;
  loginUrl?: string;
  testMode?: "SAFE" | "STANDARD" | "AGGRESSIVE" | "DEEP";
  browserEngine?: "chromium" | "firefox" | "webkit";
  authorizedTest?: boolean;
  dataSeed?: number;
}

export interface ScanSummary {
  id: string;
  url: string;
  host: string;
  status: string;
  progress: number;
  pagesDiscovered: number;
  pagesScanned: number;
  pagesFailed: number;
  issuesFound: number;
  confirmedBugs: number;
  overallScore: number | null;
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  securityScore: number | null;
  functionalScore: number | null;
  visualScore: number | null;
  technicalScore: number | null;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  paused?: boolean;
  currentUrl?: string | null;
  currentAction?: string | null;
  coverage?: "LANDING" | "FULL" | "SCREENSHOTS" | "INSIDE" | "WORKFLOW";
  coverageLabel?: string;
  elementsDiscovered?: number;
  formsTested?: number;
  linksTested?: number;
  imagesFound?: number;
  brokenLinks?: number;
  brokenImages?: number;
  inventory?: ScanInventory;
  apiFailures?: number;
  failedApis?: FailedApi[];
  consoleErrors?: number;
  accessibilityIssues?: number;
  visualIssues?: number;
  configuration?: {
    testMode?: string;
    browserEngine?: string;
    maxPages?: number;
    maxDepth?: number;
  };
  reports?: Array<{ id: string; format: string; fileName: string }>;
  project?: { id: string; name: string };
}

export interface BugSummary {
  id: string;
  bugNumber: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  priority: string;
  status: string;
  url: string;
  expected: string | null;
  actual: string | null;
  stepsToReproduce: string | null;
  rootCause: string | null;
  occurrences: number;
  affectedUrls: string[];
  browser: string | null;
  viewport: string | null;
  aiAnalysis: string | null;
  recommendedAction: string | null;
  verified: boolean;
  detectedAt: string;
  evidence?: EvidenceItem[];
  scanId?: string;
  scan?: { id: string; url: string; host?: string; project?: { id: string; name: string } };
}

export interface EvidenceItem {
  id: string;
  type: string;
  path: string | null;
  screenshot?: { id: string; kind: string } | null;
  video?: { id: string } | null;
  trace?: { id: string } | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const needsJsonBody = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const body = init?.body ?? (needsJsonBody ? "{}" : undefined);
  const token = window.localStorage.getItem("qa-auth-token");
  const response = await fetch(path, {
    ...init,
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    body,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: response.statusText }))) as { error?: string };
    throw new Error(payload.error || response.statusText);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export const api = {
  health: () => request<{ ok: boolean }>("/api/health"),
  register: (body: { name: string; email: string; password: string }) =>
    request<{ token: string; user: AuthUser }>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: AuthUser }>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  dashboard: () =>
    request<{
      totalScans: number;
      latest: ScanSummary | null;
      counts: Record<string, number>;
      stats?: {
        elements: number;
        forms: number;
        links: number;
        apiFailures: number;
        consoleErrors: number;
        accessibilityIssues: number;
        visualIssues: number;
      };
    }>("/api/dashboard"),
  sites: () => request<{ sites: SiteSummary[] }>("/api/sites"),
  site: (id: string) => request<{ site: SiteSummary }>(`/api/sites/${id}`),
  scans: (projectId?: string) =>
    request<{ scans: ScanSummary[] }>(`/api/scans${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`),
  scan: (id: string) => request<{ scan: ScanSummary & { reports: Array<{ id: string; format: string; fileName: string }> } }>(`/api/scans/${id}`),
  progress: (id: string) =>
    request<{
      status: string;
      progress: number;
      pagesDiscovered: number;
      pagesScanned: number;
      pagesFailed: number;
      issuesFound: number;
      confirmedBugs: number;
      events: Array<{ id: string; type: string; message: string; createdAt: string }>;
    }>(`/api/scans/${id}/progress`),
  pages: (id: string) => request<{ pages: PageRow[] }>(`/api/scans/${id}/pages`),
  page: (scanId: string, pageId: string) => request<{ page: PageDetail }>(`/api/scans/${scanId}/pages/${pageId}`),
  scanBugs: (id: string) => request<{ bugs: BugSummary[] }>(`/api/scans/${id}/bugs`),
  createScan: (body: ScanFormPayload) =>
    request<{ scanId: string; status: string; siteId: string; siteName: string }>("/api/scans", { method: "POST", body: JSON.stringify(body) }),
  cancelScan: (id: string) => request(`/api/scans/${id}/cancel`, { method: "POST" }),
  pauseScan: (id: string) => request(`/api/scans/${id}/pause`, { method: "POST" }),
  resumeScan: (id: string) => request(`/api/scans/${id}/resume`, { method: "POST" }),
  restartScan: (id: string) => request<{ scanId: string; status: string }>(`/api/scans/${id}/restart`, { method: "POST" }),
  replayScanApis: (id: string, ids?: string[]) =>
    request<ReplayApisResult>(`/api/scans/${id}/replay-apis`, { method: "POST", body: JSON.stringify(ids?.length ? { ids } : {}) }),
  replayBugApi: (id: string) => request<ReplayApisResult>(`/api/bugs/${id}/replay-api`, { method: "POST", body: JSON.stringify({}) }),
  deleteScan: (id: string) => request(`/api/scans/${id}`, { method: "DELETE" }),
  workflow: (id: string) =>
    request<{
      steps: Array<{ id: string; pageUrl: string; actionType: string; status: string; reason: string | null; observed: string | null; redactedInput: string | null }>;
      registry: Array<{ entityKey: string; fieldKey: string; value: string; sensitive: boolean; source: string }>;
      graph: { nodes: Array<{ id: string; kind: "page" | "form" | "field" | "button"; label: string; url?: string; status?: "discovered" | "visited" | "completed" | "failed" | "blocked" }>; edges: Array<{ id: string; from: string; to: string; kind: "navigation" | "contains" | "workflow" | "suggested"; observed: boolean; label?: string }> };
      counts: { completed: number; blocked: number; failed: number; skipped: number };
    }>(`/api/scans/${id}/workflow`),
  bugs: (params: URLSearchParams) => request<{ bugs: BugSummary[] }>(`/api/bugs?${params.toString()}`),
  bug: (id: string) => request<{ bug: BugSummary }>(`/api/bugs/${id}`),
  updateBug: (id: string, body: Record<string, unknown>) =>
    request<{ bug: BugSummary }>(`/api/bugs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  reports: (projectId?: string) =>
    request<{
      reports: Array<{
        id: string;
        format: string;
        fileName: string;
        createdAt: string;
        scan: { url: string; overallScore: number | null; project?: { id: string; name: string } };
      }>;
    }>(`/api/reports${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`),
  settings: () => request<{ settings: Settings }>(`/api/settings`),
  saveSettings: (body: Settings) => request(`/api/settings`, { method: "PUT", body: JSON.stringify(body) }),
  resetAllData: () => request<{ ok: boolean; scansDeleted: number }>("/api/settings/reset-data", { method: "POST" }),
  compare: (scanAId: string, scanBId: string) =>
    request<CompareResult>(`/api/compare?scanAId=${encodeURIComponent(scanAId)}&scanBId=${encodeURIComponent(scanBId)}`),
};

export interface TlsInfo {
  schemeHttps?: boolean;
  connected?: boolean;
  authorized?: boolean;
  authorizationError?: string | null;
  protocol?: string | null;
  cipher?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  daysUntilExpiry?: number | null;
  subjectCn?: string | null;
  issuer?: string | null;
  fingerprint256?: string | null;
  httpRedirectsToHttps?: boolean | null;
  host?: string;
}

export interface PageRow {
  id: string;
  url: string;
  status: string;
  httpStatus: number | null;
  title: string | null;
  responseTimeMs: number | null;
  httpsOk?: boolean | null;
  tlsJson?: TlsInfo | null;
  depth?: number;
  parentUrl?: string | null;
  _count?: { links?: number; forms?: number; elements?: number };
  screenshots?: Array<{ id: string; kind: string; viewport?: string | null }>;
}

export interface PageDetail extends PageRow {
  metaDescription: string | null;
  canonical: string | null;
  language: string | null;
  links: Array<{ href: string; text: string | null; isBroken: boolean; statusCode: number | null }>;
  images: Array<{ src: string; alt: string | null; isBroken: boolean }>;
  forms: Array<{ action: string | null; method: string | null; fieldCount: number }>;
  elements?: Array<{ type: string; text: string | null; risk: string | null; visible: boolean }>;
  consoleErrors: Array<{ message: string; type: string }>;
  networkErrors: Array<{
    id?: string;
    method?: string;
    requestUrl: string;
    statusCode: number | null;
    error?: string | null;
    resourceType?: string | null;
  }>;
  performance: { loadEventMs: number | null; score: number | null } | null;
  accessibility: Array<{ message: string }>;
  seoIssues: Array<{ message: string }>;
  securityIssues: Array<{ rule: string; message: string; severity: string }>;
  screenshots: Array<{ id: string; kind: string; viewport?: string | null }>;
}

export interface FailedApi {
  id: string;
  api: string;
  method: string;
  requestUrl: string;
  statusCode: number | null;
  error: string | null;
  resourceType: string | null;
  pageId: string | null;
  pageUrl: string | null;
  occurrences: number;
  pages: string[];
}

export interface ReplayApiResult {
  id: string;
  api: string;
  method: string;
  requestUrl: string;
  pageUrl: string | null;
  originalStatus: number | null;
  originalError: string | null;
  replayOk: boolean;
  replayStatus: number | null;
  replayError: string | null;
  durationMs: number;
}

export interface ReplayApisResult {
  replayed: number;
  stillFailing: number;
  recovered: number;
  results: ReplayApiResult[];
}

export interface Settings {
  defaultMaxPages: number;
  defaultMaxDepth: number;
  timeoutMs: number;
  browser: "chromium" | "firefox" | "webkit";
  viewport: "DESKTOP" | "TABLET" | "MOBILE" | "ALL";
  screenshotEnabled: boolean;
  videoEnabled: boolean;
  aiEnabled: boolean;
  retentionDays: number;
  concurrency: number;
  crawlDelayMs: number;
  maxScanDurationMs: number;
  maxScreenshotBytes: number;
  respectRobotsTxt: boolean;
}

export interface CompareResult {
  scanA: { id: string; url: string; overallScore: number | null; pagesScanned: number };
  scanB: { id: string; url: string; overallScore: number | null; pagesScanned: number };
  healthDelta: number;
  performanceDelta: number;
  pageCountDelta: number;
  newBugs: BugSummary[];
  fixedBugs: BugSummary[];
  unchangedBugs: BugSummary[];
  regressions: BugSummary[];
}
