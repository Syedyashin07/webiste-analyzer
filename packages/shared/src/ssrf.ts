import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { tryParseUrl } from "./url.js";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google.com",
  "instance-data",
]);

const BLOCKED_EXACT_IPS = new Set(["127.0.0.1", "0.0.0.0", "::1", "::", "169.254.169.254"]);

export interface SsrfCheckResult {
  ok: boolean;
  url: string;
  hostname: string;
  addresses: string[];
  reason?: string;
}

export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && parts[2] === 2) return false;
  return false;
}

export function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.replace("::ffff:", "");
    if (isPrivateIpv4(mapped)) return true;
  }
  return false;
}

export function isBlockedIp(ip: string): boolean {
  if (BLOCKED_EXACT_IPS.has(ip)) return true;
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

export async function resolveHostAddresses(hostname: string): Promise<string[]> {
  if (isIP(hostname)) {
    return [hostname];
  }
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((entry) => entry.address);
}

export async function assertSafeScanTarget(
  rawUrl: string,
  options: { allowLocal?: boolean } = {},
): Promise<SsrfCheckResult> {
  const parsed = tryParseUrl(rawUrl);
  if (!parsed) {
    return { ok: false, url: rawUrl, hostname: "", addresses: [], reason: "Invalid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      url: rawUrl,
      hostname: parsed.hostname,
      addresses: [],
      reason: "Only http and https URLs are allowed",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!options.allowLocal && BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, url: rawUrl, hostname, addresses: [], reason: "Localhost and metadata hosts are blocked" };
  }
  if (hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".localhost")) {
    if (!options.allowLocal) {
      return { ok: false, url: rawUrl, hostname, addresses: [], reason: "Internal hostnames are blocked" };
    }
  }

  let addresses: string[] = [];
  try {
    addresses = await resolveHostAddresses(hostname);
  } catch {
    return { ok: false, url: rawUrl, hostname, addresses: [], reason: "DNS resolution failed" };
  }

  if (addresses.length === 0) {
    return { ok: false, url: rawUrl, hostname, addresses, reason: "No DNS records found" };
  }

  if (!options.allowLocal) {
    const blocked = addresses.find((address) => isBlockedIp(address));
    if (blocked) {
      return {
        ok: false,
        url: rawUrl,
        hostname,
        addresses,
        reason: `Resolved to a private or blocked address (${blocked})`,
      };
    }
  }

  return { ok: true, url: parsed.toString(), hostname, addresses };
}
