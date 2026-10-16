import { prisma } from "./prisma.js";

export async function readSessionUser(request: { headers: { authorization?: string } }) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}
