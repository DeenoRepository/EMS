import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const facilities = await prisma.enterpriseFacility.findMany({
      orderBy: { name: "asc" }
    });
    return NextResponse.json({ facilities });
  } catch (err) {
    console.error("Failed to fetch facilities:", err);
    return NextResponse.json({ facilities: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.code) {
      return NextResponse.json({ error: "Поля name и code обязательны" }, { status: 400 });
    }

    const facility = await prisma.enterpriseFacility.create({
      data: {
        code: body.code,
        name: body.name,
        address: body.address || null
      }
    });

    return NextResponse.json({ success: true, facility }, { status: 201 });
  } catch (err) {
    console.error("Failed to create facility:", err);
    return NextResponse.json({ error: "Ошибка создания объекта предприятия" }, { status: 400 });
  }
}
