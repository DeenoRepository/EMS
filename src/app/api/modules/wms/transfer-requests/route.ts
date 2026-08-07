import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { MOCK_WMS_TRANSFER_REQUESTS, WmsTransferRequest, getWarehouseResponsibleUser, WAREHOUSES_REGISTRY } from "@/lib/modules/wms-store";

let globalTransferRequests: WmsTransferRequest[] = [...MOCK_WMS_TRANSFER_REQUESTS];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const targetMol = searchParams.get("targetMol");
  const warehouse = searchParams.get("warehouse");

  try {
    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (targetMol) {
      where.OR = [
        { targetMolUsername: targetMol },
        { targetMolUser: { contains: targetMol, mode: "insensitive" } }
      ];
    }
    if (warehouse && warehouse !== "ALL") {
      where.OR = [
        { fromWarehouse: warehouse },
        { toWarehouse: warehouse }
      ];
    }

    const dbRequests = await prisma.wmsTransferRequest.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });

    if (dbRequests.length > 0) {
      return NextResponse.json({ requests: dbRequests, total: dbRequests.length });
    }
  } catch (err) {
    console.warn("WMS Transfer Requests DB query failed, falling back to mock store:", err);
  }

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
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const fromWarehouse = body.fromWarehouse || "Основной склад ЗИП";
    const toWarehouse = body.toWarehouse || "Цеховая кладовая №3";
    
    const targetMolUser = getWarehouseResponsibleUser(fromWarehouse);
    const foundWh = WAREHOUSES_REGISTRY.find((w) => w.name === fromWarehouse);

    const reqData = {
      itemId: body.itemId || "wms-001",
      itemSku: body.itemSku || "SKU-UNKNOWN",
      itemName: body.itemName || "Позиция ТМЦ",
      quantity: Number(body.quantity) || 1,
      fromWarehouse,
      toWarehouse,
      requestedBy: body.requestedBy || "Пользователь системы",
      requestedByUsername: body.requestedByUsername || null,
      targetMolUser,
      targetMolUsername: foundWh?.responsibleUsername || null,
      reason: body.reason || "Запрос перемещения ТМЦ",
      status: "PENDING"
    };

    try {
      const created = await prisma.wmsTransferRequest.create({
        data: reqData as any
      });
      return NextResponse.json({ success: true, request: created }, { status: 201 });
    } catch {
      const newRequest: WmsTransferRequest = {
        id: `tr-${Date.now()}`,
        ...reqData,
        requestedByUsername: body.requestedByUsername || undefined,
        targetMolUsername: foundWh?.responsibleUsername || undefined,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      globalTransferRequests = [newRequest, ...globalTransferRequests];
      return NextResponse.json({ success: true, request: newRequest }, { status: 201 });
    }
  } catch {
    return NextResponse.json({ error: "Ошибка создания запроса на перемещение ТМЦ" }, { status: 400 });
  }
}


