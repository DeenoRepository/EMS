import { EquipmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions } from "@/lib/auth/eps-rbac";
import { logEvent } from "@/lib/telemetry/logger";
import { ShellEventBus } from "@/lib/shell/event-bus";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

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

const approvalActionSchema = z.object({
  id: z.string().optional(),
  action: z.enum(["CREATE", "APPROVE", "APPROVED", "REJECT", "REJECTED"]),
  targetCode: z.string().optional(),
  title: z.string().optional(),
  comments: z.string().optional(),
});

/**
 * GET /api/modules/eps/approvals
 *
 * Получить список заявок на согласование.
 *
 * @requires Permission: eps.approvals.decide
 * @returns {Promise<{ items: ApprovalRequest[] }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
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

    return createSuccessResponse({ items }, request);
  } catch (error) {
    console.error("[EPS Approvals GET] DB Error:", error);
    logEvent({
      level: "error",
      module: "EPS",
      action: "APPROVALS_LIST_FAILED",
      userId: session.id,
      error: String(error),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения заявок на согласование",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/modules/eps/approvals
 *
 * Создать заявку на согласование или принять решение по существующей.
 *
 * @requires Permission: eps.approvals.decide (для APPROVE/REJECT) или eps.equipment.create (для CREATE)
 * @returns {Promise<{ success: true, item: ApprovalRequest }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    const permissions = await getUserEpsPermissions();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(
        "INVALID_JSON",
        "Неверный формат JSON в теле запроса",
        undefined,
        400,
        request
      );
    }

    const validation = approvalActionSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Недопустимое действие согласования. Разрешены: CREATE, APPROVE, REJECT",
        validation.error.format(),
        400,
        request
      );
    }

    const { id, action, targetCode, title, comments } = validation.data;
    const actorId = await ensureDbUser(session);

    if (action === "CREATE") {
      if (!permissions.canEdit) {
        logEvent({
          level: "warn",
          module: "EPS",
          action: "APPROVAL_CREATE_DENIED",
          userId: session.id,
          userEmail: session.email,
          requestId: correlationId,
        });
        return createErrorResponse(
          "FORBIDDEN",
          "Отказано в доступе. Подача заявок доступна только редакторам.",
          undefined,
          403,
          request
        );
      }
      if (!targetCode || !title) {
        return createErrorResponse(
          "VALIDATION_ERROR",
          "Необходимы targetCode и title",
          undefined,
          400,
          request
        );
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
        requestId: correlationId,
        details: { approvalId: newApproval.id, targetCode },
      });

      await ShellEventBus.publish(
        "eps.approval.submitted",
        "EPS",
        {
          approvalId: newApproval.id,
          targetType: newApproval.targetType,
          targetId: newApproval.targetId,
          title,
          requestedBy: session.id,
          requestedByEmail: session.email,
        },
        correlationId
      );

      return createSuccessResponse(
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
        request,
        201
      );
    }

    // Разрешение заявки (APPROVE / REJECT)
    if (!permissions.canApprove) {
      logEvent({
        level: "warn",
        module: "EPS",
        action: "APPROVAL_DECIDE_DENIED",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
      });
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе. Согласование доступно только согласующим и администраторам.",
        undefined,
        403,
        request
      );
    }

    if (!id) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Необходим ID заявки для согласования",
        undefined,
        400,
        request
      );
    }

    const existing = await prisma.approvalRequest.findUnique({
      where: { id: String(id) },
    });

    if (!existing) {
      return createErrorResponse(
        "NOT_FOUND",
        `Заявка на согласование с ID "${id}" не найдена в базе данных`,
        undefined,
        404,
        request
      );
    }

    // SEC-12: Validate state transitions — only allow transition if currently PENDING
    if (existing.status !== "PENDING") {
      return createErrorResponse(
        "CONFLICT",
        `Заявка уже переведена в статус "${existing.status}"`,
        { currentStatus: existing.status },
        409,
        request
      );
    }

    const newStatus = action === "APPROVED" || action === "APPROVE" ? "APPROVED" : "REJECTED";

    // LOG-01: Connect ApprovalRequest resolution to Equipment status mutation inside a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.approvalRequest.update({
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

      // If approved, translate target equipment status to ACTIVE
      if (newStatus === "APPROVED" && app.targetId) {
        const targetEquipment = await tx.equipment.findFirst({
          where: {
            OR: [{ id: app.targetId }, { equipmentCode: app.targetId }],
          },
        });

        const ALLOWED_PREDECESSORS: string[] = ["DRAFT", "PENDING_APPROVAL", "INACTIVE"];
        if (targetEquipment && ALLOWED_PREDECESSORS.includes(targetEquipment.status)) {
          await tx.equipment.update({
            where: { id: targetEquipment.id },
            data: { status: EquipmentStatus.ACTIVE },
          });
        }
      }

      return app;
    });

    logEvent({
      level: "audit",
      module: "EPS",
      action: newStatus === "APPROVED" ? "APPROVAL_RESOLVED_APPROVED" : "APPROVAL_RESOLVED_REJECTED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { approvalId: updated.id, targetId: updated.targetId },
    });

    await ShellEventBus.publish(
      "eps.approval.resolved",
      "EPS",
      {
        approvalId: updated.id,
        targetType: updated.targetType,
        targetId: updated.targetId,
        decision: newStatus,
        comments: updated.comments,
        decidedBy: session.id,
        decidedByEmail: session.email,
      },
      correlationId
    );

    return createSuccessResponse({
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
    }, request);
  } catch (error) {
    // SEC-13: Stable error response with requestId, internal stack kept in server log only
    console.error("[EPS Approvals POST] Error:", error);
    logEvent({
      level: "error",
      module: "EPS",
      action: "APPROVAL_PROCESS_FAILED",
      error: String(error),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка обработки согласования в БД",
      undefined,
      500,
      request
    );
  }
}
