export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { getSession, hasRole } from "@/lib/server/session";
import { buildIssueFilters } from "@/lib/server/filters";
import { getFilteredMockIssues } from "@/lib/server/mock-jira";

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

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session.roles, ["ADMIN", "ANALYST", "VIEWER"])) return fail("forbidden", 403);

  const date = req.nextUrl.searchParams.get("date");
  if (!date) return fail("date is required");
  const useMock = req.nextUrl.searchParams.get("mock") === "1" || process.env.USE_MOCK_DATA === "1";
  if (useMock) {
    const items = await getFilteredMockIssues(req.nextUrl.searchParams);
    const result = items.filter((x) => dateKeyInTz(x.startAt) === date);
    return ok(result.map((x: any) => ({
      id: x.id,
      equipmentUid: x.equipmentUid,
      equipmentTitle: x.equipmentTitle,
      factoryNumber: x.factoryNumber,
      subdivision: x.subdivision,
      startAt: x.startAt,
      endAt: x.endAt,
      type: x.type,
      status: x.status,
      responsible: x.responsible,
      jiraIssueKey: x.jiraIssueKey,
      description: x.description,
      comments: x.comments
    })));
  }

  const where: any = { ...buildIssueFilters(req) };

  const items = await prisma.issue.findMany({ where, include: { equipment: true }, orderBy: { startAt: "asc" } });
  const dayItems = items.filter((x: any) => dateKeyInTz(x.startAt) === date);

  return ok(dayItems.map((x: any) => ({
    id: x.id.toString(),
    equipmentUid: x.equipment.uid,
    equipmentTitle: x.equipment.title,
    factoryNumber: "",
    subdivision: x.equipment.subdivision,
    startAt: x.startAt,
    endAt: x.endAt,
    type: x.type,
    status: x.status,
    responsible: x.responsible,
    jiraIssueKey: x.jiraIssueKey,
    description: x.description,
    comments: x.comments
  })));
}
