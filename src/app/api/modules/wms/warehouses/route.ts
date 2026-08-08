import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";

  try {
    const warehouses = await prisma.warehouse.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { responsibleUser: { contains: query, mode: "insensitive" } }
            ]
          }
        : undefined,
      include: {
        storageCells: true
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json({ warehouses, total: warehouses.length });
  } catch (err) {
    console.error("WMS Warehouses query failed:", err);
    return NextResponse.json({ warehouses: [], total: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name || !body.responsibleUser) {
      return NextResponse.json(
        { error: "Название склада и ответственное лицо обязательны" },
        { status: 400 }
      );
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name: body.name,
        responsibleUser: body.responsibleUser,
        responsibleUsername: body.responsibleUsername || body.responsibleUser,
      }
    });

    return NextResponse.json({ warehouse, success: true }, { status: 201 });
  } catch (err: unknown) {
    console.error("Failed to create warehouse:", err);
    return NextResponse.json(
      { error: "Не удалось создать склад" },
      { status: 500 }
    );
  }
}
