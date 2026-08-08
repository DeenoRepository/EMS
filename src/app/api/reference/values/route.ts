import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasRole(session, ["ADMIN", "EDITOR"])) {
    return NextResponse.json({ error: "Отказано в доступе" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const createdValue = await prisma.referenceValue.create({
      data: {
        fieldId: body.fieldId,
        value: body.value.trim(),
        label: body.label.trim(),
        isActive: true,
        sortOrder: body.sortOrder ?? 0
      }
    });

    return NextResponse.json(createdValue, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка создания элемента справочника" }, { status: 400 });
  }
}
