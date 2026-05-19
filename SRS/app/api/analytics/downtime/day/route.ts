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
export async function GET(req: NextRequest) {
  await requireAnyRole(["ADMIN", "EDITOR", "VIEWER"]);
  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });
  const useMock = req.nextUrl.searchParams.get("mock") === "1" || process.env.USE_MOCK_DATA === "1";
  if (useMock) {
    const items = await getFilteredMockIssues(req.nextUrl.searchParams);
    const result = items.filter((x) => dateKeyInTz(x.startAt) === date);
    return NextResponse.json(result.map((x: any) => ({
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
  return NextResponse.json(dayItems.map((x: any) => ({
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
