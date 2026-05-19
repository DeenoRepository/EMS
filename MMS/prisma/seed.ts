import { PrismaClient, RoleKey } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const roles: RoleKey[] = ["VIEWER", "EDITOR", "APPROVER", "ADMIN"];
  await Promise.all(
    roles.map((key) =>
      prisma.role.upsert({
        where: { key },
        update: {},
        create: {
          key,
          name: key
        }
      })
    )
  );
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
