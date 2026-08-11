import { NextResponse } from "next/server";
import { getGroupedPermissions, SYSTEM_PERMISSIONS } from "@/lib/auth/permissions-registry";
import { getSession } from "@/lib/auth/session";

// GET /api/admin/permissions — Реестр доступных системных прав и разрешений
export async function GET() {
  try {
    const session = await getSession();
    if (!session || (!session.roles.includes("ADMIN") && !session.permissions?.includes("admin.roles.manage"))) {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const grouped = getGroupedPermissions();
    return NextResponse.json({
      success: true,
      permissions: SYSTEM_PERMISSIONS,
      groupedPermissions: grouped,
    });
  } catch (err) {
    console.error("[GET /api/admin/permissions] error:", err);
    return NextResponse.json({ error: "Ошибка получения каталога разрешений" }, { status: 500 });
  }
}
