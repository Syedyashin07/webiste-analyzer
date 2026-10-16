import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { readStoredFile } from "../lib/storage.js";

function reportMime(format: string): string {
  if (format === "PDF") return "application/pdf";
  if (format === "XLSX") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (format === "HTML") return "text/html";
  if (format === "CSV") return "text/csv";
  return "application/json";
}

export function registerReportRoutes(app: FastifyInstance) {
  app.get("/api/reports", async (request) => {
    const projectId = typeof (request.query as { projectId?: unknown }).projectId === "string"
      ? (request.query as { projectId: string }).projectId.trim()
      : "";
    const reports = await prisma.report.findMany({
      where: projectId ? { scan: { projectId } } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { scan: { select: { url: true, host: true, overallScore: true, project: { select: { id: true, name: true } } } } },
    });
    return { reports };
  });

  app.get("/api/reports/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const report = await prisma.report.findUnique({
      where: { id },
      include: { scan: true },
    });
    if (!report) return reply.status(404).send({ error: "Report not found" });
    return { report };
  });

  app.get("/api/reports/:id/download", async (request, reply) => {
    const { id } = request.params as { id: string };
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) return reply.status(404).send({ error: "Report not found" });
    const mime = reportMime(report.format);
    const data = await readStoredFile(report.storageKey, mime);
    if (!data) return reply.status(404).send({ error: "Report file missing" });
    return reply
      .header("Content-Type", mime)
      .header("Content-Disposition", `attachment; filename="${report.fileName}"`)
      .send(data);
  });
}

export function registerEvidenceRoutes(app: FastifyInstance) {
  app.get("/api/evidence/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const screenshot = await prisma.screenshot.findUnique({ where: { id } });
    if (screenshot) return streamStored(reply, screenshot.storageKey, screenshot.mimeType);
    const video = await prisma.video.findUnique({ where: { id } });
    if (video) return streamStored(reply, video.storageKey, video.mimeType);
    const trace = await prisma.trace.findUnique({ where: { id } });
    if (trace) return streamStored(reply, trace.storageKey, "application/zip");
    return reply.status(404).send({ error: "Evidence not found" });
  });
}

async function streamStored(
  reply: { header: (k: string, v: string) => unknown; send: (body: unknown) => unknown; status: (n: number) => { send: (body: unknown) => unknown } },
  storageKey: string,
  mimeType: string,
) {
  const data = await readStoredFile(storageKey, mimeType);
  if (!data) {
    return reply.status(404).send({ error: "File missing" });
  }
  reply.header("Content-Type", mimeType);
  reply.header("Cache-Control", "private, max-age=3600");
  return reply.send(data);
}
