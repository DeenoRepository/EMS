export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { getSession, hasRole } from "@/lib/server/session";
import { buildIssueFilters } from "@/lib/server/filters";
import { getFilteredMockIssues } from "@/lib/server/mock-jira";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session.roles, ["ADMIN", "ANALYST", "VIEWER"])) return fail("forbidden", 403);

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) return fail("from and to are required");

  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return fail("invalid date range");
  const useMock = req.nextUrl.searchParams.get("mock") === "1" || process.env.USE_MOCK_DATA === "1";

  if (useMock) {
    const items = await getFilteredMockIssues(req.nextUrl.searchParams);
    const inRange = items.filter((x) => x.startAt >= start && x.startAt <= end);
    const events = inRange.length;
    const inProgress = inRange.filter((x) => x.isInProgress).length;
    const done = inRange.filter((x) => x.endAt);
    const downtimeHours = done.reduce((acc: number, x: any) => acc + ((x.endAt!.getTime() - x.startAt.getTime()) / 3_600_000), 0);
    const equipmentSet = new Set(inRange.map((x) => x.equipmentUid));
    const impacted = equipmentSet.size;

    const hourBuckets = new Map<number, number>();
    for (const item of done) {
      const h = item.startAt.getHours();
      hourBuckets.set(h, (hourBuckets.get(h) ?? 0) + 1);
    }
    let peakHour = -1;
    let peakHourEvents = 0;
    for (const [hour, count] of hourBuckets) {
      if (count > peakHourEvents) {
        peakHour = hour;
        peakHourEvents = count;
      }
    }

    return ok({
      totalEvents: events,
      equipmentTotal: impacted,
      inProgress,
      downtimeHours: Number(downtimeHours.toFixed(2)),
      affectedEquipmentCount: impacted,
      impactSharePercent: 100,
      avgDowntimeHours: events === 0 ? 0 : Number((downtimeHours / events).toFixed(2)),
      peakHour: peakHour >= 0 ? `${peakHour.toString().padStart(2, "0")}:00` : null,
      peakHourEvents
    });
  }

  const filterWhere = buildIssueFilters(req);
  const where: any = { ...filterWhere, startAt: { gte: start, lte: end } };

  const [events, equipments, inProgress, fullItems] = await Promise.all([
    prisma.issue.count({ where }),
    prisma.equipment.count(),
    prisma.issue.count({ where: { ...where, isInProgress: true } }),
    prisma.issue.findMany({ where: { ...where, endAt: { not: null } }, select: { startAt: true, endAt: true } })
  ]);

  const downtimeHours = fullItems.reduce((acc: number, item: any) => {
    if (!item.endAt) return acc;
    return acc + (item.endAt.getTime() - item.startAt.getTime()) / 3_600_000;
  }, 0);

  const affectedEquipment = await prisma.issue.findMany({ where, distinct: ["equipmentId"], select: { equipmentId: true } });
  const impactShare = equipments === 0 ? 0 : (affectedEquipment.length / equipments) * 100;

  const hourBuckets = new Map<number, number>();
  for (const item of fullItems) {
    const h = item.startAt.getHours();
    hourBuckets.set(h, (hourBuckets.get(h) ?? 0) + 1);
  }
  let peakHour = -1;
  let peakHourEvents = 0;
  for (const [hour, count] of hourBuckets) {
    if (count > peakHourEvents) {
      peakHour = hour;
      peakHourEvents = count;
    }
  }

  return ok({
    totalEvents: events,
    equipmentTotal: equipments,
    inProgress,
    downtimeHours: Number(downtimeHours.toFixed(2)),
    affectedEquipmentCount: affectedEquipment.length,
    impactSharePercent: Number(impactShare.toFixed(2)),
    avgDowntimeHours: events === 0 ? 0 : Number((downtimeHours / events).toFixed(2)),
    peakHour: peakHour >= 0 ? `${peakHour.toString().padStart(2, "0")}:00` : null,
    peakHourEvents
  });
}
