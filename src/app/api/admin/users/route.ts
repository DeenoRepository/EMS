import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

// GET /api/admin/users — Получение списка пользователей с привязанными ролями
export async function GET() {
  try {
    const session = await getSession();
    if (!session || (!session.roles.includes("ADMIN") && !session.permissions?.includes("admin.roles.manage"))) {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

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

    return NextResponse.json({ success: true, users: formatted });
  } catch (err) {
    console.error("[GET /api/admin/users] error:", err);
    return NextResponse.json({ error: "Ошибка получения списка пользователей" }, { status: 500 });
  }
}

// PUT /api/admin/users — Обновление назначенных ролей пользователя
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.roles.includes("ADMIN") && !session.permissions?.includes("admin.roles.manage"))) {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, roleKeys } = body;

    if (!userId || !Array.isArray(roleKeys)) {
      return NextResponse.json({ error: "Неверные параметры запроса" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
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

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser?.id,
        name: updatedUser?.displayName,
        email: updatedUser?.email,
        roles: updatedUser?.userRoles.map((ur) => ({ id: ur.role.id, key: ur.role.key, name: ur.role.name })),
        roleKeys: updatedUser?.userRoles.map((ur) => ur.role.key),
      },
    });
  } catch (err) {
    console.error("[PUT /api/admin/users] error:", err);
    return NextResponse.json({ error: "Ошибка при обновлении ролей пользователя" }, { status: 500 });
  }
}
