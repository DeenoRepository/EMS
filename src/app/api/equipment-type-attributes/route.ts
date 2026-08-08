import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

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
  } catch (err) {
    console.error("GET /api/equipment-type-attributes failed:", err);
    return NextResponse.json([], { status: 200 });
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
