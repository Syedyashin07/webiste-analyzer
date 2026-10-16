export function tryParseUrl(raw: string, base?: string): URL | null {
  try {
    return base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
}

export function normalizeUrl(raw: string, base?: string): string {
  const url = tryParseUrl(raw, base);
  if (!url) {
    throw new Error(`Invalid URL: ${raw}`);
  }
  return stripTrackingParams(url.toString());
}

export function canonicalizeUrl(url: URL): string {
  const copy = new URL(url.toString());
  copy.hash = "";
  copy.hostname = copy.hostname.toLowerCase();
  if (
    (copy.protocol === "http:" && copy.port === "80") ||
    (copy.protocol === "https:" && copy.port === "443")
  ) {
    copy.port = "";
  }
  if (copy.pathname !== "/" && copy.pathname.endsWith("/")) {
    copy.pathname = copy.pathname.slice(0, -1);
  }
  return copy.toString();
}

export function originOf(raw: string): string {
  return new URL(raw).origin;
}

export function hostOf(raw: string): string {
  return new URL(raw).hostname.toLowerCase();
}

export function isSameRegistrableHost(a: string, b: string): boolean {
  return hostOf(a) === hostOf(b);
}

export function isHttpUrl(raw: string): boolean {
  const url = tryParseUrl(raw);
  return Boolean(url && (url.protocol === "http:" || url.protocol === "https:"));
}

export function stripTrackingParams(raw: string): string {
  const url = new URL(raw);
  const blocked = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
  for (const key of blocked) {
    url.searchParams.delete(key);
  }
  return canonicalizeUrl(url);
}

export function sanitizeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
}

export function isInternalLink(href: string, baseUrl: string): boolean {
  const parsed = tryParseUrl(href, baseUrl);
  if (!parsed) return false;
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  return isSameRegistrableHost(parsed.toString(), baseUrl);
}
