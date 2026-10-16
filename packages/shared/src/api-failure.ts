import { isSensitiveKey, redactObject, redactString } from "./redact.js";

const API_RESOURCE_TYPES = new Set(["xhr", "fetch"]);
const REPLAY_HEADER_ALLOW = new Set(["content-type", "accept", "x-requested-with"]);

export function isApiResource(resourceType: string | null | undefined, url: string): boolean {
  const type = (resourceType ?? "").toLowerCase();
  if (API_RESOURCE_TYPES.has(type)) return true;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    return path.includes("/api/") || path.includes("/graphql") || path.endsWith(".json");
  } catch {
    return false;
  }
}

export function formatApiCall(method: string, url: string): string {
  const verb = (method || "GET").toUpperCase();
  try {
    const parsed = new URL(url);
    return `${verb} ${parsed.pathname}${parsed.search}`;
  } catch {
    return `${verb} ${url}`;
  }
}

export function pickReplayHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  if (!headers) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (isSensitiveKey(key)) continue;
    if (!REPLAY_HEADER_ALLOW.has(key.toLowerCase())) continue;
    result[key] = value;
  }
  return result;
}

export function safeRequestBody(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return JSON.stringify(redactObject(parsed)).slice(0, 4000);
  } catch {
    if (/password|passwd|secret|token=/i.test(raw)) return null;
    return redactString(raw).slice(0, 4000);
  }
}
