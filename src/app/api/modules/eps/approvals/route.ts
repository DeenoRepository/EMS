import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions } from "@/lib/auth/eps-rbac";
import { logEvent } from "@/lib/telemetry/logger";
import { randomUUID } from "crypto";

async function ensureDbUser(session: { id: string; email?: string; displayName?: string; username?: string }) {
  try {
    let user = await prisma.user.findUnique({ where: { id: session.id } });
    if (user) return user.id;

    if (session.email) {
      user = await prisma.user.findUnique({ where: { email: session.email } });
      if (user) return user.id;
    }

    const created = await prisma.user.create({
      data: {
        id: session.id,
        email: session.email || `${session.id}@ems.local`,
        displayName: session.displayName || session.username || "Пользователь EMS",
      },
    });
    return created.id;
  } catch (err) {
    console.warn("[EPS Approvals] User auto-create warning:", err);
    return session.id;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  try {
    const dbApprovals = await prisma.approvalRequest.findMany({
      include: {
        requestedBy: {
          select: { displayName: true, email: true },
        },
        decidedBy: {
          select: { displayName: true, email: true },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    const items = dbApprovals.map((req) => ({
      id: req.id,
      targetType: req.targetType,
      targetCode: req.targetId,
      title: req.comments ? req.comments.split("\n")[0] : `Заявка на согласование ${req.targetId}`,
      comments: req.comments,
      requestedBy: req.requestedBy?.email || req.requestedBy?.displayName || "Система",
      status: req.status,
      submittedAt: req.submittedAt.toISOString(),
      decidedAt: req.decidedAt ? req.decidedAt.toISOString() : undefined,
      decidedBy: req.decidedBy ? req.decidedBy.email || req.decidedBy.displayName : undefined,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    const requestId = randomUUID();
    console.error(`[EPS Approvals GET] DB Error [requestId=${requestId}]:`, error);
    return NextResponse.json(
      { error: "Ошибка получения заявок на согласование", requestId },
      { status: 500 }
    );
  }
}

const ALLOWED_ACTIONS = new Set(["CREATE", "APPROVE", "APPROVED", "REJECT", "REJECTED"]);

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const permissions = await getUserEpsPermissions();
    const body = await request.json();
    const { id, action, targetCode, title, comments } = body;

    // SEC-12: Strict validation of approval action enum
    if (!action || typeof action !== "string" || !ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: `Недопустимое действие согласования. Разрешены: CREATE, APPROVE, REJECT` },
        { status: 400 }
      );
    }

    const actorId = await ensureDbUser(session);

    if (action === "CREATE") {
      if (!permissions.canEdit) {
        return NextResponse.json({ error: "Отказано в доступе. Подача заявок доступна только редакторам." }, { status: 403 });
      }
      if (!targetCode || !title) {
        return NextResponse.json({ error: "Необходимы targetCode и title" }, { status: 400 });
      }

      const newApproval = await prisma.approvalRequest.create({
        data: {
          targetType: "EQUIPMENT_VERSION",
          targetId: String(targetCode),
          status: "PENDING",
          comments: `${title}${comments ? `\n${comments}` : ""}`,
          requestedById: actorId,
        },
        include: {
          requestedBy: { select: { email: true, displayName: true } },
        },
      });

      logEvent({
        level: "audit",
        module: "EPS",
        action: "APPROVAL_CREATED",
        userId: session.id,
        userEmail: session.email,
        details: { approvalId: newApproval.id, targetCode },
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
            requestedBy: newApproval.requestedBy?.email || newApproval.requestedBy?.displayName || session.email,
            status: newApproval.status,
            submittedAt: newApproval.submittedAt.toISOString(),
          },
        },
        { status: 201 }
      );
    }

    // Разрешение заявки (APPROVE / REJECT)
    if (!permissions.canApprove) {
      return NextResponse.json({ error: "Отказано в доступе. Согласование доступно только согласующим и администраторам." }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: "Необходим ID заявки для согласования" }, { status: 400 });
    }

    const existing = await prisma.approvalRequest.findUnique({
      where: { id: String(id) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: `Заявка на согласование с ID "${id}" не найдена в базе данных` },
        { status: 404 }
      );
    }

    // SEC-12: Validate state transitions — only allow transition if currently PENDING
    if (existing.status !== "PENDING") {
      return NextResponse.json(
        { error: `Заявка уже переведена в статус "${existing.status}"` },
        { status: 409 }
      );
    }

    const newStatus = action === "APPROVED" || action === "APPROVE" ? "APPROVED" : "REJECTED";

    const updated = await prisma.approvalRequest.update({
      where: { id: String(id) },
      data: {
        status: newStatus,
        decidedById: actorId,
        decidedAt: new Date(),
      },
      include: {
        requestedBy: { select: { email: true, displayName: true } },
        decidedBy: { select: { email: true, displayName: true } },
      },
    });

    logEvent({
      level: "audit",
      module: "EPS",
      action: newStatus === "APPROVED" ? "APPROVAL_RESOLVED_APPROVED" : "APPROVAL_RESOLVED_REJECTED",
      userId: session.id,
      userEmail: session.email,
      details: { approvalId: updated.id, targetId: updated.targetId },
    });

    return NextResponse.json({
      success: true,
      item: {
        id: updated.id,
        targetType: updated.targetType,
        targetCode: updated.targetId,
        title: updated.comments ? updated.comments.split("\n")[0] : updated.targetId,
        comments: updated.comments,
        requestedBy: updated.requestedBy?.email || updated.requestedBy?.displayName || "Система",
        status: updated.status,
        submittedAt: updated.submittedAt.toISOString(),
        decidedAt: updated.decidedAt?.toISOString(),
        decidedBy: updated.decidedBy?.email || updated.decidedBy?.displayName || session.email,
      },
    });
  } catch (error: any) {
    // SEC-13: Stable error response with requestId, internal stack kept in server log only
    console.error(`[EPS Approvals POST] Error [requestId=${requestId}]:`, error);
    return NextResponse.json(
      {
        error: "Ошибка обработки согласования в БД",
        requestId,
      },
      { status: 500 }
    );
  }
}
