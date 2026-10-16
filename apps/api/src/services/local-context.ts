import { prisma } from "../lib/prisma.js";

export async function getLocalContext() {
  let user = await prisma.user.findUnique({
    where: { email: "local@qa-scanner.local" },
    include: { projects: true, settings: true },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "local@qa-scanner.local",
        name: "Local User",
        settings: { create: {} },
        projects: { create: { name: "Default Project" } },
      },
      include: { projects: true, settings: true },
    });
  }
  const project = user.projects[0];
  if (!project) throw new Error("Local project missing. Run npm run prisma:seed");
  return { user, project, settings: user.settings };
}
