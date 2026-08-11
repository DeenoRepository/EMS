import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

// GET /api/admin/roles/[id] — Получение детальной информации о роли
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (!session.roles.includes("ADMIN") && !session.permissions?.includes("admin.roles.manage"))) {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const { id } = await params;
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        scope: true,
        _count: { select: { userRoles: true } },
      },
    });

    if (!role) {
      return NextResponse.json({ error: "Роль не найдена" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      role: {
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        userCount: role._count.userRoles,
        permissions: role.permissions.map((rp) => rp.permission.code),
        scope: role.scope
          ? {
              allowedWarehouses: (role.scope.allowedWarehouses as string[]) || [],
              allowedDepartments: (role.scope.allowedDepartments as string[]) || [],
              isGlobal: role.scope.isGlobal,
            }
          : { allowedWarehouses: [], allowedDepartments: [], isGlobal: true },
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/roles/[id]] error:", err);
    return NextResponse.json({ error: "Ошибка получения данных роли" }, { status: 500 });
  }
}

// PUT /api/admin/roles/[id] — Обновление роли и состава её разрешений
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (!session.roles.includes("ADMIN") && !session.permissions?.includes("admin.roles.manage"))) {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, permissionCodes, scope } = body;

    const existingRole = await prisma.role.findUnique({ where: { id } });
    if (!existingRole) {
      return NextResponse.json({ error: "Роль не найдена" }, { status: 404 });
    }

    if (existingRole.isSystem && name !== existingRole.name) {
      return NextResponse.json({ error: "Системную роль нельзя переименовывать" }, { status: 400 });
    }

    // Удаляем старые разрешения роли
    await prisma.rolePermission.deleteMany({ where: { roleId: id } });

    // Находим новые разрешения по кодам
    const permissions = await prisma.permission.findMany({
      where: { code: { in: permissionCodes || [] } },
    });

    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        name: name ? name.trim() : existingRole.name,
        description: description !== undefined ? description.trim() : existingRole.description,
        permissions: {
          create: permissions.map((p) => ({ permissionId: p.id })),
        },
        scope: scope
          ? {
              upsert: {
                create: {
                  allowedWarehouses: scope.allowedWarehouses || [],
                  allowedDepartments: scope.allowedDepartments || [],
                  isGlobal: scope.isGlobal ?? true,
                },
                update: {
                  allowedWarehouses: scope.allowedWarehouses || [],
                  allowedDepartments: scope.allowedDepartments || [],
                  isGlobal: scope.isGlobal ?? true,
                },
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
        id: updatedRole.id,
        key: updatedRole.key,
        name: updatedRole.name,
        description: updatedRole.description,
        isSystem: updatedRole.isSystem,
        userCount: updatedRole._count.userRoles,
        permissions: updatedRole.permissions.map((rp) => rp.permission.code),
        scope: updatedRole.scope,
      },
    });
  } catch (err) {
    console.error("[PUT /api/admin/roles/[id]] error:", err);
    return NextResponse.json({ error: "Ошибка при обновлении роли" }, { status: 500 });
  }
}

// DELETE /api/admin/roles/[id] — Удаление кастомной роли
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (!session.roles.includes("ADMIN") && !session.permissions?.includes("admin.roles.manage"))) {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const { id } = await params;
    const existingRole = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { userRoles: true } } },
    });

    if (!existingRole) {
      return NextResponse.json({ error: "Роль не найдена" }, { status: 404 });
    }

    if (existingRole.isSystem) {
      return NextResponse.json({ error: "Запрещено удалять системные встроенные роли" }, { status: 400 });
    }

    if (existingRole._count.userRoles > 0) {
      return NextResponse.json(
        { error: `Нельзя удалить роль, назначенную ${existingRole._count.userRoles} пользователям. Сначала переназначьте их на другую роль.` },
        { status: 400 }
      );
    }

    await prisma.role.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Роль успешно удалена" });
  } catch (err) {
    console.error("[DELETE /api/admin/roles/[id]] error:", err);
    return NextResponse.json({ error: "Ошибка при удалении роли" }, { status: 500 });
  }
}
