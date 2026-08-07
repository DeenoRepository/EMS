import * as React from "react";
import { cn } from "@/lib/utils";

export interface MetricProgressCardProps {
  label: string;
  current: number;
  max: number;
  unit?: string;
  warningThreshold?: number;
  dangerThreshold?: number;
  className?: string;
}

export function MetricProgressCard({
  label,
  current,
  max,
  unit = "%",
  warningThreshold = 80,
  dangerThreshold = 95,
  className,
}: MetricProgressCardProps) {
  const percent = Math.min(Math.round((current / (max || 1)) * 100), 100);

  let barColor = "bg-[#3473d4]";
  let textColor = "text-slate-800 dark:text-slate-200";

  if (percent >= dangerThreshold) {
    barColor = "bg-rose-500";
    textColor = "text-rose-600 dark:text-rose-400 font-bold";
  } else if (percent >= warningThreshold) {
    barColor = "bg-amber-500";
    textColor = "text-amber-600 dark:text-amber-400 font-semibold";
  }

  return (
    <div className={cn("rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-2", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">{label}</span>
        <span className={cn("text-xs font-mono", textColor)}>
          {current} / {max} {unit} ({percent}%)
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={cn("h-full transition-all duration-300 rounded-full", barColor)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
