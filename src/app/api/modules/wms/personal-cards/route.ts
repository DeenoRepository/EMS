import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employee = searchParams.get("employee");

  try {
    const where: any = {};
    if (employee) {
      where.employeeName = { contains: employee, mode: "insensitive" };
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
    const { itemId, employeeName, employeePosition, department, quantity, notes } = body;

    if (!itemId || !employeeName || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: "Поля Позиция ТМЦ, ФИО сотрудника и Количество обязательны" },
        { status: 400 }
      );
    }

    const item = await prisma.wmsItem.findUnique({ where: { id: itemId } });
    if (!item) {
      return NextResponse.json({ error: "Позиция ТМЦ не найдена" }, { status: 404 });
    }

    if (item.quantity < quantity) {
      return NextResponse.json(
        { error: `Недостаточно остатка на складе. Доступно: ${item.quantity} ${item.unit}` },
        { status: 400 }
      );
    }

    // Списание со склада и внесение в личную карточку сотрудника
    const [card] = await prisma.$transaction([
      prisma.wmsPersonalCard.create({
        data: {
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          employeeName,
          employeePosition: employeePosition || null,
          department: department || null,
          issuedQuantity: Number(quantity),
          notes: notes || null,
          createdById: session.id,
        }
      }),
      prisma.wmsItem.update({
        where: { id: item.id },
        data: { quantity: item.quantity - Number(quantity) }
      }),
      prisma.wmsMovement.create({
        data: {
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          type: "PERSONAL_CARD",
          quantity: Number(quantity),
          fromLocation: item.cell,
          toLocation: `Личная карточка: ${employeeName}`,
          performedBy: session.displayName || session.username,
          reason: `Выдача СИЗ/Инструмента сотруднику ${employeeName}`,
        }
      })
    ]);

    return NextResponse.json({ card, success: true }, { status: 201 });
  } catch (err) {
    console.error("WMS Personal card POST failed:", err);
    return NextResponse.json({ error: "Ошибка при выдаче ТМЦ в личную карточку" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const body = await request.json();
    const { cardId, returnCondition } = body;

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

    // Если состояние GOOD (исправно) — оприходовать обратно на склад, иначе списать
    const isGood = returnCondition === "GOOD";

    const [updatedCard] = await prisma.$transaction([
      prisma.wmsPersonalCard.update({
        where: { id: cardId },
        data: {
          returnedAt: new Date(),
          returnCondition
        }
      }),
      ...(isGood
        ? [
            prisma.wmsItem.update({
              where: { id: card.itemId },
              data: { quantity: card.item.quantity + card.issuedQuantity }
            })
          ]
        : []),
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
    ]);

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
