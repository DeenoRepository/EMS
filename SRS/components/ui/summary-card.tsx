import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "critical";
  className?: string;
};

const toneClasses: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "text-foreground",
  positive: "text-status-success",
  warning: "text-status-warning",
  critical: "text-status-error"
};

export function KpiCard({ label, value, hint, tone = "default", className }: KpiCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-3xl font-bold leading-none", toneClasses[tone])}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
