import { PrismaClient, RoleKey } from "@prisma/client";
import { resolveWmsScope } from "@/lib/wms/access-scope";

export async function getResolvedScope(prisma: PrismaClient, user: { email: string; roles: RoleKey[] }) {
  return resolveWmsScope(prisma, user);
}

export function canUseWarehouse(scope: { access: string; responsibleWarehouseIds: string[]; centralWarehouseId: string | null }, warehouseId?: string | null) {
  if (!warehouseId) return false;
  if (scope.access === "ADMIN") return true;
  if (scope.centralWarehouseId && warehouseId === scope.centralWarehouseId) return true;
  return scope.responsibleWarehouseIds.includes(warehouseId);
}
