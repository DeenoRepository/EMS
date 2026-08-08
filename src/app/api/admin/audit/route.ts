import { NextResponse } from "next/server";
import { auditLogMemory, logEvent } from "@/lib/telemetry/logger";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";

export async function GET() {
  const session = await getSession();
  if (!session || !hasRole(session, ["ADMIN"])) {
    return NextResponse.json({ error: "Отказано в доступе. Требуются права администратора." }, { status: 403 });
  }

  return NextResponse.json({ logs: auditLogMemory });
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
