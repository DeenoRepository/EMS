import { prisma } from "@/lib/db/prisma";

type AuditParams = {
  actor: string;
  action: string;
  entity: string;
  entityId?: string;
  payload?: unknown;
};

export async function writeAuditLog(params: AuditParams) {
  await prisma.auditLog.create({
    data: {
      actor: params.actor,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      payload: params.payload as object | undefined
    }
  });
}
