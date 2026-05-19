import { prisma } from "@/lib/db/prisma";

export async function addAudit(actor: string, action: string, entity: string, entityId?: string, payload?: unknown) {
  await prisma.auditLog.create({
    data: {
      actor,
      action,
      entity,
      entityId,
      payload: payload as object | undefined
    }
  });
}
