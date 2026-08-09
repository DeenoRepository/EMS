import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { TimelineEvent } from "@/lib/modules/eps-advanced-store";
import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions } from "@/lib/auth/eps-rbac";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const equipmentId = searchParams.get("equipmentId");

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const permissions = await getUserEpsPermissions();
    const whereCondition: Record<string, unknown> = {};

    if (equipmentId) {
      whereCondition.equipmentId = equipmentId;
    }

    // SEC-03: Restricted event log access by department for non-unrestricted users
    if (!permissions.isUnrestricted && session.department) {
      whereCondition.equipment = {
        department: session.department
      };
    }

    const dbEvents = await prisma.equipmentEvent.findMany({
      where: whereCondition,
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
