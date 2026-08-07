import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
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
