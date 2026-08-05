import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const typeValue = searchParams.get("type") || undefined;

  try {
    const items = await prisma.equipmentTypeAttribute.findMany({
      where: {
        ...(typeValue ? { typeValue } : {}),
        isActive: true
      },
      orderBy: [{ typeValue: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
    });

    return NextResponse.json(items);
  } catch {
    return NextResponse.json([
      { id: "1", typeValue: "Обрабатывающий центр", key: "spindle_speed_rpm", label: "Частота вращения шпинделя (об/мин)", dataType: "NUMBER", required: true, isActive: true, sortOrder: 1 },
      { id: "2", typeValue: "Обрабатывающий центр", key: "cnc_controller_type", label: "Тип стойки ЧПУ", dataType: "TEXT", required: true, isActive: true, sortOrder: 2 },
      { id: "3", typeValue: "Прессовое оборудование", key: "nominal_force_tons", label: "Номинальное усилие пресса (тонн)", dataType: "NUMBER", required: true, isActive: true, sortOrder: 1 }
    ]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const created = await prisma.equipmentTypeAttribute.create({
      data: {
        typeValue: body.typeValue.trim(),
        key: body.key.trim().toLowerCase(),
        label: body.label.trim(),
        dataType: body.dataType || "TEXT",
        required: body.required ?? false,
        isActive: true,
        sortOrder: body.sortOrder ?? 0
      }
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка создания характеристического атрибута" }, { status: 400 });
  }
}
