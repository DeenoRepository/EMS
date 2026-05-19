import { Badge } from "@/components/ui/badge";

type StatusGroup = "task" | "plan" | "rca" | "severity";

type StatusBadgeProps = {
  status?: string | null;
  group?: StatusGroup;
};

function normalize(value?: string | null) {
  return (value || "").toUpperCase();
}

function classesFor(status: string, group: StatusGroup) {
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

function label(status: string) {
  if (!status) return "-";
  return status.replaceAll("_", " ");
}

export function StatusBadge({ status, group = "task" }: StatusBadgeProps) {
  const normalized = normalize(status);
  return <Badge className={classesFor(normalized, group)}>{label(normalized)}</Badge>;
}
