"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarChartItem[];
  layout?: "vertical" | "horizontal";
  height?: number;
  valueSuffix?: string;
  className?: string;
}

export function BarChart({
  data,
  layout = "vertical",
  height = 200,
  valueSuffix = "",
  className,
}: BarChartProps) {
  const maxValue = React.useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-xs text-slate-400",
          className
        )}
        style={{ height }}
      >
        Нет данных для диаграммы
      </div>
    );
  }

  if (layout === "horizontal") {
    return (
      <div className={cn("space-y-3 w-full", className)}>
        {data.map((item, idx) => {
          const percent = Math.round((item.value / maxValue) * 100);
          const barColor = item.color || "#3473d4";

          return (
            <div key={idx} className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#17243a] dark:text-slate-200">{item.label}</span>
                <span className="font-mono text-slate-500 font-bold">
                  {item.value.toLocaleString()} {valueSuffix}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${percent}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-end justify-between gap-3 w-full select-none pt-6 pb-2", className)}
      style={{ height }}
    >
      {data.map((item, idx) => {
        const heightPercent = Math.max(8, Math.round((item.value / maxValue) * 100));
        const barColor = item.color || "#3473d4";

        return (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
            <span className="text-[10px] font-mono font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {item.value.toLocaleString()}
            </span>
            <div className="w-full max-w-[40px] bg-slate-100 dark:bg-slate-800/80 rounded-t-lg overflow-hidden flex items-end h-full">
              <div
                className="w-full rounded-t-lg transition-all duration-500 ease-out group-hover:brightness-110"
                style={{ height: `${heightPercent}%`, backgroundColor: barColor }}
              />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 truncate max-w-[60px] text-center">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
