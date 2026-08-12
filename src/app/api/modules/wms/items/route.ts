import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { getSession } from "@/lib/auth/session";
import { createWmsItemSchema } from "@/lib/validations/wms";
import { recordWmsOutboxEvent } from "@/lib/wms/outbox-processor";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const warehouse = searchParams.get("warehouse");
  const warehouseId = searchParams.get("warehouseId");
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
      where.OR = [
        { warehouse: { in: responsibleWarehouses } },
        { warehouseId: { in: responsibleWarehouses } }
      ];
    }

    if (query) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } },
            { batchNumber: { contains: query, mode: "insensitive" } },
            { serialNumber: { contains: query, mode: "insensitive" } },
            { category: { contains: query, mode: "insensitive" } },
            { cell: { contains: query, mode: "insensitive" } }
          ]
        }
      ];
    }
    if (warehouseId) {
      where.warehouseId = warehouseId;
    } else if (warehouse) {
      if (responsibleWarehouses !== null && !responsibleWarehouses.includes(warehouse)) {
        return NextResponse.json({ items: [], total: 0 });
      }
      where.warehouse = warehouse;
    }
    if (category) where.category = category;
    if (status) where.status = status;

    const items = await prisma.wmsItem.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        warehouseRef: { select: { id: true, name: true, code: true } },
        zoneRef: { select: { id: true, name: true, code: true } },
        cellRef: { select: { id: true, code: true } },
        equipment: { select: { id: true, name: true, equipmentCode: true } }
      }
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
    const sessionUser = session.displayName || session.username;

    // Поиск объекта склада для получения warehouseId
    const targetWarehouseObj = await prisma.warehouse.findFirst({
      where: {
        OR: [
          { name: body.warehouse },
          { id: rawBody.warehouseId || "" }
        ]
      }
    });

    const targetWarehouseId = targetWarehouseObj?.id || rawBody.warehouseId || null;

    // 1. Поиск существующей номенклатурной единицы по артикулу (SKU) на выбранном складе
    const existingNomenclature = await prisma.wmsItem.findFirst({
      where: {
        sku: body.sku,
        OR: [
          { warehouse: body.warehouse },
          ...(targetWarehouseId ? [{ warehouseId: targetWarehouseId }] : [])
        ]
      }
    });

    if (existingNomenclature) {
      const updatedQty = existingNomenclature.quantity + incomingQty;
      const updatedStatus = updatedQty <= 0 ? "OUT_OF_STOCK" : updatedQty <= existingNomenclature.minQuantity ? "LOW_STOCK" : "IN_STOCK";

      const updatedItem = await prisma.$transaction(async (tx) => {
        const item = await tx.wmsItem.update({
          where: { id: existingNomenclature.id },
          data: {
            quantity: updatedQty,
            unitPrice: body.unitPrice ?? existingNomenclature.unitPrice,
            cell: body.cell || existingNomenclature.cell,
            warehouseId: targetWarehouseId || existingNomenclature.warehouseId,
            equipmentId: rawBody.equipmentId || existingNomenclature.equipmentId,
            status: updatedStatus,
            updatedAt: new Date()
          }
        });

        const movement = await tx.wmsMovement.create({
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
        });

        await recordWmsOutboxEvent(tx, {
          eventName: "wms.stock.received",
          aggregateType: "WmsItem",
          aggregateId: item.id,
          payload: {
            itemId: item.id,
            sku: item.sku,
            quantity: incomingQty,
            totalQuantity: updatedQty,
            movementId: movement.id,
            performedBy: sessionUser,
          }
        });

        return item;
      });

      return NextResponse.json({ item: updatedItem, isExisting: true, success: true }, { status: 200 });
    }

    // 2. Создание новой номенклатурной единицы в каталоге
    const newItem = await prisma.$transaction(async (tx) => {
      const item = await tx.wmsItem.create({
        data: {
          sku: body.sku,
          name: body.name,
          category: body.category,
          type: body.type,
          unit: body.unit,
          warehouse: body.warehouse,
          cell: body.cell || "Яч-01",
          warehouseId: targetWarehouseId,
          equipmentId: rawBody.equipmentId || null,
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

      const movement = await tx.wmsMovement.create({
        data: {
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          type: "INCOMING",
          quantity: incomingQty,
          fromLocation: "Поставщик / Новая номенклатура",
          toLocation: body.cell || "Яч-01",
          performedBy: sessionUser,
          reason: `Первичный приход новой номенклатурной единицы (${incomingQty} ${body.unit})`,
        }
      });

      await recordWmsOutboxEvent(tx, {
        eventName: "wms.item.created",
        aggregateType: "WmsItem",
        aggregateId: item.id,
        payload: {
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          warehouse: item.warehouse,
          warehouseId: targetWarehouseId,
          quantity: incomingQty,
          movementId: movement.id,
          performedBy: sessionUser,
        }
      });

      return item;
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
