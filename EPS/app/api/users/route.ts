import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { enforceSameOrigin } from "@/lib/security/request";
import { z } from "zod";

const roleAssignSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["VIEWER", "EDITOR", "APPROVER", "ADMIN"])
});

export async function GET() {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      email: true,
      displayName: true,
      userRoles: {
        select: {
          role: {
            select: {
              key: true
            }
          }
        }
      }
    },
    orderBy: { displayName: "asc" }
  });

  return NextResponse.json(
    users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.userRoles.map((item) => item.role.key)
    }))
  );
}

export async function PATCH(req: NextRequest) {
  enforceSameOrigin(req);
  const actor = await requireAnyRole(["ADMIN"]);
  const parsed = roleAssignSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные назначения роли" }, { status: 400 });
  }

  const { userId, role } = parsed.data;
  const roles = ["VIEWER", "EDITOR", "APPROVER", "ADMIN"] as const;

  const updated = await prisma.$transaction(async (tx) => {
    await Promise.all(
      roles.map((key) =>
        tx.role.upsert({
          where: { key },
          update: {},
          create: { key, name: key }
        })
      )
    );

    const targetUser = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true }
    });

    if (!targetUser) {
      return null;
    }

    const roleRecord = await tx.role.findUnique({ where: { key: role } });
    if (!roleRecord) {
      return null;
    }

    await tx.userRole.deleteMany({ where: { userId } });
    await tx.userRole.create({
      data: {
        userId,
        roleId: roleRecord.id
      }
    });

    return {
      id: targetUser.id,
      email: targetUser.email,
      displayName: targetUser.displayName,
      roles: [role]
    };
  });

  if (!updated) {
    return NextResponse.json({ error: "Пользователь или роль не найдены" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    user: updated,
    message: `Роль пользователя обновлена (${actor.email} -> ${updated.email}: ${role})`
  });
}
