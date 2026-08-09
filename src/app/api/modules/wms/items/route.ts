import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { WmsItemType } from "@prisma/client";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { getSession } from "@/lib/auth/session";
import { createWmsItemSchema } from "@/lib/validations/wms";

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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const rawBody = await request.json();
    const parseResult = createWmsItemSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Некорректные параметры запроса ТМЦ (SEC-03)",
          details: parseResult.error.flatten()
        },
        { status: 400 }
      );
    }

    const body = parseResult.data;

    // Права на склад
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null && !responsibleWarehouses.includes(body.warehouse)) {
      return NextResponse.json(
        { error: `Отказано в доступе. Вы являетесь ответственным только за склады: ${responsibleWarehouses.join(", ")}` },
        { status: 403 }
      );
    }

    const incomingQty = body.quantity || 1;

    // 1. Поиск существующей номенклатурной единицы по артикулу (SKU) на выбранном складе
    const existingNomenclature = await prisma.wmsItem.findFirst({
      where: {
        sku: body.sku,
        warehouse: body.warehouse
      }
    });

    const sessionUser = session.displayName || session.username;

    if (existingNomenclature) {
      // 2. Номенклатурная единица уже присутствует -> Обновление остатков и подгруженных параметров
      const updatedQty = existingNomenclature.quantity + incomingQty;
      const updatedStatus = updatedQty <= 0 ? "OUT_OF_STOCK" : updatedQty <= existingNomenclature.minQuantity ? "LOW_STOCK" : "IN_STOCK";

      const [updatedItem] = await prisma.$transaction([
        prisma.wmsItem.update({
          where: { id: existingNomenclature.id },
          data: {
            quantity: updatedQty,
            unitPrice: body.unitPrice ?? existingNomenclature.unitPrice,
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
            performedBy: sessionUser,
            reason: `Приход номенклатурной единицы (${incomingQty} ${existingNomenclature.unit})`,
          }
        })
      ]);

      return NextResponse.json({ item: updatedItem, isExisting: true, success: true }, { status: 200 });
    }

    // 3. Номенклатурной единицы нет -> Создание новой в общесистемном каталоге
    const newItem = await prisma.wmsItem.create({
      data: {
        sku: body.sku,
        name: body.name,
        category: body.category,
        type: body.type,
        unit: body.unit,
        warehouse: body.warehouse,
        cell: body.cell || "Яч-01",
        batchNumber: body.batchNumber || null,
        serialNumber: body.serialNumber || null,
        quantity: incomingQty,
        minQuantity: body.minQuantity,
        maxQuantity: body.maxQuantity,
        unitPrice: body.unitPrice,
        currency: body.currency,
        status: incomingQty <= body.minQuantity ? "LOW_STOCK" : "IN_STOCK",
        supplier: body.supplier || "Поставщик",
        description: body.description || null,
      }
    });

    await prisma.wmsMovement.create({
      data: {
        itemId: newItem.id,
        itemSku: newItem.sku,
        itemName: newItem.name,
        type: "INCOMING",
        quantity: incomingQty,
        fromLocation: "Поставщик / Новая номенклатура",
        toLocation: body.cell || "Яч-01",
        performedBy: sessionUser,
        reason: `Первичный приход новой номенклатурной единицы (${incomingQty} ${body.unit})`,
      }
    });

    return NextResponse.json({ item: newItem, isExisting: false, success: true }, { status: 201 });
  } catch (err: any) {
    console.error("Failed to process WMS item receiving:", err);
    return NextResponse.json(
      { error: "Не удалось провести приход номенклатурной единицы" },
      { status: 500 }
    );
  }
}
