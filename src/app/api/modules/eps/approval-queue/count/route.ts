import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ count: 0, error: "Необходима авторизация" }, { status: 401 });
    }

    const pendingCount = await prisma.approvalRequest.count({
      where: { status: "PENDING" }
    });

    return NextResponse.json({ count: pendingCount, timestamp: Date.now() });
  } catch (error) {
    console.error("[EPS Approval Queue Count] DB error:", error);
    return NextResponse.json({ count: 0, error: "Ошибка получения очереди согласований" }, { status: 500 });
  }
}
