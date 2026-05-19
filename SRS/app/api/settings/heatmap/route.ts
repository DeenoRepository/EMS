import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyRole } from "@/lib/auth/rbac";
import { addAudit } from "@/lib/srs/audit";
const schema = z.object({
  mode: z.enum(["FAILURES", "DOWNTIME"]),
  minValue: z.number().int().min(0),
  maxValue: z.number().int().min(0)
});
export async function GET(req: NextRequest) {
  await requireAnyRole(["ADMIN", "EDITOR", "VIEWER"]);
  const data = await prisma.heatmapSettings.findMany({ orderBy: { mode: "asc" } });
  return NextResponse.json(data);
}
export async function PUT(req: NextRequest) {
  const session = await requireAnyRole(["ADMIN", "EDITOR"]);
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  if (parsed.data.maxValue < parsed.data.minValue) return NextResponse.json({ error: "maxValue must be greater or equal to minValue" }, { status: 400 });
  const item = await prisma.heatmapSettings.upsert({
    where: { mode: parsed.data.mode },
    create: { ...parsed.data, updatedBy: session.email },
    update: { ...parsed.data, updatedBy: session.email }
  });
  await addAudit(session.email, "update", "heatmap_settings", item.id.toString(), parsed.data);
  return NextResponse.json(item);
}
