import { prisma } from "@/lib/prisma";

export async function addAudit(actor: string, action: string, entity: string, entityId?: string, payload?: unknown) {
  await prisma.auditLog.create({
    data: {
      actor,
      action,
      entity,
      entityId,
      payload: payload as any
    }
  });
}
