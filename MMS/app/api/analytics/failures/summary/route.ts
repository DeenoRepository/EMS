import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);

  const [total, openRca, inProgressRca, critical] = await Promise.all([
    prisma.failureEvent.count(),
    prisma.failureEvent.count({ where: { rcaStatus: "OPEN" } }),
    prisma.failureEvent.count({ where: { rcaStatus: "IN_PROGRESS" } }),
    prisma.failureEvent.count({ where: { severity: "CRITICAL" } })
  ]);

  const all = await prisma.failureEvent.findMany({
    select: {
      occurredAt: true,
      downtimeMinutes: true,
      rootCauseCategory: true,
      severity: true
    }
  });

  const totalDowntime = all.reduce((sum, item) => sum + (item.downtimeMinutes || 0), 0);
  const avgDowntime = total > 0 ? Math.round((totalDowntime / total) * 100) / 100 : 0;

  const byCauseMap = new Map<string, number>();
  const bySeverityMap = new Map<string, number>();
  const trendMap = new Map<string, number>();

  for (const item of all) {
    const cause = (item.rootCauseCategory || "UNSPECIFIED").trim() || "UNSPECIFIED";
    byCauseMap.set(cause, (byCauseMap.get(cause) || 0) + 1);
    bySeverityMap.set(item.severity, (bySeverityMap.get(item.severity) || 0) + 1);
    const key = monthKey(item.occurredAt);
    trendMap.set(key, (trendMap.get(key) || 0) + 1);
  }

  const byCause = [...byCauseMap.entries()]
    .map(([cause, count]) => ({ cause, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const bySeverity = [...bySeverityMap.entries()]
    .map(([severity, count]) => ({ severity, count }))
    .sort((a, b) => b.count - a.count);

  const trendByMonth = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  return NextResponse.json({
    total,
    openRca,
    inProgressRca,
    critical,
    totalDowntime,
    avgDowntime,
    byCause,
    bySeverity,
    trendByMonth
  });
}
