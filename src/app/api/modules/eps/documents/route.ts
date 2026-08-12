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

const documentsQuerySchema = z.object({
  equipmentCode: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createDocumentSchema = z.object({
  equipmentId: z.string().min(1, "equipmentId обязателен"),
  title: z.string().min(1, "title обязателен"),
  docType: z.string().optional(),
});

/**
 * GET /api/modules/eps/documents
 *
 * Получить список документов EPS с фильтрацией по equipmentCode.
 * Применяется department-based фильтрация для не-ADMIN пользователей.
 *
 * @requires Permission: eps.documents.manage
 * @returns {Promise<{ items: Document[], total: number, limit: number, offset: number }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  const { searchParams } = new URL(request.url);
  const parseResult = documentsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Некорректные параметры запроса",
      parseResult.error.flatten(),
      400,
      request
    );
  }

  const { equipmentCode, limit, offset } = parseResult.data;

  try {
    const permissions = await getUserEpsPermissions();
    const where: Record<string, unknown> = {};
    if (equipmentCode) {
      where.equipment = { equipmentCode };
    }

    // SEC-03: Restricted document access by department for non-unrestricted (non-ADMIN) users
    if (!permissions.isUnrestricted && session.department) {
      where.equipment = {
        ...((where.equipment as object) || {}),
        department: session.department,
      };
    }

    const [dbDocs, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: { equipment: true, versions: true },
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.document.count({ where }),
    ]);

    const mapped = dbDocs.map((d) => ({
      id: d.id,
      equipmentId: d.equipmentId,
      equipmentCode: d.equipment.equipmentCode,
      title: d.title,
      docType: d.docType,
      status: d.status,
      fileName: d.versions[0]?.fileName || "document.pdf",
      fileSize: (d.versions[0]?.metadata as { fileSize?: string })?.fileSize || "1.2 MB",
      version: d.versions[0]?.versionNumber || 1,
      updatedAt: d.updatedAt.toISOString(),
    }));

    return createSuccessResponse({ items: mapped, total, limit, offset }, request);
  } catch (err) {
    console.error("EPS Documents DB query failed:", err);
    logEvent({
      level: "error",
      module: "EPS",
      action: "DOCUMENTS_LIST_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка базы данных при получении документов",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/modules/eps/documents
 *
 * Создать запись о документе EPS (метаданные, без файла).
 * Публикует доменное событие `eps.document.attached`.
 *
 * @requires Permission: eps.documents.manage
 * @returns {Promise<{ success: true, item: Document }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    const permissions = await getUserEpsPermissions();
    if (!permissions.canEdit) {
      logEvent({
        level: "warn",
        module: "EPS",
        action: "DOCUMENT_CREATE_DENIED",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
      });
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе. Загрузка документов доступна только редакторам.",
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

    const validation = createDocumentSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Необходимые поля (equipmentId, title) не заполнены",
        validation.error.format(),
        400,
        request
      );
    }

    const { equipmentId, title, docType } = validation.data;

    const created = await prisma.document.create({
      data: {
        equipmentId,
        title,
        docType: docType || "OTHER",
        status: "IN_REVIEW",
      },
    });

    logEvent({
      level: "audit",
      module: "EPS",
      action: "DOCUMENT_CREATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { documentId: created.id, equipmentId, title },
    });

    await ShellEventBus.publish(
      "eps.document.attached",
      "EPS",
      {
        documentId: created.id,
        equipmentId,
        title,
        docType: created.docType,
        performedBy: session.id,
        performedByEmail: session.email,
      },
      correlationId
    );

    return createSuccessResponse({ success: true, item: created }, request, 201);
  } catch (err) {
    console.error("EPS Document POST failed:", err);
    logEvent({
      level: "error",
      module: "EPS",
      action: "DOCUMENT_CREATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка загрузки документа в базу данных",
      undefined,
      500,
      request
    );
  }
}
