import { NextResponse } from "next/server";
import { auditLogMemory, logEvent } from "@/lib/telemetry/logger";

export async function GET() {
  return NextResponse.json({ logs: auditLogMemory });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entry = logEvent({
      level: body.level || "info",
      module: body.module || "SHELL",
      action: body.action || "UNKNOWN_ACTION",
      userId: body.userId,
      userEmail: body.userEmail,
      details: body.details
    });

    return NextResponse.json({ success: true, entry });
  } catch {
    return NextResponse.json({ error: "Ошибка записи лога" }, { status: 400 });
  }
}
