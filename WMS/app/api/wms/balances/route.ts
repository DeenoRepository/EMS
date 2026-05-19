import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parsePagination } from "@/lib/pagination";
import { requireAnyRole } from "@/lib/auth/rbac";
import { resolveWmsScope } from "@/lib/wms/access-scope";

export async function GET(req: NextRequest) {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId") || "";
  const warehouseId = searchParams.get("warehouseId") || "";
  const lowStock = searchParams.get("lowStock") === "true";
  const factualOnly = searchParams.get("factualOnly") !== "false";
  const pagination = parsePagination(searchParams, { pageSize: 50, maxPageSize: 500 });

  const primaryWarehouse = await prisma.warehouse.findFirst({ where: { status: "ACTIVE", type: "PRIMARY" } });
  if (!primaryWarehouse) {
    return NextResponse.json({ items: [], total: 0, page: pagination.page, pageSize: pagination.pageSize });
  }

  const allowedWarehouseIds =
    scope.access === "ADMIN"
      ? undefined
      : scope.access === "CENTRAL"
        ? undefined
        : scope.access === "AUXILIARY"
          ? [primaryWarehouse.id, ...scope.responsibleWarehouseIds]
          : [primaryWarehouse.id];

  const effectiveWarehouseIds = warehouseId
    ? (allowedWarehouseIds ? allowedWarehouseIds.filter((id) => id === warehouseId) : [warehouseId])
    : allowedWarehouseIds;

  const where = {
    ...(itemId ? { itemId } : {}),
    ...(effectiveWarehouseIds ? { warehouseId: { in: effectiveWarehouseIds } } : {})
  };

  const rows = await prisma.stockBalance.findMany({
    where,
    include: {
      item: true,
      warehouse: true
    }
  });

  const mapped = rows.map((row) => {
    const available = row.quantity.minus(row.reservedQuantity);
    return {
      id: row.id,
      itemId: row.itemId,
      warehouseId: row.warehouseId,
      quantity: Number(row.quantity.toString()),
      reservedQuantity: Number(row.reservedQuantity.toString()),
      availableQuantity: Number(available.toString()),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      item: row.item,
      warehouse: row.warehouse,
      isLowStock: row.item.minQuantity !== null ? available.lessThan(row.item.minQuantity) : false
    };
  });

  let enriched = [...mapped];
  const isAuxiliaryWarehouseSelected = !!warehouseId && warehouseId !== primaryWarehouse.id;
  if (!isAuxiliaryWarehouseSelected) {
    const itemsWithMin = await prisma.stockItem.findMany({
      where: { status: "ACTIVE", minQuantity: { not: null }, ...(itemId ? { id: itemId } : {}) }
    });

    const existingKeys = new Set(mapped.map((row) => `${row.itemId}:${row.warehouseId}`));
    for (const item of itemsWithMin) {
      const key = `${item.id}:${primaryWarehouse.id}`;
      if (existingKeys.has(key)) continue;
      const min = item.minQuantity ? Number(item.minQuantity.toString()) : null;
      if (min === null || min <= 0) continue;
      enriched.push({
        id: `synthetic:${key}`,
        itemId: item.id,
        warehouseId: primaryWarehouse.id,
        quantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        item,
        warehouse: primaryWarehouse,
        isLowStock: true
      });
    }
  }

  const grouped = new Map<string, any>();
  const singleWarehouseView = !!effectiveWarehouseIds && effectiveWarehouseIds.length === 1;
  for (const row of enriched) {
    const key = row.itemId;
    const prev = grouped.get(key);
    if (!prev) {
      grouped.set(key, {
        id: key,
        itemId: row.itemId,
        quantity: row.quantity,
        reservedQuantity: row.reservedQuantity,
        availableQuantity: row.availableQuantity,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        item: row.item,
        warehouse: { name: singleWarehouseView ? (row.warehouse?.name || "Склад") : "Все склады" },
        minQuantity: row.item?.minQuantity !== null && row.item?.minQuantity !== undefined ? Number(row.item.minQuantity.toString()) : null
      });
      continue;
    }
    prev.quantity += row.quantity;
    prev.reservedQuantity += row.reservedQuantity;
    prev.availableQuantity += row.availableQuantity;
    if (row.updatedAt > prev.updatedAt) prev.updatedAt = row.updatedAt;
  }

  const aggregated = Array.from(grouped.values()).map((row) => ({
    ...row,
    isLowStock: row.minQuantity !== null ? row.availableQuantity < row.minQuantity : false
  }));

  const filtered = aggregated.filter((row) => {
    if (isAuxiliaryWarehouseSelected && row.quantity <= 0) {
      return false;
    }
    if (!lowStock && factualOnly && row.quantity === 0 && row.reservedQuantity === 0 && row.availableQuantity === 0 && !row.isLowStock) {
      return false;
    }
    if (lowStock && !row.isLowStock) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (a.isLowStock !== b.isLowStock) return a.isLowStock ? -1 : 1;
    return String(a.item?.sku || "").localeCompare(String(b.item?.sku || ""), "ru");
  });

  const total = filtered.length;
  const items = filtered.slice(pagination.skip, pagination.skip + pagination.pageSize);

  return NextResponse.json({ items, total, page: pagination.page, pageSize: pagination.pageSize });
}
