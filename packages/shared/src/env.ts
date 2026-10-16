import { z } from "zod";

const boolFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true" || value === "1";
  return false;
}, z.boolean());

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().optional().default("gpt-4o-mini"),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  LOG_LEVEL: z.string().default("info"),
  SCAN_MAX_PAGES: z.coerce.number().int().positive().default(100),
  SCAN_MAX_DEPTH: z.coerce.number().int().min(0).default(5),
  SCAN_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  SCAN_CONCURRENCY: z.coerce.number().int().positive().default(3),
  SCAN_CRAWL_DELAY_MS: z.coerce.number().int().min(0).default(250),
  SCAN_MAX_DURATION_MS: z.coerce.number().int().positive().default(1_800_000),
  SCREENSHOT_ENABLED: boolFromEnv.default(true),
  VIDEO_ENABLED: boolFromEnv.default(true),
  ALLOW_LOCAL_TARGETS: boolFromEnv.default(false),
  STORAGE_DIR: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
  }
  return parsed.data;
}
