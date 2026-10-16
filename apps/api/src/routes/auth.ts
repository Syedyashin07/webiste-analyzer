import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { hashPassword, newSessionToken, verifyPassword } from "../lib/password.js";

function readText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const SESSION_DAYS = 14;

function publicUser(user: { id: string; name: string; email: string }) {
  return { id: user.id, name: user.name, email: user.email };
}

async function startSession(userId: string) {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", async (request, reply) => {
    const body = request.body as { name?: unknown; email?: unknown; password?: unknown };
    const name = readText(body.name, 80);
    const email = readText(body.email, 200).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!name || !isEmail(email) || password.length < 8) {
      return reply.status(400).send({ error: "Enter your name, a valid email, and a password of at least 8 characters" });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.status(409).send({ error: "An account with this email already exists" });
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        settings: { create: {} },
      },
    });
    const session = await startSession(user.id);
    return reply.status(201).send({ token: session.token, user: publicUser(user) });
  });

  app.post("/api/auth/login", async (request, reply) => {
    const body = request.body as { email?: unknown; password?: unknown };
    const email = readText(body.email, 200).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!isEmail(email) || !password) {
      return reply.status(400).send({ error: "Enter your email and password" });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      return reply.status(401).send({ error: "Email or password is incorrect" });
    }
    const session = await startSession(user.id);
    return { token: session.token, user: publicUser(user) };
  });

  app.get("/api/auth/me", async (request) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return { user: null };
    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.expiresAt.getTime() < Date.now()) return { user: null };
    return { user: publicUser(session.user) };
  });

  app.post("/api/auth/logout", async (request) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
    if (token) await prisma.session.deleteMany({ where: { token } });
    return { ok: true };
  });
}
