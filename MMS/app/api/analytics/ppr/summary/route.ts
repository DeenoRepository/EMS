import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);

  const [plansTotal, plansActive, plansPaused, plansArchived] = await Promise.all([
    prisma.pprPlan.count(),
    prisma.pprPlan.count({ where: { status: "ACTIVE" } }),
    prisma.pprPlan.count({ where: { status: "PAUSED" } }),
    prisma.pprPlan.count({ where: { status: "ARCHIVED" } })
  ]);

  const [tasksTotal, planned, inProgress, completed, overdue] = await Promise.all([
    prisma.pprTask.count(),
    prisma.pprTask.count({ where: { status: "PLANNED" } }),
    prisma.pprTask.count({ where: { status: "IN_PROGRESS" } }),
    prisma.pprTask.count({ where: { status: "COMPLETED" } }),
    prisma.pprTask.count({ where: { status: "OVERDUE" } })
  ]);

  const byMaintenanceTypeRows = await prisma.pprTask.groupBy({
    by: ["maintenanceType"],
    _count: { _all: true }
  });

  const now = new Date();
  const fromDate = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 5, 1));
  const monthlyTasks = await prisma.pprTask.findMany({
    where: { scheduledDate: { gte: fromDate } },
    select: { scheduledDate: true, status: true }
  });

  const monthly = new Map<string, { planned: number; completed: number }>();
  for (let i = 0; i < 6; i += 1) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthly.set(monthKey(month), { planned: 0, completed: 0 });
  }

  for (const task of monthlyTasks) {
    const key = monthKey(task.scheduledDate);
    const bucket = monthly.get(key);
    if (!bucket) continue;
    bucket.planned += 1;
    if (task.status === "COMPLETED") bucket.completed += 1;
  }

  const [upcomingTasks, overdueTasks] = await Promise.all([
    prisma.pprTask.findMany({
      where: {
        status: { in: ["PLANNED", "IN_PROGRESS"] },
        scheduledDate: { gte: new Date(), lte: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14) }
      },
      orderBy: { scheduledDate: "asc" },
      take: 10,
      select: { id: true, equipmentId: true, scheduledDate: true, maintenanceType: true, status: true }
    }),
    prisma.pprTask.findMany({
      where: { status: "OVERDUE" },
      orderBy: { scheduledDate: "asc" },
      take: 10,
      select: { id: true, equipmentId: true, scheduledDate: true, maintenanceType: true, status: true }
    })
  ]);

  return NextResponse.json({
    plans: {
      total: plansTotal,
      active: plansActive,
      paused: plansPaused,
      archived: plansArchived
    },
    tasks: {
      total: tasksTotal,
      planned,
      inProgress,
      completed,
      overdue
    },
    byMaintenanceType: byMaintenanceTypeRows.map((row) => ({
      maintenanceType: row.maintenanceType,
      count: row._count._all
    })),
    byMonth: [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({
        month,
        planned: value.planned,
        completed: value.completed
      })),
    upcomingTasks,
    overdueTasks
  });
}
