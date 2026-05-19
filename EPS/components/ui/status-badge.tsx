import { EquipmentStatus, DocumentStatus, ApprovalStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { ru } from "@/lib/i18n";

export function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  const style = {
    DRAFT: "bg-secondary text-secondary-foreground",
    ACTIVE: "bg-success/20 text-success",
    INACTIVE: "bg-warning/20 text-warning",
    DECOMMISSIONED: "bg-destructive/20 text-destructive"
  }[status];
  const label = ru.status.equipment[status];
  return <Badge className={style}>{label}</Badge>;
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const style = {
    DRAFT: "bg-secondary text-secondary-foreground",
    IN_REVIEW: "bg-warning/20 text-warning",
    APPROVED: "bg-success/20 text-success",
    REJECTED: "bg-destructive/20 text-destructive",
    ARCHIVED: "bg-muted text-muted-foreground"
  }[status];
  const label = ru.status.document[status];
  return <Badge className={style}>{label}</Badge>;
}

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const style = {
    DRAFT: "bg-status-info/20 text-status-info",
    PENDING: "bg-warning/20 text-warning",
    APPROVED: "bg-success/20 text-success",
    REJECTED: "bg-destructive/20 text-destructive",
    CANCELED: "bg-muted text-muted-foreground"
  }[status];
  const label =
    status === "DRAFT"
      ? "Черновик"
      : ru.status.approval[status as Exclude<ApprovalStatus, "DRAFT">];
  return <Badge className={style}>{label}</Badge>;
}
