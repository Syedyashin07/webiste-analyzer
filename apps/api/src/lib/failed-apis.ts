import pLimit from "p-limit";
import { formatApiCall, isApiResource } from "@qa-scanner/shared";
import { prisma } from "./prisma.js";
import { replayHttpRequest } from "./http-check.js";

const MAX_REPLAY = 40;

export interface FailedApiView {
  id: string;
  api: string;
  method: string;
  requestUrl: string;
  statusCode: number | null;
  error: string | null;
  resourceType: string | null;
  pageId: string | null;
  pageUrl: string | null;
  occurrences: number;
  pages: string[];
}

export function toFailedApiViews(
  rows: Array<{
    id: string;
    method: string;
    requestUrl: string;
    statusCode: number | null;
    error: string | null;
    resourceType: string | null;
    pageId: string | null;
    page?: { url: string } | null;
  }>,
): FailedApiView[] {
  const grouped = new Map<string, FailedApiView>();
  for (const row of rows) {
    if (!isApiResource(row.resourceType, row.requestUrl)) continue;
    const key = `${row.method.toUpperCase()} ${row.requestUrl}`;
    const pageUrl = row.page?.url ?? null;
    const existing = grouped.get(key);
    if (existing) {
      existing.occurrences += 1;
      if (pageUrl && !existing.pages.includes(pageUrl)) existing.pages.push(pageUrl);
      continue;
    }
    grouped.set(key, {
      id: row.id,
      api: formatApiCall(row.method, row.requestUrl),
      method: row.method.toUpperCase(),
      requestUrl: row.requestUrl,
      statusCode: row.statusCode,
      error: row.error,
      resourceType: row.resourceType,
      pageId: row.pageId,
      pageUrl,
      occurrences: 1,
      pages: pageUrl ? [pageUrl] : [],
    });
  }
  return [...grouped.values()];
}

export async function listFailedApis(scanId: string): Promise<FailedApiView[]> {
  const rows = await prisma.networkError.findMany({
    where: { scanId },
    include: { page: { select: { url: true } } },
    orderBy: { createdAt: "asc" },
  });
  return toFailedApiViews(rows);
}

export async function countFailedApis(scanId: string): Promise<number> {
  const rows = await prisma.networkError.findMany({
    where: { scanId },
    select: { resourceType: true, requestUrl: true },
  });
  const unique = new Set<string>();
  for (const row of rows) {
    if (!isApiResource(row.resourceType, row.requestUrl)) continue;
    unique.add(row.requestUrl);
  }
  return unique.size;
}

export async function replayNetworkErrors(scanId: string, ids?: string[]) {
  const rows = await prisma.networkError.findMany({
    where: {
      scanId,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    include: { page: { select: { url: true } } },
    orderBy: { createdAt: "asc" },
  });
  const apis = toFailedApiViews(rows).slice(0, MAX_REPLAY);
  const limit = pLimit(8);
  const results = await Promise.all(
    apis.map((api) =>
      limit(async () => {
        const replay = await replayHttpRequest({
          url: api.requestUrl,
          method: api.method,
        });
        return {
          id: api.id,
          api: api.api,
          method: api.method,
          requestUrl: api.requestUrl,
          pageUrl: api.pageUrl,
          originalStatus: api.statusCode,
          originalError: api.error,
          replayOk: replay.ok,
          replayStatus: replay.status,
          replayError: replay.error,
          durationMs: replay.durationMs,
        };
      }),
    ),
  );
  return {
    replayed: results.length,
    stillFailing: results.filter((item) => !item.replayOk).length,
    recovered: results.filter((item) => item.replayOk).length,
    results,
  };
}
