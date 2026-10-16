import pino from "pino";

const SENSITIVE_PATHS = [
  "password",
  "passwd",
  "secret",
  "token",
  "apiKey",
  "api_key",
  "authorization",
  "cookie",
  "cookies",
  "set-cookie",
  "*.password",
  "*.token",
  "req.headers.authorization",
  "req.headers.cookie",
];

export function createLogger(name: string, level = process.env.LOG_LEVEL ?? "info") {
  return pino({
    name,
    level,
    redact: {
      paths: SENSITIVE_PATHS,
      censor: "[REDACTED]",
    },
  });
}

export type AppLogger = ReturnType<typeof createLogger>;
