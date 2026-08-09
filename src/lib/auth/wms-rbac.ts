import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { WmsRole } from "@prisma/client";

export interface UserWarehouseAccess {
  warehouses: string[];
  isGlobalAdmin: boolean;
  rolesByWarehouse: Record<string, WmsRole>;
}

/**
 * Проверяет, привязан ли пользователь как МОЛ или Оператор к конкретным складам.
 * Если да — возвращает названия складов, за которые он отвечает.
 * Если пользователь ADMIN — возвращает null (нет ограничений, доступ ко всем складам).
 */
export async function getUserResponsibleWarehouses(): Promise<string[] | null> {
  try {
    const session = await getSession();

    if (!session) return []; // Если нет сессии — нет доступа
    if (session.roles.includes("ADMIN")) return null; // ADMIN видит все склады

    // 1. Поиск по новой модели N:M WarehouseKeeper
    const keepers = await prisma.warehouseKeeper.findMany({
      where: {
        OR: [
          { userId: session.id },
          { username: { equals: session.username, mode: "insensitive" } }
        ]
      },
      include: { warehouse: { select: { name: true } } }
    });

    if (keepers.length > 0) {
      return Array.from(new Set(keepers.map((k) => k.warehouse.name)));
    }

    // 2. Фолбэк на старые поля Warehouse.responsibleUser/responsibleUsername
    const legacyWarehouses = await prisma.warehouse.findMany({
      where: {
        OR: [
          { responsibleUser: { equals: session.displayName, mode: "insensitive" } },
          { responsibleUser: { equals: session.username, mode: "insensitive" } },
          { responsibleUsername: { equals: session.username, mode: "insensitive" } }
        ]
      },
      select: { name: true }
    });

    if (legacyWarehouses.length === 0) {
      return [];
    }

    return legacyWarehouses.map((w) => w.name);
  } catch (err) {
    console.error("getUserResponsibleWarehouses failed:", err);
    return [];
  }
}

/**
 * Возвращает расширенную информацию о правах доступа пользователя ко всем складам WMS.
 */
export async function getUserWarehouseAccess(): Promise<UserWarehouseAccess> {
  try {
    const session = await getSession();
    if (!session) return { warehouses: [], isGlobalAdmin: false, rolesByWarehouse: {} };

    if (session.roles.includes("ADMIN")) {
      return { warehouses: [], isGlobalAdmin: true, rolesByWarehouse: {} };
    }

    const keepers = await prisma.warehouseKeeper.findMany({
      where: {
        OR: [
          { userId: session.id },
          { username: { equals: session.username, mode: "insensitive" } }
        ]
      },
      include: { warehouse: { select: { name: true } } }
    });

    const warehouses = Array.from(new Set(keepers.map(k => k.warehouse.name)));
    const rolesByWarehouse = keepers.reduce((acc, k) => {
      acc[k.warehouse.name] = k.role;
      return acc;
    }, {} as Record<string, WmsRole>);

    return { warehouses, isGlobalAdmin: false, rolesByWarehouse };
  } catch (err) {
    console.error("getUserWarehouseAccess failed:", err);
    return { warehouses: [], isGlobalAdmin: false, rolesByWarehouse: {} };
  }
}
