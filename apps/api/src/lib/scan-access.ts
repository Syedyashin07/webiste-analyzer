import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveScanCoverage } from "@qa-scanner/shared";
import { prisma } from "./prisma.js";
import { readSessionUser } from "./session.js";

export async function assertWorkflowOwner(request: FastifyRequest, reply: FastifyReply, scanId: string): Promise<boolean> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: { configuration: true, project: { select: { userId: true } } },
  });
  if (!scan) return true;
  if (resolveScanCoverage(scan.configuration) !== "WORKFLOW") return true;
  const user = await readSessionUser(request);
  if (!user) {
    reply.status(401).send({ error: "Sign in to open this workflow scan" });
    return false;
  }
  if (user.id !== scan.project.userId) {
    reply.status(403).send({ error: "You do not own this workflow scan" });
    return false;
  }
  return true;
}
