import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { WmsItemStatus, WmsItemType } from "@prisma/client";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const warehouse = searchParams.get("warehouse");
  const category = searchParams.get("category");
  const status = searchParams.get("status");

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: any = {};

    // Ограничение видимости для МОЛ
    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return NextResponse.json({ items: [], total: 0 });
      }
      where.warehouse = { in: responsibleWarehouses };
    }

    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
        { cell: { contains: query, mode: "insensitive" } },
        { zone: { contains: query, mode: "insensitive" } },
        { batchNumber: { contains: query, mode: "insensitive" } },
        { serialNumber: { contains: query, mode: "insensitive" } },
        { barcode: { contains: query, mode: "insensitive" } },
      ];
    }

    if (warehouse) {
      // Проверка, что запрашиваемый склад входит в разрешенные МОЛ
      if (responsibleWarehouses !== null && !responsibleWarehouses.includes(warehouse)) {
        return NextResponse.json({ items: [], total: 0 });
      }
      where.warehouse = warehouse;
    }

    if (category) where.category = category;
    if (status) where.status = status as WmsItemStatus;

    const items = await prisma.wmsItem.findMany({
      where,
      orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    console.error("WMS Items query failed:", err);
    return NextResponse.json({ items: [], total: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name || !body.sku || !body.warehouse) {
      return NextResponse.json(
        { error: "Поля Наименование, Артикул и Склад обязательны" },
        { status: 400 }
      );
    }

    // Ограничение прав на создание ТМЦ только в своем складе
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null && !responsibleWarehouses.includes(body.warehouse)) {
      return NextResponse.json(
        { error: `Отказано в доступе. Вы являетесь ответственным только за склады: ${responsibleWarehouses.join(", ")}` },
        { status: 403 }
      );
    }

    const created = await prisma.wmsItem.create({
      data: {
        sku: body.sku,
        name: body.name,
        category: body.category || "Общее",
        type: (body.type as WmsItemType) || "ZIP",
        unit: body.unit || "pcs",
        warehouse: body.warehouse,
        zone: body.zone || null,
        cell: body.cell || "Обустройство",
        batchNumber: body.batchNumber || null,
        serialNumber: body.serialNumber || null,
        isEps: Boolean(body.isEps),
        equipmentId: body.equipmentId || null,
        quantity: Number(body.quantity) || 0,
        minQuantity: Number(body.minQuantity) || 0,
        maxQuantity: Number(body.maxQuantity) || 100,
        unitPrice: Number(body.unitPrice) || 0,
        currency: body.currency || "RUB",
        status: body.quantity <= (Number(body.minQuantity) || 0) ? "LOW_STOCK" : "IN_STOCK",
        supplier: body.supplier || null,
        description: body.description || null,
        barcode: body.barcode || null,
      }
    });

    return NextResponse.json({ item: created, success: true }, { status: 201 });
  } catch (err: any) {
    console.error("Failed to create WMS item:", err);
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "Позиция с таким артикулом (SKU) уже существует" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Не удалось добавить позицию в каталог" },
      { status: 500 }
    );
  }
}
