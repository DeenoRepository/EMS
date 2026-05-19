import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { bulkUpdatePprTasksSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export async function PATCH(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "ppr-task:bulk-update" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const payload = bulkUpdatePprTasksSchema.parse(await req.json());

  if (!payload.status && !payload.performedAt && !payload.scheduledDate) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const performedAt = payload.performedAt ? parseDate(payload.performedAt) : payload.status === "COMPLETED" ? new Date() : undefined;
  const scheduledDate = payload.scheduledDate ? parseDate(payload.scheduledDate) : undefined;
  if (payload.performedAt && !performedAt) {
    return NextResponse.json({ error: "Invalid performedAt" }, { status: 400 });
  }
  if (payload.scheduledDate && !scheduledDate) {
    return NextResponse.json({ error: "Invalid scheduledDate" }, { status: 400 });
  }

  const before = await prisma.pprTask.findMany({
    where: { id: { in: payload.ids } }
  });

  if (!before.length) {
    return NextResponse.json({ updated: 0 });
  }

  const updateData: {
    status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED" | "OVERDUE";
    performedAt?: Date;
    scheduledDate?: Date;
    updatedById: string;
  } = {
    updatedById: user.id
  };
  if (payload.status) updateData.status = payload.status;
  if (performedAt) updateData.performedAt = performedAt;
  if (scheduledDate) updateData.scheduledDate = scheduledDate;

  const updateResult = await prisma.pprTask.updateMany({
    where: { id: { in: payload.ids } },
    data: updateData
  });

  await Promise.all(
    before.map((item) =>
      writeAuditLog({
        actorId: user.id,
        actorEmail: user.email,
        action: "UPDATE",
        entityType: "PprTask",
        entityId: item.id,
        beforeState: item,
        afterState: {
          ...item,
          ...(payload.status ? { status: payload.status } : {}),
          ...(performedAt ? { performedAt } : {}),
          ...(scheduledDate ? { scheduledDate } : {})
        }
      })
    )
  );

  return NextResponse.json({ updated: updateResult.count });
}
