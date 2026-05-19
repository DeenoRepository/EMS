import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const roleMap = new Map<string, string>();
  for (const key of ["ADMIN", "EDITOR", "APPROVER", "VIEWER"] as const) {
    const role = await prisma.role.upsert({
      where: { key },
      update: {},
      create: { key, name: key }
    });
    roleMap.set(key, role.id);
  }

  await prisma.heatmapSettings.upsert({
    where: { mode: "FAILURES" as any },
    update: {},
    create: { mode: "FAILURES" as any, minValue: 0, maxValue: 10, updatedBy: "system" }
  });

  await prisma.heatmapSettings.upsert({
    where: { mode: "DOWNTIME" as any },
    update: {},
    create: { mode: "DOWNTIME" as any, minValue: 0, maxValue: 10, updatedBy: "system" }
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@ems.local" },
    update: { displayName: "DEA Admin" },
    create: { email: "admin@ems.local", displayName: "DEA Admin", passwordHash: "" }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: roleMap.get("ADMIN")! } },
    update: {},
    create: { userId: admin.id, roleId: roleMap.get("ADMIN")! }
  });

  // eslint-disable-next-line no-console
  console.log("SRS seed completed: roles, heatmap settings, and admin user created.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
