export function suggestSiteName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return (host.split(".")[0] ?? "").slice(0, 80);
  } catch {
    return "";
  }
}

export function groupBySite<T>(
  items: T[],
  siteOf: (item: T) => { id: string; name: string } | undefined,
): Array<{ id: string; name: string; items: T[] }> {
  const order: string[] = [];
  const groups = new Map<string, { id: string; name: string; items: T[] }>();
  for (const item of items) {
    const site = siteOf(item) ?? { id: "unknown", name: "Untitled" };
    const existing = groups.get(site.id);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    groups.set(site.id, { id: site.id, name: site.name, items: [item] });
    order.push(site.id);
  }
  return order.map((id) => groups.get(id)!);
}
