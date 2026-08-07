import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormSectionProps {
  icon?: React.ReactNode;
  title: string;
  badge?: string;
  cols?: 1 | 2 | 3 | 4;
  className?: string;
  children: React.ReactNode;
}

export function FormSection({ icon, title, badge, cols = 2, className, children }: FormSectionProps) {
  const colsClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-4",
  }[cols];

  return (
    <div className={cn("space-y-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3.5", className)}>
      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-[#17243a] dark:text-slate-200 text-[11px] uppercase tracking-wider">
          {icon} <span>{title}</span>
        </div>
        {badge && <span className="text-[10px] text-slate-400 font-medium">{badge}</span>}
      </div>
      <div className={cn("grid gap-3", colsClass)}>{children}</div>
    </div>
  );
}
