import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/server/password";

const prisma = new PrismaClient();

async function main() {
  const roleMap = new Map<string, number>();
  for (const name of ["ADMIN", "EDITOR", "VIEWER"] as const) {
    const role = await prisma.role.upsert({
      where: { name: name as any },
      update: {},
      create: { name: name as any },
    });
    roleMap.set(name, role.id);
  }

  await prisma.heatmapSettings.upsert({
    where: { mode: "FAILURES" as any },
    update: {},
    create: { mode: "FAILURES" as any, minValue: 0, maxValue: 10, updatedBy: "system" },
  });

  await prisma.heatmapSettings.upsert({
    where: { mode: "DOWNTIME" as any },
    update: {},
    create: { mode: "DOWNTIME" as any, minValue: 0, maxValue: 10, updatedBy: "system" },
  });

  const admin = await prisma.user.upsert({
    where: { login: "admin" },
    update: { passwordHash: hashPassword("admin123") },
    create: { login: "admin", displayName: "DEA Admin", passwordHash: hashPassword("admin123") },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: roleMap.get("ADMIN")! } },
    update: {},
    create: { userId: admin.id, roleId: roleMap.get("ADMIN")! },
  });
}

main().finally(async () => {
  await prisma.$disconnect();
});

