export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { getSession, hasRole } from "@/lib/server/session";
import { buildIssueFilters } from "@/lib/server/filters";
import { getFilteredMockIssues } from "@/lib/server/mock-jira";

type Row = {
  id: string;
  jiraIssueKey: string;
  responsible: string;
  status: string;
  type: string;
  equipmentTitle: string;
  equipmentUid: string;
  subdivision: string;
  startAt: Date;
  endAt: Date | null;
  isInProgress: boolean;
  description: string;
};

function toHours(startAt: Date, endAt: Date | null) {
  if (!endAt) return 0;
  return Math.max(0, (endAt.getTime() - startAt.getTime()) / 3_600_000);
}

function peakHour(rows: Row[]) {
  const hours = new Map<number, number>();
  for (const x of rows) {
    const h = x.startAt.getHours();
    hours.set(h, (hours.get(h) ?? 0) + 1);
  }
  let peak = -1;
  let count = 0;
  for (const [h, c] of hours.entries()) {
    if (c > count) {
      peak = h;
      count = c;
    }
  }
  return {
    hour: peak >= 0 ? `${peak.toString().padStart(2, "0")}:00` : null,
    events: count,
  };
}

function aggregate(rows: Row[]) {
  const totalEvents = rows.length;
  const inProgress = rows.filter((x) => x.isInProgress).length;
  const completed = totalEvents - inProgress;
  const downtimeHours = rows.reduce((acc, x) => acc + toHours(x.startAt, x.endAt), 0);
  const avgDowntimeHours = totalEvents > 0 ? downtimeHours / totalEvents : 0;
  const p = peakHour(rows);
  return {
    totalEvents,
    inProgress,
    completed,
    downtimeHours: Number(downtimeHours.toFixed(2)),
    avgDowntimeHours: Number(avgDowntimeHours.toFixed(2)),
    peakHour: p.hour,
    peakHourEvents: p.events,
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session.roles, ["ADMIN", "EDITOR", "VIEWER"])) return fail("forbidden", 403);

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) return fail("from and to are required");

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return fail("invalid date range");
  toDate.setHours(23, 59, 59, 999);

  const useMock = req.nextUrl.searchParams.get("mock") === "1" || process.env.USE_MOCK_DATA === "1";
  let rows: Row[] = [];

  if (useMock) {
    const items = await getFilteredMockIssues(req.nextUrl.searchParams);
    rows = items
      .filter((x: any) => x.startAt >= fromDate && x.startAt <= toDate)
      .map((x: any) => ({
        id: x.id,
        jiraIssueKey: x.jiraIssueKey,
        responsible: x.responsible || "Не указан",
        status: x.status,
        type: x.type,
        equipmentTitle: x.equipmentTitle,
        equipmentUid: x.equipmentUid,
        subdivision: x.subdivision || "Не указана",
        startAt: x.startAt,
        endAt: x.endAt,
        isInProgress: x.isInProgress,
        description: x.description || "",
      }));
  } else {
    const where: any = {
      ...buildIssueFilters(req),
      startAt: { gte: fromDate, lte: toDate },
    };
    const issues = await prisma.issue.findMany({
      where,
      include: { equipment: true },
      orderBy: { startAt: "desc" },
      take: 100000,
    });
    rows = issues.map((x: any) => ({
      id: String(x.id),
      jiraIssueKey: x.jiraIssueKey ?? "-",
      responsible: x.responsible || "Не указан",
      status: x.status,
      type: x.type,
      equipmentTitle: x.equipment.title,
      equipmentUid: x.equipment.uid,
      subdivision: x.equipment.subdivision || "Не указана",
      startAt: x.startAt,
      endAt: x.endAt,
      isInProgress: x.isInProgress,
      description: x.description || "",
    }));
  }

  const summaryBase = aggregate(rows);
  const peopleMap = new Map<string, Row[]>();
  for (const row of rows) {
    const key = row.responsible || "Не указан";
    if (!peopleMap.has(key)) peopleMap.set(key, []);
    peopleMap.get(key)!.push(row);
  }

  const employees = Array.from(peopleMap.entries())
    .map(([name, items]) => {
      const a = aggregate(items);
      const equipmentCount = new Set(items.map((x: any) => `${x.equipmentTitle}::${x.equipmentUid}`)).size;
      return {
        name,
        ...a,
        affectedEquipmentCount: equipmentCount,
      };
    })
    .sort((a, b) => {
      if (b.totalEvents !== a.totalEvents) return b.totalEvents - a.totalEvents;
      return a.name.localeCompare(b.name, "ru");
    });

  const events = rows
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
    .slice(0, 400)
    .map((x) => ({
      id: x.id,
      jiraIssueKey: x.jiraIssueKey,
      responsible: x.responsible,
      status: x.status,
      type: x.type,
      equipmentTitle: x.equipmentTitle,
      equipmentUid: x.equipmentUid,
      subdivision: x.subdivision,
      startAt: x.startAt,
      endAt: x.endAt,
      isInProgress: x.isInProgress,
      durationHours: Number(toHours(x.startAt, x.endAt).toFixed(2)),
      description: x.description,
    }));

  return ok({
    summary: {
      ...summaryBase,
      totalEmployees: employees.length,
    },
    employees,
    events,
  });
}

