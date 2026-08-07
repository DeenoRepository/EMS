import * as React from "react";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconColor?: "blue" | "emerald" | "amber" | "slate" | "rose" | "indigo";
  sub?: string;
  subColor?: "emerald" | "slate" | "amber" | "rose";
  className?: string;
}

export function KpiCard({ label, value, icon, iconColor = "blue", sub, subColor = "slate", className }: KpiCardProps) {
  const iconColorStyles = {
    blue: "bg-blue-50 dark:bg-blue-950/40 text-[#3473d4] dark:text-blue-400",
    emerald: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
    slate: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
    rose: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400",
    indigo: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
  }[iconColor];

  const subColorStyles = {
    emerald: "text-emerald-600 dark:text-emerald-400 font-semibold",
    slate: "text-slate-400 dark:text-slate-500",
    amber: "text-amber-600 dark:text-amber-400 font-semibold",
    rose: "text-rose-600 dark:text-rose-400 font-semibold",
  }[subColor];

  return (
    <div className={cn("rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]", className)}>
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400 dark:text-slate-500">
          {label}
        </span>
        <div className={cn("rounded-md p-1.5", iconColorStyles)}>{icon}</div>
      </div>
      <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a] dark:text-slate-100">{value}</div>
      {sub && <div className={cn("mt-1 text-[10px]", subColorStyles)}>{sub}</div>}
    </div>
  );
}
