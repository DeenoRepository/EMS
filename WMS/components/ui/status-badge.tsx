import { Badge } from "@/components/ui/badge";

type StatusGroup = "task" | "plan" | "rca" | "severity";
type WmsGroup = "wms_request" | "wms_reservation" | "wms_sla" | "wms_priority" | "wms_movement";

type StatusBadgeProps = {
  status?: string | null;
  group?: StatusGroup | WmsGroup;
};

function normalize(value?: string | null) {
  return (value || "").toUpperCase();
}

function classesFor(status: string, group: StatusGroup | WmsGroup) {
  if (group === "wms_request") {
    if (status === "RESERVED" || status === "PARTIALLY_RESERVED") return "border-0 bg-status-warning/20 text-status-warning";
    if (status === "FULFILLED" || status === "PARTIALLY_FULFILLED") return "border-0 bg-status-success/20 text-status-success";
    if (status === "CREATED" || status === "DRAFT") return "border-0 bg-status-info/20 text-status-info";
    if (status === "CANCELLED") return "border-0 bg-muted text-muted-foreground";
    return "border-0 bg-muted text-muted-foreground";
  }
  if (group === "wms_reservation") {
    if (status === "ACTIVE") return "border-0 bg-status-warning/20 text-status-warning";
    if (status === "ISSUED") return "border-0 bg-status-success/20 text-status-success";
    if (status === "CANCELLED") return "border-0 bg-muted text-muted-foreground";
    return "border-0 bg-muted text-muted-foreground";
  }
  if (group === "wms_sla") {
    if (status === "SLA VIOLATED") return "border-0 bg-status-error/20 text-status-error";
    if (status === "SLA RISK") return "border-0 bg-status-warning/20 text-status-warning";
    if (status === "IN SLA") return "border-0 bg-status-success/20 text-status-success";
    return "border-0 bg-muted text-muted-foreground";
  }
  if (group === "wms_priority") {
    if (status === "HIGH") return "border-0 bg-status-error/20 text-status-error";
    if (status === "MEDIUM") return "border-0 bg-status-warning/20 text-status-warning";
    return "border-0 bg-muted text-muted-foreground";
  }
  if (group === "wms_movement") {
    if (status === "ISSUE") return "border-0 bg-status-error/20 text-status-error";
    if (status === "TRANSFER") return "border-0 bg-status-warning/20 text-status-warning";
    if (status === "RECEIPT") return "border-0 bg-status-success/20 text-status-success";
    if (status === "ADJUSTMENT") return "border-0 bg-status-info/20 text-status-info";
    return "border-0 bg-muted text-muted-foreground";
  }
  if (group === "severity") {
    if (status === "CRITICAL") return "border-0 bg-status-error/20 text-status-error";
    if (status === "HIGH") return "border-0 bg-status-warning/20 text-status-warning";
    if (status === "MEDIUM") return "border-0 bg-status-info/20 text-status-info";
    return "border-0 bg-muted text-muted-foreground";
  }

  if (group === "rca") {
    if (status === "OPEN") return "border-0 bg-status-error/20 text-status-error";
    if (status === "IN_PROGRESS") return "border-0 bg-status-warning/20 text-status-warning";
    if (status === "CLOSED") return "border-0 bg-status-success/20 text-status-success";
    return "border-0 bg-muted text-muted-foreground";
  }

  if (group === "plan") {
    if (status === "ACTIVE") return "border-0 bg-status-success/20 text-status-success";
    if (status === "PAUSED") return "border-0 bg-status-warning/20 text-status-warning";
    if (status === "ARCHIVED") return "border-0 bg-muted text-muted-foreground";
    return "border-0 bg-muted text-muted-foreground";
  }

  if (status === "OVERDUE") return "border-0 bg-status-error/20 text-status-error";
  if (status === "IN_PROGRESS") return "border-0 bg-status-warning/20 text-status-warning";
  if (status === "COMPLETED") return "border-0 bg-status-success/20 text-status-success";
  if (status === "PLANNED") return "border-0 bg-status-info/20 text-status-info";
  if (status === "CANCELED") return "border-0 bg-muted text-muted-foreground";
  return "border-0 bg-muted text-muted-foreground";
}

function label(status: string, group: StatusGroup | WmsGroup) {
  if (!status) return "-";
  if (group === "wms_request") {
    const map: Record<string, string> = {
      DRAFT: "Черновик",
      CREATED: "Создана",
      PARTIALLY_RESERVED: "Частично зарезервирована",
      RESERVED: "Зарезервирована",
      PARTIALLY_FULFILLED: "Частично исполнена",
      FULFILLED: "Исполнена",
      CANCELLED: "Отменена"
    };
    return map[status] || status;
  }
  if (group === "wms_reservation") {
    const map: Record<string, string> = { ACTIVE: "Активен", ISSUED: "Выдан", CANCELLED: "Отменен" };
    return map[status] || status;
  }
  if (group === "wms_sla") {
    const map: Record<string, string> = { "SLA VIOLATED": "SLA нарушен", "SLA RISK": "Риск SLA", "IN SLA": "В SLA" };
    return map[status] || status;
  }
  if (group === "wms_priority") {
    const map: Record<string, string> = { HIGH: "Высокий", MEDIUM: "Средний", LOW: "Низкий" };
    return map[status] || status;
  }
  if (group === "wms_movement") {
    const map: Record<string, string> = { RECEIPT: "Приход", ISSUE: "Выдача", TRANSFER: "Перемещение", ADJUSTMENT: "Корректировка" };
    return map[status] || status;
  }
  return status.replaceAll("_", " ");
}

export function StatusBadge({ status, group = "task" }: StatusBadgeProps) {
  const normalized = normalize(status);
  return <Badge className={classesFor(normalized, group)}>{label(normalized, group)}</Badge>;
}
