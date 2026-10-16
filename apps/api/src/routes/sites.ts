import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getLocalContext } from "../services/local-context.js";
import { readSessionUser } from "../lib/session.js";

async function visibleUserIds(request: { headers: { authorization?: string } }) {
  const { user } = await getLocalContext();
  const session = await readSessionUser(request);
  return session && session.id !== user.id ? [user.id, session.id] : [user.id];
}

export function registerSiteRoutes(app: FastifyInstance) {
  app.get("/api/sites", async (request) => {
    const userIds = await visibleUserIds(request);
    const projects = await prisma.project.findMany({
      where: { userId: { in: userIds }, scans: { some: {} } },
      orderBy: { updatedAt: "desc" },
      include: {
        scans: {
          orderBy: { createdAt: "desc" },
          select: {
            url: true,
            _count: { select: { bugs: true, reports: true } },
          },
        },
      },
    });
    return {
      sites: projects.map((project) => ({
        id: project.id,
        name: project.name,
        updatedAt: project.updatedAt,
        url: project.scans[0]?.url ?? null,
        scanCount: project.scans.length,
        bugCount: project.scans.reduce((total, scan) => total + scan._count.bugs, 0),
        reportCount: project.scans.reduce((total, scan) => total + scan._count.reports, 0),
      })),
    };
  });

  app.get("/api/sites/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userIds = await visibleUserIds(request);
    const project = await prisma.project.findFirst({
      where: { id, userId: { in: userIds } },
      include: {
        scans: { orderBy: { createdAt: "desc" }, take: 1, select: { url: true } },
        _count: { select: { scans: true } },
      },
    });
    if (!project) return reply.status(404).send({ error: "Site not found" });
    const [bugCount, reportCount] = await Promise.all([
      prisma.bug.count({ where: { scan: { projectId: id } } }),
      prisma.report.count({ where: { scan: { projectId: id } } }),
    ]);
    return {
      site: {
        id: project.id,
        name: project.name,
        url: project.scans[0]?.url ?? null,
        scanCount: project._count.scans,
        bugCount,
        reportCount,
      },
    };
  });
}
