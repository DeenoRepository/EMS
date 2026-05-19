import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type SummaryCardProps = {
  label: string;
  value: string | number;
  valueClassName?: string;
  rightSlot?: ReactNode;
  className?: string;
};

export function SummaryCard({ label, value, valueClassName, rightSlot, className }: SummaryCardProps) {
  return (
    <Card className={cn("min-h-[104px] p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <p className={cn("mt-2 text-[2rem] font-bold leading-none text-foreground", valueClassName)}>{value}</p>
        </div>
        {rightSlot ? <div className="mt-0.5">{rightSlot}</div> : null}
      </div>
    </Card>
  );
}
