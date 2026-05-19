import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { parsePagination } from "@/lib/pagination";
import { resolveWmsScope } from "@/lib/wms/access-scope";

export async function GET(req: NextRequest) {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  if (!(scope.access === "ADMIN" || scope.access === "CENTRAL")) {
    return NextResponse.json({ error: "Журнал аудита доступен только центральному складу или администратору." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType") || "";
  const actorEmail = searchParams.get("actorEmail") || "";
  const pagination = parsePagination(searchParams, { pageSize: 50, maxPageSize: 200 });

  const where = {
    ...(entityType ? { entityType } : {}),
    ...(actorEmail ? { actorEmail: { contains: actorEmail, mode: "insensitive" as const } } : {})
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.pageSize }),
    prisma.auditLog.count({ where })
  ]);

  return NextResponse.json({ items, total, page: pagination.page, pageSize: pagination.pageSize });
}
