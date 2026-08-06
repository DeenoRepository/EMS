import { NextResponse } from "next/server";
import { MOCK_WMS_ITEMS, WmsItem } from "@/lib/modules/wms-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const category = searchParams.get("category");
  const warehouse = searchParams.get("warehouse");
  const status = searchParams.get("status");

  try {
    let filtered = [...MOCK_WMS_ITEMS];

    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.barcode && item.barcode.includes(q)) ||
          item.cell.toLowerCase().includes(q)
      );
    }

    if (category && category !== "ALL") {
      filtered = filtered.filter((item) => item.category === category);
    }

    if (warehouse && warehouse !== "ALL") {
      filtered = filtered.filter((item) => item.warehouse === warehouse);
    }

    if (status && status !== "ALL") {
      filtered = filtered.filter((item) => item.status === status);
    }

    return NextResponse.json({ items: filtered, total: filtered.length });
  } catch {
    return NextResponse.json({ items: MOCK_WMS_ITEMS, total: MOCK_WMS_ITEMS.length });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const newItem: WmsItem = {
      id: `wms-${Date.now()}`,
      sku: body.sku || `SKU-${Date.now().toString().slice(-6)}`,
      name: body.name,
      category: body.category || "Общее",
      type: body.type || "ZIP",
      unit: body.unit || "pcs",
      warehouse: body.warehouse || "Основной склад ЗИП",
      cell: body.cell || "Стеллаж A-01 / Ячейка 01",
      quantity: Number(body.quantity) || 0,
      minQuantity: Number(body.minQuantity) || 5,
      maxQuantity: Number(body.maxQuantity) || 50,
      reservedQuantity: Number(body.reservedQuantity) || 0,
      unitPrice: Number(body.unitPrice) || 0,
      currency: "RUB",
      status: body.quantity === 0 ? "OUT_OF_STOCK" : body.quantity <= (body.minQuantity || 5) ? "LOW_STOCK" : "IN_STOCK",
      supplier: body.supplier || "",
      compatibleEquipment: body.compatibleEquipment || [],
      responsibleUser: body.responsibleUser || "Смирнов А.В. (Старший кладовщик)",
      description: body.description || "",
      barcode: body.barcode || `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
      techSpecs: body.techSpecs || {},
      updatedAt: new Date().toISOString()
    };

    return NextResponse.json({ success: true, item: newItem }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка создания карточки ТМЦ WMS" }, { status: 400 });
  }
}
