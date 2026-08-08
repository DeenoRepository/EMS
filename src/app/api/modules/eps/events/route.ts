import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { MOCK_EVENTS, TimelineEvent } from "@/lib/modules/eps-advanced-store";
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const equipmentId = searchParams.get("equipmentId");

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const dbEvents = await prisma.equipmentEvent.findMany({
      where: equipmentId ? { equipmentId } : undefined,
      orderBy: { createdAt: "desc" }
    });

    const items: TimelineEvent[] = dbEvents.map((evt) => ({
      id: evt.id,
      equipmentId: evt.equipmentId,
      eventType: evt.eventType as TimelineEvent["eventType"],
      title: evt.title,
      description: evt.description || "",
      actor: evt.actorId || "system@ems.local",
      createdAt: evt.createdAt.toISOString()
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("EPS Events DB query failed:", err);
    return NextResponse.json({ error: "Ошибка базы данных при загрузке событий" }, { status: 500 });
  }
}
