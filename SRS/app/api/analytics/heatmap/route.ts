import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { buildIssueFilters } from "@/lib/srs/filters";
import { getFilteredMockIssues } from "@/lib/srs/mock-jira";
const APP_TZ = process.env.APP_TIMEZONE || "Asia/Novosibirsk";
function dateKeyInTz(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}
function monthKeyInTz(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}
export async function GET(req: NextRequest) {
  await requireAnyRole(["ADMIN", "EDITOR", "VIEWER"]);
  const mode = (req.nextUrl.searchParams.get("mode") ?? "FAILURES").toUpperCase();
  const period = (req.nextUrl.searchParams.get("period") ?? "day").toLowerCase();
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const useMock = req.nextUrl.searchParams.get("mock") === "1" || process.env.USE_MOCK_DATA === "1";
  if (useMock) {
    const events = await getFilteredMockIssues(req.nextUrl.searchParams);
    const counts = new Map<string, number>();
    for (const event of events) {
      if (mode === "DOWNTIME" && !event.endAt) continue;
      const key = period === "month" ? monthKeyInTz(event.startAt) : dateKeyInTz(event.startAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return NextResponse.json({ mode, period, items: Array.from(counts.entries()).map(([date, count]) => ({ date, count })) });
  }
  const where: any = buildIssueFilters(req);
  if (from || to) {
    where.startAt = {};
    if (from) {
      const d = new Date(from);
      d.setDate(d.getDate() - 1);
      where.startAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 59, 999);
      where.startAt.lte = d;
    }
  }
  if (mode === "DOWNTIME") where.endAt = { not: null };
  const events = await prisma.issue.findMany({ select: { startAt: true }, where, orderBy: { startAt: "asc" } });
  const counts = new Map<string, number>();
  for (const event of events as any[]) {
    const key = period === "month" ? monthKeyInTz(event.startAt) : dateKeyInTz(event.startAt);
    if (period === "day") {
      if (from && key < from) continue;
      if (to && key > to) continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return NextResponse.json({ mode, period, items: Array.from(counts.entries()).map(([date, count]) => ({ date, count })) });
}
