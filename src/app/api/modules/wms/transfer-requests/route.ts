import { NextResponse } from "next/server";
import { MOCK_WMS_TRANSFER_REQUESTS, WmsTransferRequest, getWarehouseResponsibleUser, WAREHOUSES_REGISTRY } from "@/lib/modules/wms-store";

// Используем в памяти глобальное состояние для хранения созданных запросов во время работы dev-сервера
let globalTransferRequests: WmsTransferRequest[] = [...MOCK_WMS_TRANSFER_REQUESTS];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const targetMol = searchParams.get("targetMol");
  const warehouse = searchParams.get("warehouse");

  try {
    let filtered = [...globalTransferRequests];

    if (status && status !== "ALL") {
      filtered = filtered.filter((r) => r.status === status);
    }

    if (targetMol) {
      filtered = filtered.filter(
        (r) =>
          (r.targetMolUsername && r.targetMolUsername === targetMol) ||
          r.targetMolUser.toLowerCase().includes(targetMol.toLowerCase())
      );
    }

    if (warehouse && warehouse !== "ALL") {
      filtered = filtered.filter((r) => r.fromWarehouse === warehouse || r.toWarehouse === warehouse);
    }

    return NextResponse.json({ requests: filtered, total: filtered.length });
  } catch {
    return NextResponse.json({ requests: globalTransferRequests, total: globalTransferRequests.length });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const fromWarehouse = body.fromWarehouse || "Основной склад ЗИП";
    const toWarehouse = body.toWarehouse || "Цеховая кладовая №3";
    
    // Определение МОЛ склада-источника
    const targetMolUser = getWarehouseResponsibleUser(fromWarehouse);
    const foundWh = WAREHOUSES_REGISTRY.find((w) => w.name === fromWarehouse);

    const newRequest: WmsTransferRequest = {
      id: `tr-${Date.now()}`,
      itemId: body.itemId || "wms-001",
      itemSku: body.itemSku || "SKU-UNKNOWN",
      itemName: body.itemName || "Позиция ТМЦ",
      quantity: Number(body.quantity) || 1,
      fromWarehouse,
      toWarehouse,
      requestedBy: body.requestedBy || "Пользователь системы",
      requestedByUsername: body.requestedByUsername || undefined,
      targetMolUser,
      targetMolUsername: foundWh?.responsibleUsername || undefined,
      reason: body.reason || "Запрос перемещения ТМЦ",
      status: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    globalTransferRequests = [newRequest, ...globalTransferRequests];

    return NextResponse.json({ success: true, request: newRequest }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка создания запроса на перемещение ТМЦ" }, { status: 400 });
  }
}

export function getGlobalTransferRequests() {
  return globalTransferRequests;
}

export function updateGlobalTransferRequest(id: string, updated: Partial<WmsTransferRequest>) {
  globalTransferRequests = globalTransferRequests.map((r) => (r.id === id ? { ...r, ...updated, updatedAt: new Date().toISOString() } : r));
  return globalTransferRequests.find((r) => r.id === id);
}
