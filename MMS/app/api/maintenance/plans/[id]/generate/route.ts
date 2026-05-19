import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { generatePlanTasksSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "ppr-plan:generate" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const { id } = await params;
  const payload = generatePlanTasksSchema.parse(await req.json().catch(() => ({})));

  const plan = await prisma.pprPlan.findUnique({ where: { id } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (plan.status !== "ACTIVE") {
    return NextResponse.json({ error: "План не активен" }, { status: 409 });
  }

  if (payload.replaceFutureTasks) {
    await prisma.pprTask.deleteMany({
      where: {
        planId: id,
        scheduledDate: { gte: new Date() },
        status: { in: ["PLANNED", "IN_PROGRESS", "OVERDUE"] }
      }
    });
  }

  const horizonEnd = new Date();
  horizonEnd.setMonth(horizonEnd.getMonth() + plan.horizonMonths);

  const rows: Array<{ scheduledDate: Date; maintenanceType: typeof plan.maintenanceType }> = [];
  let cursor = new Date(plan.nextServiceDate);
  while (rows.length < payload.limit && cursor <= horizonEnd) {
    rows.push({ scheduledDate: new Date(cursor), maintenanceType: plan.maintenanceType });
    cursor.setDate(cursor.getDate() + plan.intervalDays);
  }

  if (rows.length === 0) {
    return NextResponse.json({ created: 0, skipped: true });
  }

  const existing = await prisma.pprTask.findMany({
    where: {
      planId: id,
      scheduledDate: { in: rows.map((row) => row.scheduledDate) }
    },
    select: { scheduledDate: true }
  });

  const existingTs = new Set(existing.map((item) => item.scheduledDate.getTime()));
  const toCreate = rows.filter((row) => !existingTs.has(row.scheduledDate.getTime()));

  if (toCreate.length > 0) {
    await prisma.pprTask.createMany({
      data: toCreate.map((row) => ({
        planId: plan.id,
        equipmentId: plan.equipmentId,
        scheduledDate: row.scheduledDate,
        maintenanceType: row.maintenanceType,
        status: row.scheduledDate < new Date() ? "OVERDUE" : "PLANNED",
        createdById: user.id,
        updatedById: user.id
      }))
    });
  }

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE",
    entityType: "PprPlanGeneration",
    entityId: plan.id,
    metadata: {
      created: toCreate.length,
      totalCandidates: rows.length,
      limit: payload.limit,
      replaceFutureTasks: payload.replaceFutureTasks
    }
  });

  return NextResponse.json({ created: toCreate.length, totalCandidates: rows.length });
}
