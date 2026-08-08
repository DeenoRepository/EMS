import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: any = {};

    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { responsibleUser: { contains: query, mode: "insensitive" } }
      ];
    }

    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return NextResponse.json({ warehouses: [], total: 0 });
      }
      where.name = { in: responsibleWarehouses };
    }

    const warehouses = await prisma.warehouse.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
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
