import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !hasRole(session, ["ADMIN"])) {
      return NextResponse.json({ error: "Отказано в доступе. Требуются права администратора." }, { status: 403 });
    }

    const warehouses = await prisma.warehouse.findMany({
      include: { storageCells: true },
      orderBy: { name: "asc" }
    });
    return NextResponse.json({ warehouses });
  } catch (err) {
    console.error("Failed to fetch warehouses:", err);
    return NextResponse.json({ warehouses: [] });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasRole(session, ["ADMIN"])) {
      return NextResponse.json({ error: "Отказано в доступе. Требуются права администратора." }, { status: 403 });
    }

    const body = await request.json();
    if (!body.name || !body.responsibleUser) {
      return NextResponse.json({ error: "Поля name и responsibleUser обязательны" }, { status: 400 });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name: body.name,
        responsibleUser: body.responsibleUser,
        responsibleUsername: body.responsibleUsername || null
      }
    });

    return NextResponse.json({ success: true, warehouse }, { status: 201 });
  } catch (err) {
    console.error("Failed to create warehouse:", err);
    return NextResponse.json({ error: "Ошибка создания склада" }, { status: 400 });
  }
}
