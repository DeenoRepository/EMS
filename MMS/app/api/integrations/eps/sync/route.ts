import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { syncEquipmentSchema } from "@/lib/validators/schemas";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { writeAuditLog } from "@/lib/audit";
import { syncEquipmentAndGeneratePlans } from "@/lib/integrations/equipment-sync";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "eps:sync-equipment", limit: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const payload = syncEquipmentSchema.parse(await req.json().catch(() => ({})));

  const result = await syncEquipmentAndGeneratePlans({
    pageSize: payload.pageSize,
    maxPages: payload.maxPages,
    actorId: user.id
  });

  await prisma.syncState.upsert({
    where: { key: "equipment_registry" },
    update: {
      status: "SUCCESS",
      message: `manual upserted=${result.upserted}, plans=${result.createdPlans}, tasks=${result.createdTasks}`,
      lastFinishedAt: new Date(),
      lastSuccessAt: new Date()
    },
    create: {
      key: "equipment_registry",
      status: "SUCCESS",
      message: `manual upserted=${result.upserted}, plans=${result.createdPlans}, tasks=${result.createdTasks}`,
      lastStartedAt: new Date(),
      lastFinishedAt: new Date(),
      lastSuccessAt: new Date()
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "INTEGRATION",
    entityType: "EpsEquipmentSync",
    entityId: String(Date.now()),
    metadata: result
  });

  return NextResponse.json(result);
}
