import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const fields = await prisma.referenceField.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      include: {
        values: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
        }
      }
    });

    const options: Record<string, Array<{ id: string; value: string; label: string }>> = {};
    for (const field of fields) {
      options[field.key] = field.values.map((v: any) => ({ id: v.id, value: v.value, label: v.label }));
    }

    return NextResponse.json({ options, fields });
  } catch {
    // Fallback options
    return NextResponse.json({
      options: {
        category: [
          { id: "c1", value: "Металлообработка", label: "Металлообработка" },
          { id: "c2", value: "Энергетика", label: "Энергетика" }
        ],
        department: [
          { id: "d1", value: "Цех №1", label: "Цех №1" },
          { id: "d2", value: "Цех №3", label: "Цех №3" }
        ]
      },
      fields: []
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const createdField = await prisma.referenceField.create({
      data: {
        entityType: "EQUIPMENT",
        key: body.key.trim().toLowerCase(),
        label: body.label.trim(),
        description: body.description?.trim(),
        isActive: true,
        sortOrder: body.sortOrder ?? 0
      }
    });

    return NextResponse.json(createdField, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка создания справочника" }, { status: 400 });
  }
}
