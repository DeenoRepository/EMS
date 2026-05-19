import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { generatePlansFromRegistrySchema } from "@/lib/validators/schemas";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "ppr:generate-from-registry", limit: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const payload = generatePlansFromRegistrySchema.parse(await req.json().catch(() => ({})));

  const equipment = await prisma.syncedEquipment.findMany({
    where: {
      ...(payload.statusFilter?.length ? { status: { in: payload.statusFilter } } : {}),
      ...(payload.lifecycleFilter?.length ? { lifecycleStage: { in: payload.lifecycleFilter } } : {})
    }
  });

  let createdPlans = 0;
  let createdTasks = 0;

  for (const eq of equipment) {
    const existingActive = await prisma.pprPlan.findFirst({
      where: {
        equipmentId: eq.id,
        status: { in: ["ACTIVE", "PAUSED"] }
      }
    });

    if (existingActive) continue;

    const lastServiceDate = new Date();
    const nextServiceDate = new Date();
    nextServiceDate.setDate(nextServiceDate.getDate() + payload.intervalDays);

    if (!payload.dryRun) {
      const plan = await prisma.pprPlan.create({
        data: {
          equipmentId: eq.id,
          equipmentCode: eq.equipmentCode,
          equipmentName: eq.name,
          maintenanceType: payload.maintenanceType,
          intervalDays: payload.intervalDays,
          horizonMonths: payload.horizonMonths,
          lastServiceDate,
          nextServiceDate,
          comments: "Автосформировано по синхронизированному реестру EPS",
          status: "ACTIVE",
          createdById: user.id,
          updatedById: user.id
        }
      });
      createdPlans += 1;

      const horizonEnd = new Date();
      horizonEnd.setMonth(horizonEnd.getMonth() + payload.horizonMonths);
      let cursor = new Date(nextServiceDate);
      const rows: Array<{ scheduledDate: Date }> = [];
      while (cursor <= horizonEnd) {
        rows.push({ scheduledDate: new Date(cursor) });
        cursor.setDate(cursor.getDate() + payload.intervalDays);
      }

      if (rows.length) {
        await prisma.pprTask.createMany({
          data: rows.map((row) => ({
            planId: plan.id,
            equipmentId: eq.id,
            scheduledDate: row.scheduledDate,
            maintenanceType: payload.maintenanceType,
            status: row.scheduledDate < new Date() ? "OVERDUE" : "PLANNED",
            createdById: user.id,
            updatedById: user.id
          }))
        });
        createdTasks += rows.length;
      }
    } else {
      createdPlans += 1;
      const horizonDays = payload.horizonMonths * 30;
      createdTasks += Math.max(1, Math.floor(horizonDays / payload.intervalDays));
    }
  }

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE",
    entityType: "RegistryPprGeneration",
    entityId: String(Date.now()),
    metadata: {
      dryRun: payload.dryRun,
      equipmentCount: equipment.length,
      createdPlans,
      createdTasks
    }
  });

  return NextResponse.json({
    ok: true,
    dryRun: payload.dryRun,
    equipmentCount: equipment.length,
    createdPlans,
    createdTasks
  });
}
