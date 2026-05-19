import { PrismaClient, RoleKey } from "@prisma/client";

export type WmsScope = {
  access: "ADMIN" | "CENTRAL" | "AUXILIARY" | "NONE";
  responsibleWarehouseIds: string[];
  centralWarehouseId: string | null;
};

export async function resolveWmsScope(
  prisma: PrismaClient,
  user: { email: string; roles: RoleKey[] }
): Promise<WmsScope> {
  if (user.roles.includes("ADMIN")) {
    const primary = await prisma.warehouse.findFirst({ where: { status: "ACTIVE", type: "PRIMARY" }, select: { id: true } });
    return { access: "ADMIN", responsibleWarehouseIds: [], centralWarehouseId: primary?.id ?? null };
  }

  const [responsible, primary] = await Promise.all([
    prisma.warehouse.findMany({
      where: { status: "ACTIVE", responsibleEmail: user.email },
      select: { id: true, type: true }
    }),
    prisma.warehouse.findFirst({ where: { status: "ACTIVE", type: "PRIMARY" }, select: { id: true } })
  ]);

  const responsibleWarehouseIds = responsible.map((w) => w.id);
  const hasPrimaryResponsibility = responsible.some((w) => w.type === "PRIMARY");

  return {
    access: responsibleWarehouseIds.length === 0 ? "NONE" : hasPrimaryResponsibility ? "CENTRAL" : "AUXILIARY",
    responsibleWarehouseIds,
    centralWarehouseId: primary?.id ?? null
  };
}

export function canAccessPath(scope: WmsScope, pathname: string) {
  if (scope.access === "ADMIN") return true;
  const exact = (p: string) => pathname === p || pathname.startsWith(`${p}/`);

  const common = ["/wms", "/wms/balances", "/wms/movements"];
  if (common.some(exact)) return true;
  if (scope.access === "AUXILIARY" && exact("/wms/internal-requests")) return true;
  if (scope.access === "CENTRAL" && (exact("/wms/reservations") || exact("/wms/analytics") || exact("/wms/audit"))) return true;
  return false;
}
