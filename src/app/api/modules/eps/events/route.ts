import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { MOCK_EVENTS, TimelineEvent } from "@/lib/modules/eps-advanced-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const equipmentId = searchParams.get("equipmentId");

  try {
    const dbEvents = await prisma.equipmentEvent.findMany({
      where: equipmentId ? { equipmentId } : undefined,
      orderBy: { createdAt: "desc" }
    });

    if (dbEvents.length > 0) {
      const items: TimelineEvent[] = dbEvents.map((evt) => ({
        id: evt.id,
        equipmentId: evt.equipmentId,
        eventType: evt.eventType as TimelineEvent["eventType"],
        title: evt.title,
        description: evt.description || "",
        actor: "system@ems.local",
        createdAt: evt.createdAt.toISOString()
      }));

      return NextResponse.json({ items });
    }
  } catch {
    // Fallback if DB unavailable
  }

  let mockEvents = MOCK_EVENTS;
  if (equipmentId) {
    mockEvents = mockEvents.filter((evt) => evt.equipmentId === equipmentId);
  }

  return NextResponse.json({ items: mockEvents });
}
