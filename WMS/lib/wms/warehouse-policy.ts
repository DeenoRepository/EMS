import { PrismaClient } from "@prisma/client";

type WarehouseLite = {
  id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  type: "PRIMARY" | "AUXILIARY";
  createdAt: Date;
};

export async function getWarehousePolicy(prisma: PrismaClient) {
  const rows = (await prisma.warehouse.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ createdAt: "asc" }]
  })) as WarehouseLite[];

  if (rows.length === 0) {
    return { primary: null as WarehouseLite | null, auxiliaries: [] as WarehouseLite[] };
  }

  const primary = rows.find((x) => x.type === "PRIMARY") ?? rows[0];
  const auxiliaries = rows.filter((x) => x.id !== primary.id);
  return { primary, auxiliaries };
}
