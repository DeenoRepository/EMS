import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { WmsItemType } from "@prisma/client";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const warehouse = searchParams.get("warehouse");
  const category = searchParams.get("category");
  const status = searchParams.get("status");

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: any = {};

    // Ограничение видимости по складам МОЛ
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
        { batchNumber: { contains: query, mode: "insensitive" } },
        { serialNumber: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
        { cell: { contains: query, mode: "insensitive" } }
      ];
    }
    if (warehouse) {
      if (responsibleWarehouses !== null) {
        if (responsibleWarehouses.includes(warehouse)) {
          where.warehouse = warehouse;
        } else {
          return NextResponse.json({ items: [], total: 0 });
        }
      } else {
        where.warehouse = warehouse;
      }
    }
    if (category) where.category = category;
    if (status) where.status = status;

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
        { error: "Поля Наименование, Артикул (SKU) и Склад обязательны" },
        { status: 400 }
      );
    }

    // Права на склад
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null && !responsibleWarehouses.includes(body.warehouse)) {
      return NextResponse.json(
        { error: `Отказано в доступе. Вы являетесь ответственным только за склады: ${responsibleWarehouses.join(", ")}` },
        { status: 403 }
      );
    }

    const incomingQty = Number(body.quantity) || 1;

    // 1. Поиск существующей номенклатурной единицы по артикулу (SKU) на выбранном складе
    const existingNomenclature = await prisma.wmsItem.findFirst({
      where: {
        sku: body.sku,
        warehouse: body.warehouse
      }
    });

    if (existingNomenclature) {
      // 2. Номенклатурная единица уже присутствует -> Обновление остатков и подгруженных параметров
      const updatedQty = existingNomenclature.quantity + incomingQty;
      const updatedStatus = updatedQty <= 0 ? "OUT_OF_STOCK" : updatedQty <= existingNomenclature.minQuantity ? "LOW_STOCK" : "IN_STOCK";

      const [updatedItem] = await prisma.$transaction([
        prisma.wmsItem.update({
          where: { id: existingNomenclature.id },
          data: {
            quantity: updatedQty,
            unitPrice: body.unitPrice ? Number(body.unitPrice) : existingNomenclature.unitPrice,
            cell: body.cell || existingNomenclature.cell,
            status: updatedStatus,
            updatedAt: new Date()
          }
        }),
        prisma.wmsMovement.create({
          data: {
            itemId: existingNomenclature.id,
            itemSku: existingNomenclature.sku,
            itemName: existingNomenclature.name,
            type: "INCOMING",
            quantity: incomingQty,
            fromLocation: "Поставщик / Приход",
            toLocation: body.cell || existingNomenclature.cell || "Склад",
            performedBy: "Кладовщик",
            reason: `Приход номенклатурной единицы (${incomingQty} ${existingNomenclature.unit})`,
          }
        })
      ]);

      return NextResponse.json({ item: updatedItem, isExisting: true, success: true }, { status: 200 });
    }

    // 3. Номенклатурной единицы нет -> Создание новой в общесистемном каталоге
    const [createdItem] = await prisma.$transaction([
      prisma.wmsItem.create({
        data: {
          sku: body.sku,
          name: body.name,
          category: body.category || "Запчасти & Механика",
          type: (body.type as WmsItemType) || "ZIP",
          unit: body.unit || "шт",
          warehouse: body.warehouse,
          cell: body.cell || "Яч-01",
          batchNumber: body.batchNumber || null,
          serialNumber: body.serialNumber || null,
          quantity: incomingQty,
          minQuantity: Number(body.minQuantity) || 2,
          maxQuantity: Number(body.maxQuantity) || 100,
          unitPrice: Number(body.unitPrice) || 1500,
          currency: body.currency || "RUB",
          status: incomingQty <= (Number(body.minQuantity) || 2) ? "LOW_STOCK" : "IN_STOCK",
          supplier: body.supplier || "Поставщик",
          description: body.description || null,
        }
      }),
      prisma.wmsMovement.create({
        data: {
          itemId: body.sku,
          itemSku: body.sku,
          itemName: body.name,
          type: "INCOMING",
          quantity: incomingQty,
          fromLocation: "Поставщик / Новая номенклатура",
          toLocation: body.cell || "Яч-01",
          performedBy: "Кладовщик",
          reason: `Первичный приход новой номенклатурной единицы (${incomingQty} ${body.unit || "шт"})`,
        }
      })
    ]);

    return NextResponse.json({ item: createdItem, isExisting: false, success: true }, { status: 201 });
  } catch (err: any) {
    console.error("Failed to process WMS item receiving:", err);
    return NextResponse.json(
      { error: "Не удалось провести приход номенклатурной единицы" },
      { status: 500 }
    );
  }
}
