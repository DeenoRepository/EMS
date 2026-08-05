import { NextResponse } from "next/server";
import { getApprovalsStore, updateApprovalStatus, addApprovalItem } from "@/lib/modules/eps-advanced-store";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  return NextResponse.json({ items: getApprovalsStore() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, action, targetCode, title, comments } = body;

    if (action === "CREATE") {
      if (!targetCode || !title) {
        return NextResponse.json({ error: "Необходимы targetCode и title" }, { status: 400 });
      }
      const session = await getSession();
      const userEmail = session?.email || "user@ems.local";

      const newItem = addApprovalItem({
        targetType: "EQUIPMENT_VERSION",
        targetCode,
        title,
        comments,
        requestedBy: userEmail,
        status: "PENDING"
      });
      return NextResponse.json({ success: true, item: newItem }, { status: 201 });
    }


    const actionStatus = (action === "APPROVED" || action === "APPROVE") ? "APPROVED" : "REJECTED";
    const updated = updateApprovalStatus(id, actionStatus);

    if (!updated) {
      return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch {
    return NextResponse.json({ error: "Ошибка обработки согласования" }, { status: 400 });
  }
}

