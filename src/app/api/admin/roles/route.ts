import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

// GET /api/admin/roles — Список ролей с разрешениями и подсчетом пользователей
export async function GET() {
  try {
    const session = await getSession();
    if (!session || (!session.roles.includes("ADMIN") && !session.permissions?.includes("admin.roles.manage"))) {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

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

    return NextResponse.json({ success: true, roles: formatted });
  } catch (err) {
    console.error("[GET /api/admin/roles] error:", err);
    return NextResponse.json({ error: "Ошибка получения списка ролей" }, { status: 500 });
  }
}

// POST /api/admin/roles — Создание новой роли с разрешениями и scope
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.roles.includes("ADMIN") && !session.permissions?.includes("admin.roles.manage"))) {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const body = await request.json();
    const { key, name, description, permissionCodes, scope } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Название роли обязательно" }, { status: 400 });
    }

    const roleKey = (key || name).toLowerCase().replace(/[^a-z0-9_]/g, "_") + "_" + Date.now().toString(36);

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

    return NextResponse.json({
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
    });
  } catch (err) {
    console.error("[POST /api/admin/roles] error:", err);
    return NextResponse.json({ error: "Ошибка при создании роли" }, { status: 500 });
  }
}
