import { prisma } from "@/lib/db/prisma";
import { auditLogMemory, logEvent } from "@/lib/telemetry/logger";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const createAuditEntrySchema = z.object({
  level: z.enum(["info", "warn", "error", "audit"]).optional(),
  module: z.string().optional(),
  action: z.string().min(1, "action обязателен"),
  userId: z.string().optional(),
  userEmail: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/admin/audit
 *
 * Получить журнал аудита (только ADMIN).
 *
 * @requires Role: ADMIN
 * @returns {Promise<{ logs: AuditLog[], total: number, limit: number, offset: number }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  if (!hasRole(session, ["ADMIN"])) {
    return createErrorResponse(
      "FORBIDDEN",
      "Отказано в доступе. Требуются права администратора.",
      undefined,
      403,
      request
    );
  }

  const { searchParams } = new URL(request.url);
  const parseResult = auditQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Некорректные параметры запроса",
      parseResult.error.flatten(),
      400,
      request
    );
  }

  const { limit, offset } = parseResult.data;

  try {
    const [dbLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: { displayName: true, email: true },
          },
        },
      }),
      prisma.auditLog.count(),
    ]);

    const formattedLogs = dbLogs.map((log) => ({
      timestamp: log.createdAt.toISOString(),
      level: "audit",
      module: log.entityType,
      action: log.action,
      userId: log.actorId || undefined,
      userEmail: log.actorEmail || log.actor?.email || undefined,
      details: (log.metadata as Record<string, unknown>) || undefined,
      ip: log.ipAddress || undefined,
    }));

    return createSuccessResponse({ logs: formattedLogs, total, limit, offset }, request);
  } catch (error) {
    console.warn("[Admin Audit GET] Falling back to in-memory audit logs due to DB error:", error);
    return createSuccessResponse(
      { logs: auditLogMemory, total: auditLogMemory.length, limit, offset },
      request
    );
  }
}

/**
 * POST /api/admin/audit
 *
 * Записать произвольную запись в журнал аудита (только ADMIN).
 *
 * @requires Role: ADMIN
 * @returns {Promise<{ success: true, entry: LogEntry }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    if (!hasRole(session, ["ADMIN"])) {
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе. Требуются права администратора.",
        undefined,
        403,
        request
      );
    }

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

    const validation = createAuditEntrySchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Некорректные параметры записи аудита",
        validation.error.format(),
        400,
        request
      );
    }

    const entry = logEvent({
      level: validation.data.level || "info",
      module: validation.data.module || "SHELL",
      action: validation.data.action,
      userId: validation.data.userId || session.id,
      userEmail: validation.data.userEmail || session.email,
      requestId: correlationId,
      details: validation.data.details,
    });

    return createSuccessResponse({ success: true, entry }, request, 201);
  } catch {
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка записи лога",
      undefined,
      500,
      request
    );
  }
}
