import { CRAWLER_USER_AGENT, hostOf, isInternalLink, normalizeUrl, tryParseUrl } from "@qa-scanner/shared";

export interface DiscoveredPage {
  url: string;
  normalizedUrl: string;
  depth: number;
  parentUrl: string | null;
  discoveredAt: string;
}

export interface RobotsRules {
  raw: string;
  allows: (path: string) => boolean;
}

export interface CrawlFetchResult {
  html: string;
  finalUrl: string;
  status: number;
  extraUrls?: string[];
}

export interface CrawlOptions {
  startUrl: string;
  maxPages: number;
  maxDepth: number;
  delayMs: number;
  respectRobots: boolean;
  signal?: AbortSignal;
  fetchHtml: (url: string) => Promise<CrawlFetchResult | null>;
  fetchText?: (url: string) => Promise<string | null>;
  extractLinks: (html: string, pageUrl: string) => string[];
  onDiscovered?: (page: DiscoveredPage) => Promise<void> | void;
  isAllowedTarget?: (url: string) => Promise<boolean>;
}

export function parseRobotsTxt(raw: string, userAgent = CRAWLER_USER_AGENT): RobotsRules {
  const groups: Array<{ agents: string[]; disallow: string[]; allow: string[] }> = [];
  let current: { agents: string[]; disallow: string[]; allow: string[] } | null = null;

  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [keyRaw, ...rest] = line.split(":");
    const key = keyRaw.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!current || current.disallow.length + current.allow.length > 0) {
        current = { agents: [value.toLowerCase()], disallow: [], allow: [] };
        groups.push(current);
      } else {
        current.agents.push(value.toLowerCase());
      }
    } else if (key === "disallow" && current) {
      current.disallow.push(value);
    } else if (key === "allow" && current) {
      current.allow.push(value);
    }
  }

  const ua = userAgent.toLowerCase();
  const matching =
    groups.find((group) => group.agents.some((agent) => ua.includes(agent) && agent !== "*")) ??
    groups.find((group) => group.agents.includes("*")) ??
    { agents: ["*"], disallow: [], allow: [] };

  const matchesRule = (path: string, rule: string) => {
    if (!rule) return false;
    return path.startsWith(rule);
  };

  return {
    raw,
    allows: (path: string) => {
      const allowHit = matching.allow
        .filter((rule) => matchesRule(path, rule))
        .sort((a, b) => b.length - a.length)[0];
      const disallowHit = matching.disallow
        .filter((rule) => matchesRule(path, rule))
        .sort((a, b) => b.length - a.length)[0];
      if (allowHit && (!disallowHit || allowHit.length >= disallowHit.length)) return true;
      if (disallowHit) return false;
      return true;
    },
  };
}

export function parseSitemapXml(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((value) => value.startsWith("http://") || value.startsWith("https://"));
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Scan cancelled"));
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

export async function crawlSite(options: CrawlOptions): Promise<DiscoveredPage[]> {
  const start = normalizeUrl(options.startUrl);
  const originHost = hostOf(start);
  const visited = new Set<string>();
  const discovered: DiscoveredPage[] = [];
  const queue: Array<{ url: string; depth: number; parentUrl: string | null }> = [
    { url: start, depth: 0, parentUrl: null },
  ];

  let robots: RobotsRules | null = null;
  if (options.respectRobots && options.fetchText) {
    const robotsUrl = `${new URL(start).origin}/robots.txt`;
    const raw = await options.fetchText(robotsUrl);
    if (raw) robots = parseRobotsTxt(raw);
  }

  if (options.fetchText && options.maxPages > 1 && options.maxDepth > 0) {
    const origin = new URL(start).origin;
    const sitemapXml = await options.fetchText(`${origin}/sitemap.xml`);
    if (sitemapXml) {
      const locs = parseSitemapXml(sitemapXml);
      const nested = locs.filter((url) => url.toLowerCase().endsWith(".xml")).slice(0, 3);
      for (const nestedUrl of nested) {
        const childXml = await options.fetchText(nestedUrl);
        if (childXml) locs.push(...parseSitemapXml(childXml));
      }
      for (const loc of locs) {
        if (loc.toLowerCase().endsWith(".xml")) continue;
        if (!isInternalLink(loc, start)) continue;
        if (queue.some((item) => item.url === loc) || loc === start) continue;
        if (queue.length >= options.maxPages) break;
        queue.push({ url: loc, depth: 1, parentUrl: start });
      }
    }
  }

  while (queue.length > 0 && discovered.length < options.maxPages) {
    if (options.signal?.aborted) throw new Error("Scan cancelled");
    const item = queue.shift();
    if (!item) break;

    let normalized: string;
    try {
      normalized = normalizeUrl(item.url);
    } catch {
      continue;
    }
    if (visited.has(normalized)) continue;
    if (hostOf(normalized) !== originHost) continue;
    if (robots && !robots.allows(new URL(normalized).pathname)) continue;
    if (options.isAllowedTarget && !(await options.isAllowedTarget(normalized))) continue;

    visited.add(normalized);
    const page: DiscoveredPage = {
      url: normalized,
      normalizedUrl: normalized,
      depth: item.depth,
      parentUrl: item.parentUrl,
      discoveredAt: new Date().toISOString(),
    };
    discovered.push(page);
    await options.onDiscovered?.(page);

    if (item.depth >= options.maxDepth) continue;

    await sleep(options.delayMs, options.signal);
    const fetched = await options.fetchHtml(normalized);
    if (!fetched) continue;

    const links = [
      ...options.extractLinks(fetched.html, fetched.finalUrl),
      ...(fetched.extraUrls ?? []),
    ];
    for (const href of links) {
      if (!isInternalLink(href, start)) continue;
      const parsed = tryParseUrl(href, fetched.finalUrl);
      if (!parsed) continue;
      let child: string;
      try {
        child = normalizeUrl(parsed.toString());
      } catch {
        continue;
      }
      if (visited.has(child)) continue;
      if (queue.some((queued) => queued.url === child)) continue;
      if (discovered.length + queue.length >= options.maxPages) break;
      queue.push({ url: child, depth: item.depth + 1, parentUrl: normalized });
    }
  }

  return discovered;
}
