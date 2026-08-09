import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { WmsMovementType } from "@prisma/client";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

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
    const createdMovementsCount = itemsList.length;
    const sessionUser = session.displayName || session.username;

    await prisma.$transaction(async (tx) => {
      for (const entry of itemsList) {
        const { itemId, type, quantity, fromLocation, toLocation, reason, relatedOrderOrEq } = entry;
        const numQty = Number(quantity);
        if (!itemId || !type || !numQty || numQty <= 0) {
          throw new Error("INVALID_PARAMS");
        }

        const item = await tx.wmsItem.findUnique({ where: { id: itemId } });
        if (!item) {
          throw new Error(`NOT_FOUND:${itemId}`);
        }

        if (responsibleWarehouses !== null && !responsibleWarehouses.includes(item.warehouse)) {
          throw new Error(`FORBIDDEN:${item.warehouse}`);
        }

        let newQuantity = item.quantity;
        if (type === "INCOMING") {
          newQuantity += numQty;
        } else if (type === "OUTGOING" || type === "PERSONAL_CARD" || type === "TRANSFER") {
          if (item.quantity < numQty) {
            throw new Error(`INSUFFICIENT_STOCK:${item.name}:${item.quantity}:${item.unit}`);
          }
          newQuantity -= numQty;
        } else if (type === "ADJUSTMENT") {
          newQuantity = numQty;
        }

        const newStatus = newQuantity <= 0 ? "OUT_OF_STOCK" : newQuantity <= item.minQuantity ? "LOW_STOCK" : "IN_STOCK";

        let newReservedQuantity = item.reservedQuantity;
        if (type === "OUTGOING" && item.reservedQuantity > 0) {
          newReservedQuantity = Math.max(0, item.reservedQuantity - numQty);
        }

        // SEC-16 & SEC-04: Atomic conditional update to prevent lost updates or negative stock
        if (type === "OUTGOING" || type === "PERSONAL_CARD" || type === "TRANSFER") {
          const updateRes = await tx.wmsItem.updateMany({
            where: {
              id: item.id,
              quantity: { gte: numQty }
            },
            data: {
              quantity: { decrement: numQty },
              reservedQuantity: newReservedQuantity,
              status: newStatus,
              lastOutgoingDate: new Date()
            }
          });

          if (updateRes.count === 0) {
            throw new Error(`INSUFFICIENT_STOCK:${item.name}:${item.quantity}:${item.unit}`);
          }
        } else if (type === "INCOMING") {
          await tx.wmsItem.update({
            where: { id: item.id },
            data: {
              quantity: { increment: numQty },
              status: newStatus,
              lastIncomingDate: new Date()
            }
          });
        } else {
          await tx.wmsItem.update({
            where: { id: item.id },
            data: {
              quantity: newQuantity,
              reservedQuantity: newReservedQuantity,
              status: newStatus
            }
          });
        }

        await tx.wmsMovement.create({
          data: {
            itemId: item.id,
            itemSku: item.sku,
            itemName: item.name,
            type: type as WmsMovementType,
            quantity: numQty,
            fromLocation: fromLocation || item.cell,
            toLocation: toLocation || null,
            performedBy: sessionUser,
            reason: reason || null,
            relatedOrderOrEq: relatedOrderOrEq || null,
          }
        });

        if (type === "OUTGOING" && relatedOrderOrEq) {
          await tx.wmsWriteOff.create({
            data: {
              itemId: item.id,
              itemSku: item.sku,
              itemName: item.name,
              equipmentId: relatedOrderOrEq,
              quantity: numQty,
              reason: "EQUIPMENT_REPAIR",
              comments: reason || "Списание на ремонт/обслуживание оборудования",
              performedBy: sessionUser
            }
          });
        }
      }
    });

    return NextResponse.json({ success: true, count: createdMovementsCount }, { status: 201 });
  } catch (err: any) {
    if (err.message === "INVALID_PARAMS") {
      return NextResponse.json({ error: "Заполните позицию ТМЦ, тип и количество" }, { status: 400 });
    }
    if (err.message?.startsWith("NOT_FOUND")) {
      const [, id] = err.message.split(":");
      return NextResponse.json({ error: `Позиция ID ${id} не найдена` }, { status: 404 });
    }
    if (err.message?.startsWith("FORBIDDEN")) {
      const [, wh] = err.message.split(":");
      return NextResponse.json({ error: `Отказано в доступе. Вы не являетесь МОЛ за склад "${wh}"` }, { status: 403 });
    }
    if (err.message?.startsWith("INSUFFICIENT_STOCK")) {
      const [, name, qty, unit] = err.message.split(":");
      return NextResponse.json(
        { error: `Недостаточно остатка по "${name}". Доступно: ${qty} ${unit}` },
        { status: 400 }
      );
    }
    console.error("WMS Movements POST failed:", err);
    return NextResponse.json({ error: "Ошибка при групповом проведении складской операции" }, { status: 500 });
  }
}
