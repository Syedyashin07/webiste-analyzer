import { createHash } from "node:crypto";
import type { BugCategory } from "./constants.js";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeErrorSignature(message: string): string {
  return message
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\b\d{2,}\b/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export function makeFingerprint(parts: {
  category: BugCategory | string;
  signature: string;
  url?: string;
  element?: string;
}): string {
  const payload = [
    parts.category,
    normalizeErrorSignature(parts.signature),
    parts.element ?? "",
    parts.url ? normalizeUrlForFingerprint(parts.url) : "",
  ].join("|");
  return sha256(payload);
}

export function normalizeUrlForFingerprint(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function groupedJsFingerprint(message: string): string {
  return makeFingerprint({
    category: "JAVASCRIPT",
    signature: normalizeErrorSignature(message),
  });
}
