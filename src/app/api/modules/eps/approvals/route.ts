import { NextResponse } from "next/server";
import { getApprovalsStore, updateApprovalStatus, addApprovalItem } from "@/lib/modules/eps-advanced-store";
import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions } from "@/lib/auth/eps-rbac";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  return NextResponse.json({ items: getApprovalsStore() });
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const permissions = await getUserEpsPermissions();
    const body = await request.json();
    const { id, action, targetCode, title, comments } = body;

    if (action === "CREATE") {
      if (!permissions.canEdit) {
        return NextResponse.json({ error: "Отказано в доступе. Подача заявок доступна только редакторам." }, { status: 403 });
      }
      if (!targetCode || !title) {
        return NextResponse.json({ error: "Необходимы targetCode и title" }, { status: 400 });
      }
      const userEmail = session.email || session.username;

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

    // Resolving approval (APPROVE / REJECT) requires APPROVER or ADMIN role
    if (!permissions.canApprove) {
      return NextResponse.json({ error: "Отказано в доступе. Согласование доступно только согласующим и администраторам." }, { status: 403 });
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

