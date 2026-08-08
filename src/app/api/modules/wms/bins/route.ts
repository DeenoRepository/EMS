import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const warehouseId = searchParams.get("warehouseId");

  try {
    const where: any = {};
    if (warehouseId) where.warehouseId = warehouseId;

    const [zones, cells] = await Promise.all([
      prisma.wmsZone.findMany({ where, orderBy: { code: "asc" } }),
      prisma.storageCell.findMany({ where, include: { zone: true }, orderBy: { code: "asc" } }),
    ]);

    return NextResponse.json({ zones, cells });
  } catch (err) {
    console.error("Failed to fetch WMS storage topology:", err);
    return NextResponse.json({ zones: [], cells: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const body = await request.json();
    const { action, warehouseId, code, name, zoneId, capacity, description } = body;

    if (!warehouseId) {
      return NextResponse.json({ error: "Не указан склад" }, { status: 400 });
    }

    // Check warehouse MOL / Admin authorization
    const targetWh = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!targetWh) {
      return NextResponse.json({ error: "Склад не найден" }, { status: 404 });
    }

    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null && !responsibleWarehouses.includes(targetWh.name)) {
      return NextResponse.json(
        { error: `Отказано в доступе. Редактирование топологии склада "${targetWh.name}" разрешено только МОЛ данного склада.` },
        { status: 403 }
      );
    }

    if (action === "create_zone") {
      if (!code || !name) {
        return NextResponse.json({ error: "Поля Код зоны и Название зоны обязательны" }, { status: 400 });
      }

      const zone = await prisma.wmsZone.create({
        data: {
          warehouseId,
          code,
          name,
          description: description || null,
        },
      });

      return NextResponse.json({ zone, success: true }, { status: 201 });
    }

    if (action === "create_cell") {
      if (!code) {
        return NextResponse.json({ error: "Поль Код ячейки обязательно" }, { status: 400 });
      }

      const cell = await prisma.storageCell.create({
        data: {
          warehouseId,
          zoneId: zoneId || null,
          code,
          description: description || null,
          capacity: Number(capacity) || 100,
        },
      });

      return NextResponse.json({ cell, success: true }, { status: 201 });
    }

    return NextResponse.json({ error: "Неизвестное действие (action)" }, { status: 400 });
  } catch (err: any) {
    console.error("Failed to update WMS topology:", err);
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Зона или ячейка с таким кодом уже существует на этом складе" }, { status: 400 });
    }
    return NextResponse.json({ error: "Ошибка при сохранении топологии склада" }, { status: 500 });
  }
}
