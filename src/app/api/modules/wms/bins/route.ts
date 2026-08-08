import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

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
    const body = await request.json();
    const { action, warehouseId, code, name, zoneId, capacity, description } = body;

    if (action === "create_zone") {
      if (!warehouseId || !code || !name) {
        return NextResponse.json({ error: "Поля Склад, Код зоны и Название зоны обязательны" }, { status: 400 });
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
      if (!warehouseId || !code) {
        return NextResponse.json({ error: "Поля Склад и Код ячейки обязательны" }, { status: 400 });
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
