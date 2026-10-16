import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "local@qa-scanner.local" },
    update: {},
    create: {
      email: "local@qa-scanner.local",
      name: "Local User",
      settings: { create: {} },
      projects: {
        create: { name: "Default Project" },
      },
    },
    include: { projects: true, settings: true },
  });

  if (user.projects.length === 0) {
    await prisma.project.create({
      data: { name: "Default Project", userId: user.id },
    });
  }

  if (!user.settings) {
    await prisma.appSettings.create({ data: { userId: user.id } });
  }

  console.log("Seeded local user and default project.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
