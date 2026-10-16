import type { BugCategory, Priority, Severity } from "@qa-scanner/shared";
import { SEVERITY_TO_PRIORITY } from "@qa-scanner/shared";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";

export interface UpsertBugInput {
  scanId: string;
  fingerprint: string;
  title: string;
  description: string;
  category: BugCategory;
  severity: Severity;
  url: string;
  pageUrl?: string;
  expected?: string;
  actual?: string;
  stepsToReproduce?: string;
  rootCause?: string;
  technicalDetails?: Record<string, unknown>;
  browser?: string;
  viewport?: string;
  confidence?: number;
  aiAnalysis?: string;
  recommendedAction?: string;
  verified: boolean;
  source: "rule" | "ai";
  status?: "OPEN" | "CONFIRMED" | "UNVERIFIED" | "FALSE_POSITIVE";
}

export async function upsertBug(input: UpsertBugInput) {
  const existing = await prisma.bug.findUnique({
    where: { scanId_fingerprint: { scanId: input.scanId, fingerprint: input.fingerprint } },
  });

  if (existing) {
    const urls = Array.isArray(existing.affectedUrls) ? (existing.affectedUrls as string[]) : [];
    if (input.url && !urls.includes(input.url)) urls.push(input.url);
    return prisma.bug.update({
      where: { id: existing.id },
      data: {
        occurrences: { increment: 1 },
        affectedUrls: urls,
      },
    });
  }

  const count = await prisma.bug.count({ where: { scanId: input.scanId } });
  const bugNumber = `BUG-${String(count + 1).padStart(3, "0")}`;
  const priority: Priority = SEVERITY_TO_PRIORITY[input.severity];
  const status = input.status ?? (input.verified ? "CONFIRMED" : input.source === "ai" ? "UNVERIFIED" : "OPEN");

  return prisma.bug.create({
    data: {
      bugNumber,
      scanId: input.scanId,
      title: input.title,
      description: input.description,
      category: input.category,
      severity: input.severity,
      priority,
      status,
      url: input.url,
      pageUrl: input.pageUrl,
      expected: input.expected,
      actual: input.actual,
      stepsToReproduce: input.stepsToReproduce,
      rootCause: input.rootCause,
      technicalDetails: (input.technicalDetails ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      occurrences: 1,
      affectedUrls: [input.url],
      browser: input.browser ?? "chromium",
      viewport: input.viewport,
      fingerprint: input.fingerprint,
      confidence: input.confidence,
      aiAnalysis: input.aiAnalysis,
      recommendedAction: input.recommendedAction,
      verified: input.verified,
      source: input.source,
    },
  });
}
