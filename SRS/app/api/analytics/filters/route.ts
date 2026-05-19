export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { getSession, hasRole } from "@/lib/server/session";
import { buildIssueFilters } from "@/lib/server/filters";
import { getFilteredMockIssues } from "@/lib/server/mock-jira";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session.roles, ["ADMIN", "EDITOR", "VIEWER"])) return fail("forbidden", 403);

  const useMock = req.nextUrl.searchParams.get("mock") === "1" || process.env.USE_MOCK_DATA === "1";

  if (useMock) {
    const items = await getFilteredMockIssues(req.nextUrl.searchParams);
    const statuses = Array.from(new Set(items.map((x) => x.status).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
    const types = Array.from(new Set(items.map((x) => x.type).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
    const responsibles = Array.from(new Set(items.map((x) => x.responsible).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
    const subdivisions = Array.from(new Set(items.map((x) => x.subdivision).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
    const equipment = Array.from(new Set(items.map((x) => `${x.equipmentTitle} (${x.equipmentUid})`).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
    return ok({ statuses, types, responsibles, subdivisions, equipment });
  }

  const where: any = buildIssueFilters(req);
  const rows = await prisma.issue.findMany({
    where,
    include: { equipment: true },
    take: 20000,
    orderBy: { startAt: "desc" },
  });

  const statuses = (Array.from(new Set(rows.map((x: any) => x.status).filter(Boolean))) as string[]).sort((a, b) => a.localeCompare(b, "ru"));
  const types = (Array.from(new Set(rows.map((x: any) => x.type).filter(Boolean))) as string[]).sort((a, b) => a.localeCompare(b, "ru"));
  const responsibles = (Array.from(new Set(rows.map((x: any) => x.responsible ?? "").filter(Boolean))) as string[]).sort((a, b) => a.localeCompare(b, "ru"));
  const subdivisions = (Array.from(new Set(rows.map((x: any) => x.equipment.subdivision ?? "").filter(Boolean))) as string[]).sort((a, b) => a.localeCompare(b, "ru"));
  const equipment = (Array.from(new Set(rows.map((x: any) => `${x.equipment.title} (${x.equipment.uid})`).filter(Boolean))) as string[]).sort((a, b) => a.localeCompare(b, "ru"));

  return ok({ statuses, types, responsibles, subdivisions, equipment });
}
