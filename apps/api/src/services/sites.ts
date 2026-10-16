import { hostOf } from "@qa-scanner/shared";
import { prisma } from "../lib/prisma.js";

export function siteNameFromUrl(url: string): string {
  const host = hostOf(url).replace(/^www\./, "");
  const label = host.split(".")[0] || host;
  return label.slice(0, 80) || "Site";
}

export function cleanSiteName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}

export async function ensureSite(userId: string, name: string) {
  const cleaned = cleanSiteName(name);
  const existing = await prisma.project.findFirst({
    where: { userId, name: { equals: cleaned, mode: "insensitive" } },
  });
  if (existing) return existing;
  return prisma.project.create({
    data: { userId, name: cleaned },
  });
}
