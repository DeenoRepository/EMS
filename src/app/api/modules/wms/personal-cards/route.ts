import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const employee = searchParams.get("employee");

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: any = {};
    if (employee) {
      where.OR = [
        { employeeName: { contains: employee, mode: "insensitive" } },
        { employeeNumber: { contains: employee, mode: "insensitive" } },
        { employeePosition: { contains: employee, mode: "insensitive" } },
        { department: { contains: employee, mode: "insensitive" } },
      ];
    }

    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return NextResponse.json({ cards: [], total: 0 });
      }
      where.item = {
        warehouse: { in: responsibleWarehouses }
      };
    }

    const cards = await prisma.wmsPersonalCard.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      include: { item: true }
    });

    return NextResponse.json({ cards, total: cards.length });
  } catch (err) {
    console.error("WMS Personal cards GET failed:", err);
    return NextResponse.json({ cards: [], total: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const body = await request.json();
    const { itemId, employeeName, employeePosition, employeeNumber, department, quantity, notes } = body;

    const parsedQty = Number(quantity);
    if (!itemId || !employeeName || isNaN(parsedQty) || !Number.isInteger(parsedQty) || parsedQty <= 0) {
      return NextResponse.json(
        { error: "Поля Позиция ТМЦ и ФИО обязательны, а количество должно быть целым положительным числом" },
        { status: 400 }
      );
    }

    const responsibleWarehouses = await getUserResponsibleWarehouses();

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.wmsItem.findUnique({ where: { id: itemId } });
      if (!item) {
        throw new Error("NOT_FOUND");
      }

      if (responsibleWarehouses !== null && !responsibleWarehouses.includes(item.warehouse)) {
        throw new Error("FORBIDDEN");
      }

      if (item.quantity < parsedQty) {
        throw new Error(`INSUFFICIENT_STOCK:${item.quantity}:${item.unit}`);
      }

      const card = await tx.wmsPersonalCard.create({
        data: {
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          employeeName,
          employeePosition: employeePosition || null,
          employeeNumber: employeeNumber || null,
          department: department || null,
          issuedQuantity: parsedQty,
          notes: notes || null,
          createdById: session.id,
        }
      });

      const updatedQty = item.quantity - parsedQty;
      const newStatus = updatedQty <= 0 ? "OUT_OF_STOCK" : updatedQty <= item.minQuantity ? "LOW_STOCK" : "IN_STOCK";

      await tx.wmsItem.update({
        where: { id: item.id },
        data: {
          quantity: updatedQty,
          status: newStatus,
        }
      });

      await tx.wmsMovement.create({
        data: {
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          type: "PERSONAL_CARD",
          quantity: parsedQty,
          fromLocation: item.cell,
          toLocation: `Личная карточка: ${employeeName} (Таб. №${employeeNumber || "Б/Н"})`,
          performedBy: session.displayName || session.username,
          reason: `Выдача СИЗ/Инструмента сотруднику ${employeeName}`,
        }
      });

      return card;
    });

    return NextResponse.json({ card: result, success: true }, { status: 201 });
  } catch (err: any) {
    if (err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Позиция ТМЦ не найдена" }, { status: 404 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Отказано в доступе. Вы не являетесь МОЛ данного склада" }, { status: 403 });
    }
    if (err.message?.startsWith("INSUFFICIENT_STOCK")) {
      const [, avail, unit] = err.message.split(":");
      return NextResponse.json(
        { error: `Недостаточно остатка на складе. Доступно: ${avail} ${unit}` },
        { status: 400 }
      );
    }
    console.error("WMS Personal card POST failed:", err);
    return NextResponse.json({ error: "Ошибка при выдаче ТМЦ в личную карточку" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return handleReturn(request);
}

export async function PATCH(request: Request) {
  return handleReturn(request);
}

async function handleReturn(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const body = await request.json();
    const cardId = body.cardId || body.id;
    const { returnCondition } = body;

    if (!cardId || !returnCondition) {
      return NextResponse.json(
        { error: "Укажите ID карточки и техническое состояние при возврате" },
        { status: 400 }
      );
    }

    const card = await prisma.wmsPersonalCard.findUnique({
      where: { id: cardId },
      include: { item: true }
    });

    if (!card) {
      return NextResponse.json({ error: "Запись в личной карточке не найдена" }, { status: 404 });
    }

    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null && !responsibleWarehouses.includes(card.item.warehouse)) {
      return NextResponse.json(
        { error: `Отказано в доступе. Вы не являетесь МОЛ склада "${card.item.warehouse}"` },
        { status: 403 }
      );
    }

    // Если состояние GOOD (исправно) — оприходовать обратно на склад, иначе записать списание
    const isGood = returnCondition === "GOOD";
    const writeOffReason = returnCondition === "REPAIR" ? "EQUIPMENT_REPAIR" : "DAMAGE";

    const txOps: any[] = [
      prisma.wmsPersonalCard.update({
        where: { id: cardId },
        data: {
          returnedAt: new Date(),
          returnCondition
        }
      })
    ];

    if (isGood) {
      txOps.push(
        prisma.wmsItem.update({
          where: { id: card.itemId },
          data: {
            quantity: card.item.quantity + card.issuedQuantity,
            status: (card.item.quantity + card.issuedQuantity) <= card.item.minQuantity ? "LOW_STOCK" : "IN_STOCK"
          }
        }),
        prisma.wmsMovement.create({
          data: {
            itemId: card.itemId,
            itemSku: card.itemSku,
            itemName: card.itemName,
            type: "INCOMING",
            quantity: card.issuedQuantity,
            fromLocation: `Личная карточка: ${card.employeeName}`,
            toLocation: card.item.cell,
            performedBy: session.displayName || session.username,
            reason: `Возврат из личной карточки (${employeeConditionLabel(returnCondition)})`,
          }
        })
      );
    } else {
      txOps.push(
        prisma.wmsWriteOff.create({
          data: {
            itemId: card.itemId,
            itemSku: card.itemSku,
            itemName: card.itemName,
            quantity: card.issuedQuantity,
            reason: writeOffReason,
            performedBy: session.displayName || session.username,
            comments: `Возврат из личной карточки ${card.employeeName} в непригодном состоянии (${employeeConditionLabel(returnCondition)})`
          }
        }),
        prisma.wmsMovement.create({
          data: {
            itemId: card.itemId,
            itemSku: card.itemSku,
            itemName: card.itemName,
            type: "OUTGOING",
            quantity: card.issuedQuantity,
            fromLocation: `Личная карточка: ${card.employeeName}`,
            toLocation: "Утиль / Ремонт",
            performedBy: session.displayName || session.username,
            reason: `Списание при возврате из личной карточки (${employeeConditionLabel(returnCondition)})`,
          }
        })
      );
    }

    const [updatedCard] = await prisma.$transaction(txOps);

    return NextResponse.json({ card: updatedCard, success: true });
  } catch (err) {
    console.error("WMS Personal card return failed:", err);
    return NextResponse.json({ error: "Ошибка при оформлении возврата" }, { status: 500 });
  }
}

function employeeConditionLabel(cond: string) {
  if (cond === "GOOD") return "Исправно / Возвращено на склад";
  if (cond === "REPAIR") return "Требует ремонта";
  return "Списано в утиль";
}
