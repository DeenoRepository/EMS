import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { WmsRole } from "@prisma/client";

export interface UserWarehouseAccess {
  warehouses: string[]; // Названия складов
  warehouseIds: string[]; // ID складов
  isGlobalAdmin: boolean;
  rolesByWarehouse: Record<string, WmsRole>;
}

/**
 * Проверяет, привязан ли пользователь как МОЛ, Оператор или через RoleScope к конкретным складам.
 * Возвращает список названий складов. При ADMIN возвращает null (полный доступ).
 */
export async function getUserResponsibleWarehouses(): Promise<string[] | null> {
  const access = await getUserWarehouseAccess();
  if (access.isGlobalAdmin) return null;
  return access.warehouses;
}

/**
 * Возвращает список ID разрешенных складов для пользователя. При ADMIN возвращает null.
 */
export async function getUserResponsibleWarehouseIds(): Promise<string[] | null> {
  const access = await getUserWarehouseAccess();
  if (access.isGlobalAdmin) return null;
  return access.warehouseIds;
}

/**
 * Возвращает расширенную информацию о правах доступа пользователя ко всем складам WMS
 * с учетом моделей WarehouseKeeper, RoleScope из RBAC и legacy полей.
 *
 * Оптимизировано (PERF-01): запросы к WarehouseKeeper и UserRole выполняются параллельно.
 */
export async function getUserWarehouseAccess(): Promise<UserWarehouseAccess> {
  try {
    const session = await getSession();
    if (!session) return { warehouses: [], warehouseIds: [], isGlobalAdmin: false, rolesByWarehouse: {} };

    if (session.roles.includes("ADMIN")) {
      return { warehouses: [], warehouseIds: [], isGlobalAdmin: true, rolesByWarehouse: {} };
    }

    const warehouseNamesSet = new Set<string>();
    const warehouseIdsSet = new Set<string>();
    const rolesByWarehouse: Record<string, WmsRole> = {};

    // PERF-01: Параллельное выполнение запросов вместо последовательных
    const [keepers, userRoles] = await Promise.all([
      // 1. Поиск по N:M модели WarehouseKeeper
      prisma.warehouseKeeper.findMany({
        where: {
          OR: [
            { userId: session.id },
            { username: { equals: session.username, mode: "insensitive" } }
          ]
        },
        include: { warehouse: { select: { id: true, name: true } } }
      }),
      // 2. Поиск по RBAC RoleScope.allowedWarehouses
      prisma.userRole.findMany({
        where: { userId: session.id },
        include: { role: { include: { scope: true } } }
      }),
    ]);

    // Обработка результатов WarehouseKeeper
    for (const keeper of keepers) {
      warehouseNamesSet.add(keeper.warehouse.name);
      warehouseIdsSet.add(keeper.warehouse.id);
      rolesByWarehouse[keeper.warehouse.name] = keeper.role;
      rolesByWarehouse[keeper.warehouse.id] = keeper.role;
    }

    // Обработка результатов UserRole
    for (const ur of userRoles) {
      if (ur.role.scope) {
        if (ur.role.scope.isGlobal) {
          return { warehouses: [], warehouseIds: [], isGlobalAdmin: true, rolesByWarehouse: {} };
        }

        const allowed = ur.role.scope.allowedWarehouses;
        if (Array.isArray(allowed)) {
          for (const item of allowed) {
            if (typeof item === "string") {
              warehouseNamesSet.add(item);
              warehouseIdsSet.add(item);
            }
          }
        }
      }
    }

    // 3. Фолбэк на старые поля Warehouse.responsibleUser/responsibleUsername
    // Выполняется только если не нашли складов через keepers/roles
    if (warehouseNamesSet.size === 0) {
      const legacyWarehouses = await prisma.warehouse.findMany({
        where: {
          OR: [
            { responsibleUser: { equals: session.displayName, mode: "insensitive" } },
            { responsibleUser: { equals: session.username, mode: "insensitive" } },
            { responsibleUsername: { equals: session.username, mode: "insensitive" } }
          ]
        },
        select: { id: true, name: true }
      });

      for (const lw of legacyWarehouses) {
        warehouseNamesSet.add(lw.name);
        warehouseIdsSet.add(lw.id);
      }
    }

    // Заполняем ID складов для найденных по имени (если есть имена без ID)
    if (warehouseNamesSet.size > 0 && warehouseIdsSet.size < warehouseNamesSet.size) {
      const namesWithoutIds = Array.from(warehouseNamesSet).filter(
        (name) => !Array.from(warehouseIdsSet).some((id) => id === name)
      );
      if (namesWithoutIds.length > 0) {
        const matchedWarehouses = await prisma.warehouse.findMany({
          where: { name: { in: namesWithoutIds } },
          select: { id: true, name: true }
        });
        for (const w of matchedWarehouses) {
          warehouseIdsSet.add(w.id);
        }
      }
    }

    return {
      warehouses: Array.from(warehouseNamesSet),
      warehouseIds: Array.from(warehouseIdsSet),
      isGlobalAdmin: false,
      rolesByWarehouse
    };
  } catch (err) {
    console.error("getUserWarehouseAccess failed:", err);
    return { warehouses: [], warehouseIds: [], isGlobalAdmin: false, rolesByWarehouse: {} };
  }
}

/**
 * Проверяет, доступен ли конкретный склад (по имени или по ID) текущему пользователю
 */
export async function canAccessWarehouse(warehouseNameOrId: string): Promise<boolean> {
  const access = await getUserWarehouseAccess();
  if (access.isGlobalAdmin) return true;
  return (
    access.warehouses.includes(warehouseNameOrId) ||
    access.warehouseIds.includes(warehouseNameOrId)
  );
}
