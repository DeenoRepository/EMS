import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<string, string> = {
  RUNNING: "bg-status-info/20 text-status-info",
  SUCCESS: "bg-success/20 text-success",
  FAILED: "bg-destructive/20 text-destructive"
};

const STATUS_LABELS: Record<string, string> = {
  RUNNING: "Выполняется",
  SUCCESS: "Успешно",
  FAILED: "Ошибка"
};

export function ImportStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || "bg-secondary text-secondary-foreground";
  const label = STATUS_LABELS[status] || status;
  return <Badge className={style}>{label}</Badge>;
}
