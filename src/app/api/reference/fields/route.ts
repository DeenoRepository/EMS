import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  try {
    const fields = await prisma.referenceField.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      include: {
        values: {
          orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
        }
      }
    });

    return NextResponse.json(fields);
  } catch {
    return NextResponse.json([
      {
        id: "rf-1",
        key: "category",
        label: "Категории оборудования",
        description: "Классификация оборудования по технологическим признакам",
        isActive: true,
        sortOrder: 1,
        values: [
          { id: "rv-1", value: "Металлообработка", label: "Металлообработка", isActive: true, sortOrder: 1 },
          { id: "rv-2", value: "Энергетика", label: "Энергетическое оборудование", isActive: true, sortOrder: 2 }
        ]
      },
      {
        id: "rf-2",
        key: "department",
        label: "Цеха и подразделения",
        description: "Организационная структура производства",
        isActive: true,
        sortOrder: 2,
        values: [
          { id: "rv-3", value: "Цех №1", label: "Механообрабатывающий цех №1", isActive: true, sortOrder: 1 },
          { id: "rv-4", value: "Цех №3", label: "Сборочный цех №3", isActive: true, sortOrder: 2 }
        ]
      }
    ]);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasRole(session, ["ADMIN", "EDITOR"])) {
    return NextResponse.json({ error: "Отказано в доступе" }, { status: 403 });
  }

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
    return NextResponse.json({ error: "Ошибка создания справочного поля" }, { status: 400 });
  }
}
