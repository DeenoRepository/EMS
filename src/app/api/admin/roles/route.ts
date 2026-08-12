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

const createRoleSchema = z.object({
  key: z.string().optional(),
  name: z.string().min(1, "Название роли обязательно"),
  description: z.string().optional(),
  permissionCodes: z.array(z.string()).optional(),
  scope: z
    .object({
      allowedWarehouses: z.array(z.string()).optional(),
      allowedDepartments: z.array(z.string()).optional(),
      isGlobal: z.boolean().optional(),
    })
    .optional(),
});

/**
 * GET /api/admin/roles
 *
 * Получить список всех ролей с разрешениями и подсчётом пользователей.
 *
 * @requires Permission: admin.roles.manage
 * @returns {Promise<{ roles: Role[] }>}
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
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true },
        },
        scope: true,
        _count: {
          select: { userRoles: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formatted = roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.userRoles,
      permissions: r.permissions.map((rp) => rp.permission.code),
      scope: r.scope
        ? {
          allowedWarehouses: (r.scope.allowedWarehouses as string[]) || [],
          allowedDepartments: (r.scope.allowedDepartments as string[]) || [],
          isGlobal: r.scope.isGlobal,
        }
        : { allowedWarehouses: [], allowedDepartments: [], isGlobal: true },
      createdAt: r.createdAt,
    }));

    return createSuccessResponse({ roles: formatted }, request);
  } catch (err) {
    console.error("[GET /api/admin/roles] error:", err);
    logEvent({
      level: "error",
      module: "ADMIN",
      action: "ROLES_LIST_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения списка ролей",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/admin/roles
 *
 * Создать новую роль с разрешениями и scope.
 *
 * @requires Permission: admin.roles.manage
 * @returns {Promise<{ success: true, role: Role }>}
 */
export async function POST(request: Request) {
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

    const validation = createRoleSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Некорректные данные роли",
        validation.error.format(),
        400,
        request
      );
    }

    const { key, name, description, permissionCodes, scope } = validation.data;

    const roleKey =
      (key || name).toLowerCase().replace(/[^a-z0-9_]/g, "_") + "_" + Date.now().toString(36);

    // Находим ID разрешений по их кодам
    const permissions = await prisma.permission.findMany({
      where: { code: { in: permissionCodes || [] } },
    });

    const newRole = await prisma.role.create({
      data: {
        key: roleKey,
        name: name.trim(),
        description: description?.trim() || null,
        isSystem: false,
        permissions: {
          create: permissions.map((p) => ({
            permissionId: p.id,
          })),
        },
        scope: scope
          ? {
            create: {
              allowedWarehouses: scope.allowedWarehouses || [],
              allowedDepartments: scope.allowedDepartments || [],
              isGlobal: scope.isGlobal ?? true,
            },
          }
          : undefined,
      },
      include: {
        permissions: { include: { permission: true } },
        scope: true,
        _count: { select: { userRoles: true } },
      },
    });

    logEvent({
      level: "audit",
      module: "ADMIN",
      action: "ROLE_CREATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: {
        roleId: newRole.id,
        roleKey: newRole.key,
        roleName: newRole.name,
        permissionsCount: permissions.length,
      },
    });

    return createSuccessResponse(
      {
        success: true,
        role: {
          id: newRole.id,
          key: newRole.key,
          name: newRole.name,
          description: newRole.description,
          isSystem: newRole.isSystem,
          userCount: 0,
          permissions: newRole.permissions.map((rp) => rp.permission.code),
          scope: newRole.scope,
        },
      },
      request,
      201
    );
  } catch (err) {
    console.error("[POST /api/admin/roles] error:", err);
    logEvent({
      level: "error",
      module: "ADMIN",
      action: "ROLE_CREATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка при создании роли",
      undefined,
      500,
      request
    );
  }
}
