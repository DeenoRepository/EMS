import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { logEvent } from "@/lib/telemetry/logger";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const updateUserRolesSchema = z.object({
  userId: z.string().min(1, "userId обязателен"),
  roleKeys: z.array(z.string()),
});

/**
 * GET /api/admin/users
 *
 * Получить список пользователей с привязанными ролями.
 *
 * @requires Permission: admin.roles.manage
 * @returns {Promise<{ users: User[] }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  if (!hasPermission(session, "admin.roles.manage")) {
    return createErrorResponse(
      "FORBIDDEN",
      "Доступ запрещен: требуется разрешение admin.roles.manage",
      undefined,
      403,
      request
    );
  }

  try {
    const users = await prisma.user.findMany({
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = users.map((u) => ({
      id: u.id,
      name: u.displayName,
      email: u.email,
      isActive: u.isActive,
      roles: u.userRoles.map((ur) => ({
        id: ur.role.id,
        key: ur.role.key,
        name: ur.role.name,
      })),
      roleKeys: u.userRoles.map((ur) => ur.role.key),
      createdAt: u.createdAt,
    }));

    return createSuccessResponse({ users: formatted }, request);
  } catch (err) {
    console.error("[GET /api/admin/users] error:", err);
    logEvent({
      level: "error",
      module: "ADMIN",
      action: "USERS_LIST_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения списка пользователей",
      undefined,
      500,
      request
    );
  }
}

/**
 * PUT /api/admin/users
 *
 * Обновить назначенные роли пользователя.
 *
 * @requires Permission: admin.roles.manage
 * @returns {Promise<{ success: true, user: User }>}
 */
export async function PUT(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    if (!hasPermission(session, "admin.roles.manage")) {
      return createErrorResponse(
        "FORBIDDEN",
        "Доступ запрещен: требуется разрешение admin.roles.manage",
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

    const validation = updateUserRolesSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Неверные параметры запроса",
        validation.error.format(),
        400,
        request
      );
    }

    const { userId, roleKeys } = validation.data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return createErrorResponse(
        "NOT_FOUND",
        "Пользователь не найден",
        undefined,
        404,
        request
      );
    }

    // Находим сущности ролей по ключам или id
    const roles = await prisma.role.findMany({
      where: {
        OR: [{ key: { in: roleKeys } }, { id: { in: roleKeys } }],
      },
    });

    // Удаляем старые назначения
    await prisma.userRole.deleteMany({ where: { userId } });

    // Создаем новые назначения
    if (roles.length > 0) {
      await prisma.userRole.createMany({
        data: roles.map((r) => ({
          userId,
          roleId: r.id,
        })),
      });
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    logEvent({
      level: "audit",
      module: "ADMIN",
      action: "USER_ROLES_UPDATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: {
        targetUserId: userId,
        targetUserEmail: user.email,
        assignedRoles: roles.map((r) => r.key),
      },
    });

    return createSuccessResponse(
      {
        success: true,
        user: {
          id: updatedUser?.id,
          name: updatedUser?.displayName,
          email: updatedUser?.email,
          roles: updatedUser?.userRoles.map((ur) => ({ id: ur.role.id, key: ur.role.key, name: ur.role.name })),
        },
      },
      request
    );
  } catch (err) {
    console.error("[PUT /api/admin/users] error:", err);
    logEvent({
      level: "error",
      module: "ADMIN",
      action: "USER_ROLES_UPDATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка обновления ролей пользователя",
      undefined,
      500,
      request
    );
  }
}
