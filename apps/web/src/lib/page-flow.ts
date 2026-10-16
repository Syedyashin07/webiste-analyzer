const FLOW_RULES: Array<{ name: string; match: RegExp }> = [
  { name: "Register", match: /\b(regist(er|ration|ered)|sign[\s-]?up|signup)\b/i },
  { name: "Login", match: /\b(log[\s-]?in|sign[\s-]?in|signin|auth)\b/i },
  { name: "Dashboard", match: /\b(dashboard|overview|home|console)\b/i },
  { name: "Listings", match: /\b(list(ing)?s?|catalog|products?|jobs?|search|browse)\b/i },
  { name: "Details", match: /\b(detail|view|show|item)\b/i },
  { name: "Profile", match: /\b(profile|account|user)\b/i },
  { name: "Settings", match: /\b(settings?|preferences|config)\b/i },
  { name: "Reports", match: /\b(reports?|analytics)\b/i },
];

function pathAndTitle(url: string, title?: string | null): string {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url;
  }
  return `${path} ${title ?? ""}`;
}

function titleFromPath(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const last = decodeURIComponent(parts.at(-1) || "Home");
    const cleaned = last.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
    if (!cleaned) return "Home";
    return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return "Page";
  }
}

export function pageFlowName(url: string, title?: string | null): string {
  const blob = pathAndTitle(url, title);
  for (const rule of FLOW_RULES) {
    if (rule.match.test(blob)) return rule.name;
  }
  if (title?.trim()) return title.trim();
  return titleFromPath(url);
}

export function uniqueScreenshotCaptions<T extends { id: string; url: string; title?: string | null }>(
  pages: T[],
): Array<T & { flowName: string; caption: string; step: number }> {
  const used = new Map<string, number>();
  return pages.map((page, index) => {
    const flowName = pageFlowName(page.url, page.title);
    const count = (used.get(flowName) ?? 0) + 1;
    used.set(flowName, count);
    const labeled = count === 1 ? flowName : `${flowName} ${count}`;
    return { ...page, flowName: labeled, caption: `${labeled} screenshot`, step: index + 1 };
  });
}
