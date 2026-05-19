import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { buildIssueFilters } from "@/lib/srs/filters";
import { getFilteredMockIssues } from "@/lib/srs/mock-jira";

export async function GET(req: NextRequest) {
  await requireAnyRole(["ADMIN", "EDITOR", "VIEWER"]);

  const useMock = req.nextUrl.searchParams.get("mock") === "1" || process.env.USE_MOCK_DATA === "1";

  if (useMock) {
    const items = await getFilteredMockIssues(req.nextUrl.searchParams);
    const statuses = Array.from(new Set(items.map((x) => x.status).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
    const types = Array.from(new Set(items.map((x) => x.type).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
    const responsibles = Array.from(new Set(items.map((x) => x.responsible).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
    const subdivisions = Array.from(new Set(items.map((x) => x.subdivision).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
    const equipment = Array.from(new Set(items.map((x) => `${x.equipmentTitle} (${x.equipmentUid})`).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
    return NextResponse.json({ statuses, types, responsibles, subdivisions, equipment });
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

  return NextResponse.json({ statuses, types, responsibles, subdivisions, equipment });
}
