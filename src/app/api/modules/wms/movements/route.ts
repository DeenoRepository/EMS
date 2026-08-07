import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { MOCK_WMS_MOVEMENTS, WmsMovement } from "@/lib/modules/wms-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const type = searchParams.get("type");

  try {
    const where: any = {};
    if (query) {
      where.OR = [
        { itemName: { contains: query, mode: "insensitive" } },
        { itemSku: { contains: query, mode: "insensitive" } },
        { performedBy: { contains: query, mode: "insensitive" } },
        { recipientUser: { contains: query, mode: "insensitive" } },
        { reason: { contains: query, mode: "insensitive" } }
      ];
    }
    if (type && type !== "ALL") where.type = type;

    const dbMovements = await prisma.wmsMovement.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ movements: dbMovements, total: dbMovements.length });
  } catch (err) {
    console.error("WMS Movements DB query failed:", err);
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: " Ошибка базы данных при загрузке операций" }, { status: 500 });
    }
  }

  let filtered = [...MOCK_WMS_MOVEMENTS];
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.itemName.toLowerCase().includes(q) ||
        m.itemSku.toLowerCase().includes(q) ||
        m.performedBy.toLowerCase().includes(q) ||
        (m.recipientUser && m.recipientUser.toLowerCase().includes(q)) ||
        (m.reason && m.reason.toLowerCase().includes(q))
    );
  }
  if (type && type !== "ALL") filtered = filtered.filter((m) => m.type === type);

  return NextResponse.json({ movements: filtered, total: filtered.length });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.itemId) {
      return NextResponse.json({ error: "Поле itemId обязательно для проведения операции" }, { status: 400 });
    }

    const movementData = {
      itemId: body.itemId,
      itemSku: body.itemSku || "SKU-UNKNOWN",
      itemName: body.itemName || "ТМЦ Номенклатура",
      type: body.type || "INCOMING",
      quantity: Number(body.quantity) || 1,
      fromLocation: body.fromLocation || "",
      toLocation: body.toLocation || "",
      performedBy: body.performedBy || "Оператор WMS",
      recipientUser: body.recipientUser || null,
      reason: body.reason || "",
      relatedOrderOrEq: body.relatedOrderOrEq || null
    };

    try {
      const created = await prisma.wmsMovement.create({
        data: movementData as any
      });
      return NextResponse.json({ success: true, movement: created }, { status: 201 });
    } catch {
      const newMovement: WmsMovement = {
        id: `mov-${Date.now()}`,
        ...movementData,
        recipientUser: body.recipientUser || undefined,
        relatedOrderOrEq: body.relatedOrderOrEq || undefined,
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json({ success: true, movement: newMovement }, { status: 201 });
    }
  } catch {
    return NextResponse.json({ error: "Ошибка проведения операции WMS" }, { status: 400 });
  }
}

