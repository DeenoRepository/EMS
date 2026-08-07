import { NextResponse } from "next/server";
import { getGlobalTransferRequests, updateGlobalTransferRequest } from "../../route";
import { WmsTransferRequest } from "@/lib/modules/wms-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { action, comment, approvedBy } = body; // action: 'APPROVE' | 'REJECT'

    const requests = getGlobalTransferRequests();
    const found = requests.find((r: WmsTransferRequest) => r.id === id);

    if (!found) {
      return NextResponse.json({ error: "Запрос на перемещение не найден" }, { status: 404 });
    }

    if (action === "REJECT") {
      const updated = updateGlobalTransferRequest(id, {
        status: "REJECTED",
        comment: comment || "Отклонено кладовщиком",
      });
      return NextResponse.json({ success: true, request: updated });
    }

    // Если ОДОБРЕНО (APPROVE)
    const updated = updateGlobalTransferRequest(id, {
      status: "APPROVED",
      comment: comment || `Согласовано: ${approvedBy || "МОЛ Склада"}`,
    });

    return NextResponse.json({
      success: true,
      request: updated,
      message: `Перемещение ${found.itemSku} (${found.quantity} ед.) со склада "${found.fromWarehouse}" на склад "${found.toWarehouse}" успешно проверено и проведено.`
    });
  } catch {
    return NextResponse.json({ error: "Ошибка обработки запроса на перемещение" }, { status: 400 });
  }
}
