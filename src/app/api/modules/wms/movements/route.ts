import { NextResponse } from "next/server";
import { MOCK_WMS_MOVEMENTS, WmsMovement } from "@/lib/modules/wms-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const type = searchParams.get("type");

  try {
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

    if (type && type !== "ALL") {
      filtered = filtered.filter((m) => m.type === type);
    }

    return NextResponse.json({ movements: filtered, total: filtered.length });
  } catch {
    return NextResponse.json({ movements: MOCK_WMS_MOVEMENTS, total: MOCK_WMS_MOVEMENTS.length });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const newMovement: WmsMovement = {
      id: `mov-${Date.now()}`,
      itemId: body.itemId || "n/a",
      itemSku: body.itemSku || "SKU-UNKNOWN",
      itemName: body.itemName || "ТМЦ Номенклатура",
      type: body.type || "INCOMING",
      quantity: Number(body.quantity) || 1,
      fromLocation: body.fromLocation || "",
      toLocation: body.toLocation || "",
      performedBy: body.performedBy || "Кладовщик МОЛ",
      recipientUser: body.recipientUser || undefined,
      reason: body.reason || "",
      relatedOrderOrEq: body.relatedOrderOrEq || undefined,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, movement: newMovement }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка проведения операции WMS" }, { status: 400 });
  }
}
