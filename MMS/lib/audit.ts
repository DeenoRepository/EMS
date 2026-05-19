import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type AuditParams = {
  actorId?: string;
  actorEmail?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  beforeState?: unknown;
  afterState?: unknown;
  metadata?: unknown;
};

export async function writeAuditLog(params: AuditParams) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      actorEmail: params.actorEmail,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeState: params.beforeState as object | undefined,
      afterState: params.afterState as object | undefined,
      metadata: params.metadata as object | undefined
    }
  });
}
