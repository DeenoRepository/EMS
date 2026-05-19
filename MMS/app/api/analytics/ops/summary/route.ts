import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";

function hoursBetween(start?: Date | null, end?: Date | null) {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return null;
  return ms / (1000 * 60 * 60);
}

export async function GET() {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);

  const [failures, completedOrders, activeOrders, overdueTasks, recurringFailures] = await Promise.all([
    prisma.failureEvent.findMany({
      select: { occurredAt: true, resolvedAt: true, equipmentId: true, downtimeMinutes: true }
    }),
    prisma.workOrder.findMany({
      where: { status: "COMPLETED" },
      select: { createdAt: true, actualEndAt: true, actualCost: true, downtimeMinutes: true }
    }),
    prisma.workOrder.count({
      where: { status: { in: ["NEW", "APPROVED", "IN_PROGRESS", "ON_HOLD"] } }
    }),
    prisma.pprTask.count({ where: { status: "OVERDUE" } }),
    prisma.failureEvent.groupBy({
      by: ["equipmentId"],
      _count: { _all: true },
      orderBy: { _count: { equipmentId: "desc" } }
    })
  ]);

  const mttrValues = failures
    .map((f) => hoursBetween(f.occurredAt, f.resolvedAt))
    .filter((v): v is number => typeof v === "number");
  const mttr = mttrValues.length ? mttrValues.reduce((a, b) => a + b, 0) / mttrValues.length : 0;

  const failuresByEq = new Map<string, Date[]>();
  for (const item of failures) {
    const arr = failuresByEq.get(item.equipmentId) || [];
    arr.push(item.occurredAt);
    failuresByEq.set(item.equipmentId, arr);
  }

  const mtbfIntervalsHours: number[] = [];
  for (const dates of failuresByEq.values()) {
    dates.sort((a, b) => a.getTime() - b.getTime());
    for (let i = 1; i < dates.length; i += 1) {
      const diff = hoursBetween(dates[i - 1], dates[i]);
      if (typeof diff === "number") mtbfIntervalsHours.push(diff);
    }
  }
  const mtbf = mtbfIntervalsHours.length ? mtbfIntervalsHours.reduce((a, b) => a + b, 0) / mtbfIntervalsHours.length : 0;

  const completedForSla = await prisma.workOrder.findMany({
    where: {
      status: "COMPLETED",
      actualEndAt: { not: null },
      plannedEndAt: { not: null }
    },
    select: { actualEndAt: true, plannedEndAt: true }
  });
  const completedWithinSla = completedForSla.filter((x) => (x.actualEndAt as Date) <= (x.plannedEndAt as Date)).length;
  const completedOverSla = completedForSla.length - completedWithinSla;

  const totalDowntime = failures.reduce((sum, item) => sum + (item.downtimeMinutes || 0), 0);
  const totalRepairCost = completedOrders.reduce((sum, item) => sum + Number(item.actualCost || 0), 0);

  return NextResponse.json({
    kpi: {
      mtbfHours: Math.round(mtbf * 100) / 100,
      mttrHours: Math.round(mttr * 100) / 100,
      activeWorkOrders: activeOrders,
      overdueTasks,
      downtimeMinutes: totalDowntime,
      totalRepairCost: Math.round(totalRepairCost * 100) / 100
    },
    sla: {
      completedWithinSla,
      completedOverSla
    },
    recurringFailures: recurringFailures
      .filter((x) => x._count._all > 1)
      .slice(0, 10)
      .map((x) => ({ equipmentId: x.equipmentId, failures: x._count._all }))
  });
}
