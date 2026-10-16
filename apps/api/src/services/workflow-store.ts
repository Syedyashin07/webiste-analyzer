import type { Prisma } from "@prisma/client";
import {
  emptyGraph,
  graphFromPages,
  mergeGraph,
  publicRegistry,
  type RegistryEntry,
  type WorkflowGraphSnapshot,
} from "@qa-scanner/shared";
import { prisma } from "../lib/prisma.js";

export async function loadRegistry(scanId: string): Promise<RegistryEntry[]> {
  const rows = await prisma.workflowDatum.findMany({ where: { scanId }, orderBy: { createdAt: "asc" } });
  return rows.map((row) => ({
    entityKey: row.entityKey,
    fieldKey: row.fieldKey,
    value: row.value,
    sensitive: row.sensitive,
    source: row.source === "observed" ? "observed" : "generated",
  }));
}

export async function saveRegistry(scanId: string, entries: RegistryEntry[]): Promise<void> {
  for (const entry of entries) {
    await prisma.workflowDatum.upsert({
      where: { scanId_entityKey_fieldKey: { scanId, entityKey: entry.entityKey, fieldKey: entry.fieldKey } },
      update: { value: entry.value, sensitive: entry.sensitive, source: entry.source },
      create: { scanId, ...entry },
    });
  }
}

export async function completedFingerprints(scanId: string): Promise<string[]> {
  const rows = await prisma.workflowStep.findMany({
    where: { scanId, status: "completed", actionType: { in: ["click", "upload-fixture"] } },
    select: { fingerprint: true },
  });
  return rows.map((row) => row.fingerprint);
}

export async function saveWorkflowStep(input: {
  scanId: string;
  fingerprint: string;
  pageUrl: string;
  actionType: string;
  selector: string;
  status: string;
  reason?: string;
  expected?: string;
  observed?: string;
  redactedInput?: string;
}): Promise<void> {
  await prisma.workflowStep.upsert({
    where: { scanId_fingerprint: { scanId: input.scanId, fingerprint: input.fingerprint } },
    update: {
      status: input.status,
      reason: input.reason,
      expected: input.expected,
      observed: input.observed,
      redactedInput: input.redactedInput,
    },
    create: input,
  });
}

export async function loadGraph(scanId: string): Promise<WorkflowGraphSnapshot> {
  const row = await prisma.workflowGraph.findUnique({ where: { scanId } });
  if (!row || !row.snapshot || typeof row.snapshot !== "object") return emptyGraph();
  const snapshot = row.snapshot as Partial<WorkflowGraphSnapshot>;
  return { nodes: snapshot.nodes ?? [], edges: snapshot.edges ?? [] };
}

export async function saveGraph(scanId: string, snapshot: WorkflowGraphSnapshot): Promise<void> {
  const payload = snapshot as unknown as Prisma.InputJsonValue;
  await prisma.workflowGraph.upsert({
    where: { scanId },
    update: { snapshot: payload },
    create: { scanId, snapshot: payload },
  });
}

export async function mergeSavedGraph(scanId: string, patch: WorkflowGraphSnapshot): Promise<WorkflowGraphSnapshot> {
  const next = mergeGraph(await loadGraph(scanId), patch);
  await saveGraph(scanId, next);
  return next;
}

export async function seedWorkflowGraph(scanId: string): Promise<void> {
  const pages = await prisma.page.findMany({
    where: { scanId },
    select: { url: true, parentUrl: true, status: true },
    orderBy: { depth: "asc" },
  });
  await mergeSavedGraph(scanId, graphFromPages(pages));
}

export async function workflowReport(scanId: string) {
  const [steps, data, graph] = await Promise.all([
    prisma.workflowStep.findMany({ where: { scanId }, orderBy: { createdAt: "asc" } }),
    loadRegistry(scanId),
    loadGraph(scanId),
  ]);
  return {
    steps: steps.map((step) => ({
      id: step.id,
      fingerprint: step.fingerprint,
      pageUrl: step.pageUrl,
      actionType: step.actionType,
      selector: step.selector,
      status: step.status,
      reason: step.reason,
      expected: step.expected,
      observed: step.observed,
      redactedInput: step.redactedInput,
    })),
    registry: publicRegistry(data),
    graph,
    counts: {
      completed: steps.filter((step) => step.status === "completed").length,
      blocked: steps.filter((step) => step.status === "blocked").length,
      failed: steps.filter((step) => step.status === "failed").length,
      skipped: steps.filter((step) => step.status === "skipped").length,
    },
  };
}
