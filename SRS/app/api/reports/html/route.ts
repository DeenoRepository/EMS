export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { getSession, hasRole } from "@/lib/server/session";
import { getFilteredMockIssues } from "@/lib/server/mock-jira";

const schema = z.object({
  from: z.string(),
  to: z.string(),
  groupBy: z.enum(["day", "month", "employee", "equipment"]),
  blocks: z.array(z.enum(["dashboard", "downtime", "employee"])).default(["dashboard"]),
  durationMinutesFrom: z.number().int().min(0).optional(),
  onlyInProgress: z.boolean().default(false)
});

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session.roles, ["ADMIN", "EDITOR", "VIEWER"])) return fail("forbidden", 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail(parsed.error.message);

  const start = new Date(parsed.data.from);
  const end = new Date(parsed.data.to);
  const useMock = req.nextUrl.searchParams.get("mock") === "1" || process.env.USE_MOCK_DATA === "1";

  let rowsFiltered: Array<{
    startAt: Date;
    endAt: Date | null;
    equipmentTitle: string;
    status: string;
    type: string;
    responsible: string;
    jiraIssueKey: string;
  }> = [];

  if (useMock) {
    const params = new URLSearchParams({
      from: parsed.data.from,
      to: parsed.data.to
    });
    const rows = await getFilteredMockIssues(params);
    rowsFiltered = rows
      .filter((r) => (parsed.data.onlyInProgress ? r.isInProgress : true))
      .filter((r) => {
        if (!parsed.data.durationMinutesFrom || !r.endAt) return true;
        const mins = (r.endAt.getTime() - r.startAt.getTime()) / 60000;
        return mins >= parsed.data.durationMinutesFrom;
      })
      .map((r) => ({
        startAt: r.startAt,
        endAt: r.endAt,
        equipmentTitle: r.equipmentTitle,
        status: r.status,
        type: r.type,
        responsible: r.responsible,
        jiraIssueKey: r.jiraIssueKey
      }));
  } else {
    const where: any = { startAt: { gte: start, lte: end } };
    if (parsed.data.onlyInProgress) where.isInProgress = true;
    const rows = await prisma.issue.findMany({ where, include: { equipment: true }, orderBy: { startAt: "asc" }, take: 5000 });
    rowsFiltered = rows.filter((r) => {
      if (!parsed.data.durationMinutesFrom || !r.endAt) return true;
      const mins = (r.endAt.getTime() - r.startAt.getTime()) / 60000;
      return mins >= parsed.data.durationMinutesFrom;
    }).map((r) => ({
      startAt: r.startAt,
      endAt: r.endAt,
      equipmentTitle: r.equipment.title,
      status: r.status,
      type: r.type,
      responsible: r.responsible ?? "",
      jiraIssueKey: r.jiraIssueKey ?? ""
    }));
  }

  const report = await prisma.reportRun.create({
    data: {
      paramsJson: parsed.data,
      createdBy: session.login
    }
  });

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>EFA Report</title><style>body{font-family:Inter,Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;font-size:12px}th{background:#f5f5f5}</style></head><body><h1>EFA Report</h1><p>Period: ${parsed.data.from} - ${parsed.data.to}</p><p>Total rows: ${rowsFiltered.length}</p><table><thead><tr><th>Start</th><th>End</th><th>Equipment</th><th>Status</th><th>Type</th><th>Responsible</th><th>Jira</th></tr></thead><tbody>${rowsFiltered.map((r)=>`<tr><td>${r.startAt.toISOString()}</td><td>${r.endAt ? r.endAt.toISOString() : ""}</td><td>${r.equipmentTitle}</td><td>${r.status}</td><td>${r.type}</td><td>${r.responsible ?? ""}</td><td>${r.jiraIssueKey ?? ""}</td></tr>`).join("")}</tbody></table></body></html>`;

  return ok({ reportId: report.id.toString(), html });
}
