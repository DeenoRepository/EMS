import { prisma } from "@/lib/db/prisma";
import { TimelineEvent } from "@/lib/modules/eps-advanced-store";
import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions } from "@/lib/auth/eps-rbac";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/shell/api-response";
import { z } from "zod";

const eventsQuerySchema = z.object({
  equipmentId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/modules/eps/events
 *
 * Получить ленту событий оборудования EPS.
 * Применяется department-based фильтрация для не-ADMIN пользователей.
 *
 * @requires Permission: eps.equipment.read
 * @returns {Promise<{ items: TimelineEvent[], total: number, limit: number, offset: number }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  const { searchParams } = new URL(request.url);
  const parseResult = eventsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Некорректные параметры запроса",
      parseResult.error.flatten(),
      400,
      request
    );
  }

  const { equipmentId, limit, offset } = parseResult.data;

  try {
    const permissions = await getUserEpsPermissions();
    const whereCondition: Record<string, unknown> = {};

    if (equipmentId) {
      whereCondition.equipmentId = equipmentId;
    }

    // SEC-03: Restricted event log access by department for non-unrestricted users
    if (!permissions.isUnrestricted && session.department) {
      whereCondition.equipment = {
        department: session.department,
      };
    }

    const [dbEvents, total] = await Promise.all([
      prisma.equipmentEvent.findMany({
        where: whereCondition,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.equipmentEvent.count({ where: whereCondition }),
    ]);

    const items: TimelineEvent[] = dbEvents.map((evt) => ({
      id: evt.id,
      equipmentId: evt.equipmentId,
      eventType: evt.eventType as TimelineEvent["eventType"],
      title: evt.title,
      description: evt.description || "",
      actor: evt.actorId || "system@ems.local",
      createdAt: evt.createdAt.toISOString(),
    }));

    return createSuccessResponse({ items, total, limit, offset }, request);
  } catch (err) {
    console.error("EPS Events DB query failed:", err);
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка базы данных при загрузке событий",
      undefined,
      500,
      request
    );
  }
}
