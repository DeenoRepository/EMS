import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auditLogMemory, logEvent } from "@/lib/telemetry/logger";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";

export async function GET() {
  const session = await getSession();
  if (!session || !hasRole(session, ["ADMIN"])) {
    return NextResponse.json({ error: "Отказано в доступе. Требуются права администратора." }, { status: 403 });
  }

  try {
    const dbLogs = await prisma.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: { displayName: true, email: true }
        }
      }
    });

    const formattedLogs = dbLogs.map((log) => ({
      timestamp: log.createdAt.toISOString(),
      level: "audit",
      module: log.entityType,
      action: log.action,
      userId: log.actorId || undefined,
      userEmail: log.actorEmail || log.actor?.email || undefined,
      details: (log.metadata as Record<string, unknown>) || undefined,
      ip: log.ipAddress || undefined
    }));

    return NextResponse.json({ logs: formattedLogs });
  } catch (error) {
    console.warn("[Admin Audit GET] Falling back to in-memory audit logs due to DB error:", error);
    return NextResponse.json({ logs: auditLogMemory });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasRole(session, ["ADMIN"])) {
      return NextResponse.json({ error: "Отказано в доступе. Требуются права администратора." }, { status: 403 });
    }

    const body = await request.json();
    const entry = logEvent({
      level: body.level || "info",
      module: body.module || "SHELL",
      action: body.action || "UNKNOWN_ACTION",
      userId: body.userId || session.id,
      userEmail: body.userEmail || session.email,
      details: body.details
    });

    return NextResponse.json({ success: true, entry });
  } catch {
    return NextResponse.json({ error: "Ошибка записи лога" }, { status: 400 });
  }
}
