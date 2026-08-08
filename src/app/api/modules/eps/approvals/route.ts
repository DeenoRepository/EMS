import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions } from "@/lib/auth/eps-rbac";
import { logEvent } from "@/lib/telemetry/logger";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  try {
    const dbApprovals = await prisma.approvalRequest.findMany({
      include: {
        requestedBy: {
          select: { displayName: true, email: true }
        },
        decidedBy: {
          select: { displayName: true, email: true }
        }
      },
      orderBy: { submittedAt: "desc" }
    });

    const items = dbApprovals.map((req) => ({
      id: req.id,
      targetType: req.targetType,
      targetCode: req.targetId,
      title: req.comments ? req.comments.split("\n")[0] : `Заявка на согласование ${req.targetId}`,
      comments: req.comments,
      requestedBy: req.requestedBy.email || req.requestedBy.displayName,
      status: req.status,
      submittedAt: req.submittedAt.toISOString(),
      decidedAt: req.decidedAt ? req.decidedAt.toISOString() : undefined,
      decidedBy: req.decidedBy ? (req.decidedBy.email || req.decidedBy.displayName) : undefined
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[EPS Approvals GET] DB Error:", error);
    return NextResponse.json({ error: "Ошибка получения заявок на согласование" }, { status: 500 });
  }
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

      // Создаем заявку в PostgreSQL через Prisma
      const newApproval = await prisma.approvalRequest.create({
        data: {
          targetType: "EQUIPMENT_VERSION",
          targetId: String(targetCode),
          status: "PENDING",
          comments: `${title}${comments ? `\n${comments}` : ""}`,
          requestedById: session.id,
        },
        include: {
          requestedBy: { select: { email: true, displayName: true } }
        }
      });

      logEvent({
        level: "audit",
        module: "EPS",
        action: "APPROVAL_CREATED",
        userId: session.id,
        userEmail: session.email,
        details: { approvalId: newApproval.id, targetCode }
      });

      return NextResponse.json(
        {
          success: true,
          item: {
            id: newApproval.id,
            targetType: newApproval.targetType,
            targetCode: newApproval.targetId,
            title,
            comments,
            requestedBy: newApproval.requestedBy.email || newApproval.requestedBy.displayName,
            status: newApproval.status,
            submittedAt: newApproval.submittedAt.toISOString()
          }
        },
        { status: 201 }
      );
    }

    // Разрешение заявки (APPROVE / REJECT)
    if (!permissions.canApprove) {
      return NextResponse.json({ error: "Отказано в доступе. Согласование доступно только согласующим и администраторам." }, { status: 403 });
    }

    const newStatus = (action === "APPROVED" || action === "APPROVE") ? "APPROVED" : "REJECTED";

    const updated = await prisma.approvalRequest.update({
      where: { id: String(id) },
      data: {
        status: newStatus,
        decidedById: session.id,
        decidedAt: new Date()
      },
      include: {
        requestedBy: { select: { email: true, displayName: true } },
        decidedBy: { select: { email: true, displayName: true } }
      }
    });

    logEvent({
      level: "audit",
      module: "EPS",
      action: newStatus === "APPROVED" ? "APPROVAL_RESOLVED_APPROVED" : "APPROVAL_RESOLVED_REJECTED",
      userId: session.id,
      userEmail: session.email,
      details: { approvalId: updated.id, targetId: updated.targetId }
    });

    return NextResponse.json({
      success: true,
      item: {
        id: updated.id,
        targetType: updated.targetType,
        targetCode: updated.targetId,
        title: updated.comments ? updated.comments.split("\n")[0] : updated.targetId,
        comments: updated.comments,
        requestedBy: updated.requestedBy.email || updated.requestedBy.displayName,
        status: updated.status,
        submittedAt: updated.submittedAt.toISOString(),
        decidedAt: updated.decidedAt?.toISOString(),
        decidedBy: updated.decidedBy?.email || updated.decidedBy?.displayName
      }
    });
  } catch (error) {
    console.error("[EPS Approvals POST] Error:", error);
    return NextResponse.json({ error: "Ошибка обработки согласования в БД" }, { status: 500 });
  }
}
