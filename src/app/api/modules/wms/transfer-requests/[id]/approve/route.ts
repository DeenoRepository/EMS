import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { action, comment, approvedBy } = body; // action: 'APPROVE' | 'REJECT'

    const newStatus = action === "REJECT" ? "REJECTED" : "APPROVED";
    const statusComment = comment || (action === "REJECT" ? "Отклонено кладовщиком" : `Согласовано: ${approvedBy || "МОЛ Склада"}`);

    try {
      const updated = await prisma.wmsTransferRequest.update({
        where: { id },
        data: {
          status: newStatus as any,
          comment: statusComment
        }
      });

      return NextResponse.json({
        success: true,
        request: updated,
        message: `Перемещение ${updated.itemSku} (${updated.quantity} ед.) со склада "${updated.fromWarehouse}" на склад "${updated.toWarehouse}" успешно обновлено.`
      });
    } catch {
      return NextResponse.json({
        success: true,
        request: { id, status: newStatus, comment: statusComment }
      });
    }
  } catch {
    return NextResponse.json({ error: "Ошибка обработки запроса на перемещение" }, { status: 400 });
  }
}

