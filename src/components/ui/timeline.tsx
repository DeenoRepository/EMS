import * as React from "react";
import { Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineFieldChange {
  field: string;
  oldValue?: string | number | null;
  newValue?: string | number | null;
}

export interface TimelineItem {
  id: string | number;
  date: string;
  user: string;
  action: string;
  comment?: string;
  changes?: TimelineFieldChange[];
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-400 py-4 text-center">История изменений отсутствует</p>;
  }

  return (
    <div className={cn("space-y-4 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800", className)}>
      {items.map((item) => (
        <div key={item.id} className="relative flex items-start gap-3 pl-8">
          <div className="absolute left-1.5 top-1 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 bg-[#3473d4] shadow-xs" />
          <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <div className="font-semibold text-slate-800 dark:text-slate-200">{item.action}</div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                <Clock size={11} />
                <span>{item.date}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <User size={11} className="text-[#3473d4]" />
              <span className="font-medium">{item.user}</span>
            </div>

            {item.comment && (
              <p className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg italic">
                &quot;{item.comment}&quot;
              </p>
            )}

            {item.changes && item.changes.length > 0 && (
              <div className="space-y-1 pt-1">
                {item.changes.map((ch, idx) => (
                  <div key={idx} className="text-[10px] grid grid-cols-3 gap-2 bg-slate-50/70 dark:bg-slate-800/30 p-1.5 rounded font-mono">
                    <span className="text-slate-500 font-semibold">{ch.field}:</span>
                    <span className="text-rose-500 line-through truncate">{String(ch.oldValue ?? "—")}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate">➔ {String(ch.newValue ?? "—")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
