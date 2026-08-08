import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { WmsMovementType } from "@prisma/client";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  const type = searchParams.get("type");

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: any = {};

    if (itemId) where.itemId = itemId;
    if (type) where.type = type as WmsMovementType;

    // Ограничение движений по складам МОЛ
    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return NextResponse.json({ movements: [], total: 0 });
      }
      where.item = {
        warehouse: { in: responsibleWarehouses }
      };
    }

    const movements = await prisma.wmsMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ movements, total: movements.length });
  } catch (err) {
    console.error("WMS Movements query failed:", err);
    return NextResponse.json({ movements: [], total: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const body = await request.json();

    // Support batch items atomic array processing
    const itemsList: Array<{
      itemId: string;
      type: WmsMovementType;
      quantity: number;
      fromLocation?: string;
      toLocation?: string;
      performedBy?: string;
      reason?: string;
      relatedOrderOrEq?: string;
    }> = Array.isArray(body.items) ? body.items : [body];

    if (itemsList.length === 0) {
      return NextResponse.json({ error: "Список позиций для проведения пуст" }, { status: 400 });
    }

    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const txOps: any[] = [];
    const createdMovementsCount = itemsList.length;
    const sessionUser = session.displayName || session.username;

    for (const entry of itemsList) {
      const { itemId, type, quantity, fromLocation, toLocation, performedBy, reason, relatedOrderOrEq } = entry;
      if (!itemId || !type || !quantity || quantity <= 0) {
        return NextResponse.json({ error: "Заполните позицию ТМЦ, тип и количество" }, { status: 400 });
      }

      const item = await prisma.wmsItem.findUnique({ where: { id: itemId } });
      if (!item) {
        return NextResponse.json({ error: `Позиция ID ${itemId} не найдена` }, { status: 404 });
      }

      if (responsibleWarehouses !== null && !responsibleWarehouses.includes(item.warehouse)) {
        return NextResponse.json(
          { error: `Отказано в доступе. Вы не являетесь МОЛ за склад "${item.warehouse}"` },
          { status: 403 }
        );
      }

      let newQuantity = item.quantity;
      if (type === "INCOMING") {
        newQuantity += Number(quantity);
      } else if (type === "OUTGOING" || type === "PERSONAL_CARD" || type === "TRANSFER") {
        if (item.quantity < quantity) {
          return NextResponse.json(
            { error: `Недостаточно остатка по "${item.name}". Доступно: ${item.quantity} ${item.unit}` },
            { status: 400 }
          );
        }
        newQuantity -= Number(quantity);
      } else if (type === "ADJUSTMENT") {
        newQuantity = Number(quantity);
      }

      const newStatus = newQuantity <= 0 ? "OUT_OF_STOCK" : newQuantity <= item.minQuantity ? "LOW_STOCK" : "IN_STOCK";

      txOps.push(
        prisma.wmsMovement.create({
          data: {
            itemId: item.id,
            itemSku: item.sku,
            itemName: item.name,
            type: type as WmsMovementType,
            quantity: Number(quantity),
            fromLocation: fromLocation || item.cell,
            toLocation: toLocation || null,
            performedBy: sessionUser,
            reason: reason || null,
            relatedOrderOrEq: relatedOrderOrEq || null,
          }
        })
      );

      txOps.push(
        prisma.wmsItem.update({
          where: { id: item.id },
          data: {
            quantity: newQuantity,
            status: newStatus
          }
        })
      );

      // If related to equipment scrap write-off, also record WmsWriteOff entry
      if (type === "OUTGOING" && relatedOrderOrEq) {
        txOps.push(
          prisma.wmsWriteOff.create({
            data: {
              itemId: item.id,
              itemSku: item.sku,
              itemName: item.name,
              equipmentId: relatedOrderOrEq,
              quantity: Number(quantity),
              reason: "EQUIPMENT_REPAIR",
              comments: reason || "Списание на ремонт/обслуживание оборудования",
              performedBy: sessionUser
            }
          })
        );
      }
    }

    await prisma.$transaction(txOps);

    return NextResponse.json({ success: true, count: createdMovementsCount }, { status: 201 });
  } catch (err) {
    console.error("WMS Movements POST failed:", err);
    return NextResponse.json({ error: "Ошибка при групповом проведении складской операции" }, { status: 500 });
  }
}
