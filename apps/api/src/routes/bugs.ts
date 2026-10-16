import type { FastifyInstance } from "fastify";
import {
  bugFilterSchema,
  isDetailedEvidenceBug,
  updateBugSchema,
  type BugCategory,
  type BugStatus,
  type Priority,
  type Severity,
} from "@qa-scanner/shared";
import { prisma } from "../lib/prisma.js";
import { replayNetworkErrors } from "../lib/failed-apis.js";

export function registerBugRoutes(app: FastifyInstance) {
  app.get("/api/bugs", async (request) => {
    const query = bugFilterSchema.parse(request.query);
    const bugs = await prisma.bug.findMany({
      where: {
        severity: query.severity as Severity | undefined,
        priority: query.priority as Priority | undefined,
        status: query.status as BugStatus | undefined,
        category: query.category as BugCategory | undefined,
        scanId: query.scanId,
        scan: query.projectId ? { projectId: query.projectId } : undefined,
        url: query.page ? { contains: query.page, mode: "insensitive" } : undefined,
        detectedAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
        OR: query.q
          ? [
              { title: { contains: query.q, mode: "insensitive" } },
              { url: { contains: query.q, mode: "insensitive" } },
              { description: { contains: query.q, mode: "insensitive" } },
              { fingerprint: { contains: query.q, mode: "insensitive" } },
              { actual: { contains: query.q, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: [{ detectedAt: "desc" }],
      take: 1000,
      include: {
        scan: { select: { url: true, host: true, project: { select: { id: true, name: true } } } },
        evidence: { include: { screenshot: true } },
      },
    });
    return {
      bugs: bugs
        .filter((bug) =>
          isDetailedEvidenceBug({
            category: bug.category,
            title: bug.title,
            description: bug.description,
            actual: bug.actual,
          }),
        )
        .slice(0, 200),
    };
  });

  app.get("/api/bugs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const bug = await prisma.bug.findUnique({
      where: { id },
      include: {
        scan: { select: { id: true, url: true, host: true, project: { select: { id: true, name: true } } } },
        evidence: { include: { screenshot: true, video: true, trace: true } },
      },
    });
    if (!bug) return reply.status(404).send({ error: "Bug not found" });
    return { bug };
  });

  app.post("/api/bugs/:id/replay-api", async (request, reply) => {
    const { id } = request.params as { id: string };
    const bug = await prisma.bug.findUnique({ where: { id } });
    if (!bug) return reply.status(404).send({ error: "Bug not found" });
    if (bug.category !== "NETWORK") {
      return reply.status(400).send({ error: "Fast replay is only available for API / network failures" });
    }
    const row =
      (await prisma.networkError.findFirst({
        where: { scanId: bug.scanId, fingerprint: bug.fingerprint },
      })) ??
      (await prisma.networkError.findFirst({
        where: { scanId: bug.scanId, requestUrl: bug.url },
      }));
    if (!row) return reply.status(404).send({ error: "No captured API request to replay" });
    return replayNetworkErrors(bug.scanId, [row.id]);
  });

  app.patch("/api/bugs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateBugSchema.parse(request.body);
    const existing = await prisma.bug.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Bug not found" });
    const bug = await prisma.bug.update({ where: { id }, data: body });
    return { bug };
  });
}
