import { AuditAction } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";

type AuditParams = {
  actorId?: string;
  actorEmail?: string | null;
  action: "CREATE" | "UPDATE" | "DELETE" | "INTEGRATION";
  entityType: string;
  entityId: string;
  beforeState?: unknown;
  afterState?: unknown;
  metadata?: unknown;
};

const ACTION_MAP: Record<string, AuditAction> = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  INTEGRATION: "EXPORT"
};

export async function writeAudit(params: AuditParams) {
  try {
    await writeAuditLog({
      actorId: params.actorId,
      actorEmail: params.actorEmail || undefined,
      action: ACTION_MAP[params.action] || "UPDATE",
      entityType: params.entityType,
      entityId: params.entityId,
      beforeState: params.beforeState,
      afterState: params.afterState,
      metadata: params.metadata
    });
  } catch (error) {
    console.error("[WMS] Audit log write failed:", error);
  }
}
