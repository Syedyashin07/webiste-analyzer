import {
  BROWSER_ENGINES,
  BUG_CATEGORIES,
  BUG_STATUSES,
  PRIORITIES,
  SCAN_COVERAGES,
  SEVERITIES,
  TEST_MODES,
  VIEWPORT_MODES,
} from "./constants.js";
import { z } from "zod";

const emptyToUndef = (value: unknown) => (value === "" || value === null ? undefined : value);

export const createScanSchema = z.object({
  url: z
    .string()
    .url()
    .refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
      message: "Only http and https URLs are allowed",
    }),
  maxPages: z.number().int().min(1).max(500).optional(),
  maxDepth: z.number().int().min(0).max(20).optional(),
  viewport: z.enum(VIEWPORT_MODES).optional(),
  captureScreenshots: z.boolean().optional(),
  recordVideos: z.boolean().optional(),
  aiAnalysis: z.boolean().optional(),
  runFunctionalTests: z.boolean().optional(),
  runAccessibility: z.boolean().optional(),
  runPerformance: z.boolean().optional(),
  runSeo: z.boolean().optional(),
  runSecurity: z.boolean().optional(),
  loginUsername: z.preprocess(emptyToUndef, z.string().min(1).max(200).optional()),
  loginPassword: z.preprocess(emptyToUndef, z.string().min(1).max(400).optional()),
  testMode: z.enum(TEST_MODES).optional(),
  browserEngine: z.enum(BROWSER_ENGINES).optional(),
  coverage: z.enum(SCAN_COVERAGES).optional(),
  name: z.preprocess(emptyToUndef, z.string().trim().min(1).max(80).optional()),
  authorizedTest: z.boolean().optional(),
  dataSeed: z.number().int().min(0).max(1_000_000).optional(),
  loginUrl: z.preprocess(
    emptyToUndef,
    z
      .string()
      .max(500)
      .optional(),
  ),
}).superRefine((value, ctx) => {
  const hasUser = Boolean(value.loginUsername);
  const hasPass = Boolean(value.loginPassword);
  if (hasUser !== hasPass) {
    ctx.addIssue({
      code: "custom",
      message: "Login username and password are both required to scan inside the site",
      path: hasUser ? ["loginPassword"] : ["loginUsername"],
    });
  }
  if (value.loginUrl && !(value.loginUrl.startsWith("http://") || value.loginUrl.startsWith("https://") || value.loginUrl.startsWith("/"))) {
    ctx.addIssue({ code: "custom", message: "Login URL must be http(s) or a path like /login", path: ["loginUrl"] });
  }
  if (value.coverage === "WORKFLOW" && value.authorizedTest !== true) {
    ctx.addIssue({
      code: "custom",
      message: "Confirm this is an authorized test site before autonomous workflow testing",
      path: ["authorizedTest"],
    });
  }
});

export type CreateScanInput = z.infer<typeof createScanSchema>;

export const updateBugSchema = z.object({
  status: z.enum(BUG_STATUSES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
});

export type UpdateBugInput = z.infer<typeof updateBugSchema>;

export const bugFilterSchema = z.object({
  severity: z.preprocess(emptyToUndef, z.enum(SEVERITIES).optional()),
  priority: z.preprocess(emptyToUndef, z.enum(PRIORITIES).optional()),
  status: z.preprocess(emptyToUndef, z.enum(BUG_STATUSES).optional()),
  category: z.preprocess(emptyToUndef, z.enum(BUG_CATEGORIES).optional()),
  scanId: z.preprocess(emptyToUndef, z.string().optional()),
  page: z.preprocess(emptyToUndef, z.string().optional()),
  q: z.preprocess(emptyToUndef, z.string().optional()),
  projectId: z.preprocess(emptyToUndef, z.string().min(1).max(80).optional()),
  from: z.preprocess(emptyToUndef, z.string().datetime().optional()),
  to: z.preprocess(emptyToUndef, z.string().datetime().optional()),
});

export type BugFilterInput = z.infer<typeof bugFilterSchema>;

export const settingsSchema = z.object({
  defaultMaxPages: z.number().int().min(1).max(500),
  defaultMaxDepth: z.number().int().min(0).max(20),
  timeoutMs: z.number().int().min(1000).max(120000),
  browser: z.enum(BROWSER_ENGINES),
  viewport: z.enum(VIEWPORT_MODES),
  screenshotEnabled: z.boolean(),
  videoEnabled: z.boolean(),
  aiEnabled: z.boolean(),
  retentionDays: z.number().int().min(1).max(365),
  concurrency: z.number().int().min(1).max(10),
  crawlDelayMs: z.number().int().min(0).max(10000),
  maxScanDurationMs: z.number().int().min(60000).max(14_400_000),
  maxScreenshotBytes: z.number().int().min(100_000).max(50_000_000),
  respectRobotsTxt: z.boolean(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

export const compareScansSchema = z.object({
  scanAId: z.string().min(1),
  scanBId: z.string().min(1),
});

export const aiFindingSchema = z.object({
  isLikelyBug: z.boolean(),
  confidence: z.number().min(0).max(1),
  severity: z.enum(SEVERITIES),
  title: z.string().min(1),
  expected: z.string(),
  actual: z.string(),
  reason: z.string(),
  recommendedAction: z.string(),
  rootCause: z.string().optional(),
});

export type AiFinding = z.infer<typeof aiFindingSchema>;

export const scanEventPayloadSchema = z.object({
  type: z.string(),
  message: z.string(),
  payload: z.unknown().optional(),
});
