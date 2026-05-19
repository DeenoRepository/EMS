export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, hasRole } from "@/lib/server/session";
import { addAudit } from "@/lib/server/audit";

const schema = z.object({
  mode: z.enum(["FAILURES", "DOWNTIME"]),
  minValue: z.number().int().min(0),
  maxValue: z.number().int().min(0)
});

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session.roles, ["ADMIN", "ANALYST", "VIEWER"])) return fail("forbidden", 403);

  const data = await prisma.heatmapSettings.findMany({ orderBy: { mode: "asc" } });
  return ok(data);
}

export async function PUT(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session.roles, ["ADMIN", "ANALYST"])) return fail("forbidden", 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail(parsed.error.message);
  if (parsed.data.maxValue < parsed.data.minValue) return fail("maxValue must be greater or equal to minValue");

  const item = await prisma.heatmapSettings.upsert({
    where: { mode: parsed.data.mode },
    create: { ...parsed.data, updatedBy: session.login },
    update: { ...parsed.data, updatedBy: session.login }
  });

  await addAudit(session.login, "update", "heatmap_settings", item.id.toString(), parsed.data);
  return ok(item);
}
