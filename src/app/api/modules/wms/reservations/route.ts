import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  const equipmentId = searchParams.get("equipmentId");

  try {
    const where: any = { isActive: true };
    if (itemId) where.itemId = itemId;
    if (equipmentId) where.equipmentId = equipmentId;

    const reservations = await prisma.wmsReservation.findMany({
      where,
      include: {
        item: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ reservations });
  } catch (err) {
    console.error("Failed to fetch WMS reservations:", err);
    return NextResponse.json({ reservations: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { itemId, equipmentId, equipmentName, maintenancePlanDate, reservedQuantity, reservedBy, reason } = body;

    if (!itemId || !reservedQuantity || !reservedBy) {
      return NextResponse.json(
        { error: "Поля Позиция ТМЦ, Количество и Ответственный обязательны" },
        { status: 400 }
      );
    }

    // Проверка остатка ТМЦ
    const item = await prisma.wmsItem.findUnique({ where: { id: itemId } });
    if (!item) {
      return NextResponse.json({ error: "Позиция ТМЦ не найдена" }, { status: 404 });
    }

    const availableQty = item.quantity - item.reservedQuantity;
    if (Number(reservedQuantity) > availableQty) {
      return NextResponse.json(
        { error: `Недостаточно свободного остатка для резерва. Доступно: ${availableQty} ${item.unit}` },
        { status: 400 }
      );
    }

    // Транзакция: создание резерва и увеличение reservedQuantity у ТМЦ
    const [reservation] = await prisma.$transaction([
      prisma.wmsReservation.create({
        data: {
          itemId,
          equipmentId: equipmentId || null,
          equipmentName: equipmentName || null,
          maintenancePlanDate: maintenancePlanDate ? new Date(maintenancePlanDate) : null,
          reservedQuantity: Number(reservedQuantity),
          reservedBy,
          reason: reason || "Резерв под ППР в ТОИР",
        },
      }),
      prisma.wmsItem.update({
        where: { id: itemId },
        data: {
          reservedQuantity: { increment: Number(reservedQuantity) },
        },
      }),
    ]);

    return NextResponse.json({ reservation, success: true }, { status: 201 });
  } catch (err) {
    console.error("Failed to create WMS reservation:", err);
    return NextResponse.json({ error: "Ошибка при резервировании ТМЦ под ТОИР" }, { status: 500 });
  }
}
