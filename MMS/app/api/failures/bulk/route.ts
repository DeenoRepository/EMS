import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { bulkUpdateFailuresSchema } from "@/lib/validators/schemas";
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
  const rateLimited = enforceWriteRateLimit(req, { scope: "failures:bulk-update" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const payload = bulkUpdateFailuresSchema.parse(await req.json());

  if (!payload.severity && !payload.rcaStatus && payload.owner === undefined && payload.dueDate === undefined && payload.closedAt === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const dueDate = payload.dueDate ? parseDate(payload.dueDate) : undefined;
  if (payload.dueDate && !dueDate) {
    return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 });
  }

  const explicitClosedAt = payload.closedAt ? parseDate(payload.closedAt) : undefined;
  if (payload.closedAt && !explicitClosedAt) {
    return NextResponse.json({ error: "Invalid closedAt" }, { status: 400 });
  }

  const closedAt = explicitClosedAt || (payload.rcaStatus === "CLOSED" ? new Date() : undefined);

  const before = await prisma.failureEvent.findMany({
    where: { id: { in: payload.ids } }
  });

  if (!before.length) {
    return NextResponse.json({ updated: 0 });
  }

  const updateData: {
    severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    rcaStatus?: "OPEN" | "IN_PROGRESS" | "CLOSED";
    owner?: string | null;
    dueDate?: Date;
    closedAt?: Date;
    updatedById: string;
  } = {
    updatedById: user.id
  };

  if (payload.severity) updateData.severity = payload.severity;
  if (payload.rcaStatus) updateData.rcaStatus = payload.rcaStatus;
  if (payload.owner !== undefined) updateData.owner = payload.owner;
  if (dueDate) updateData.dueDate = dueDate;
  if (closedAt) updateData.closedAt = closedAt;

  const updateResult = await prisma.failureEvent.updateMany({
    where: { id: { in: payload.ids } },
    data: updateData
  });

  await Promise.all(
    before.map((item) =>
      writeAuditLog({
        actorId: user.id,
        actorEmail: user.email,
        action: "UPDATE",
        entityType: "FailureEvent",
        entityId: item.id,
        beforeState: item,
        afterState: {
          ...item,
          ...(payload.severity ? { severity: payload.severity } : {}),
          ...(payload.rcaStatus ? { rcaStatus: payload.rcaStatus } : {}),
          ...(payload.owner !== undefined ? { owner: payload.owner } : {}),
          ...(dueDate ? { dueDate } : {}),
          ...(closedAt ? { closedAt } : {})
        }
      })
    )
  );

  return NextResponse.json({ updated: updateResult.count });
}
