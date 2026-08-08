"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface StepPoint {
  label: string;
  stage: string;
  stageLevel: number; // e.g. 1=PLANNED, 2=COMMISSIONED, 3=IN_OPERATION, 4=MAINTENANCE, 5=RETIRED
  timestamp: string;
  note?: string;
}

export interface StepChartProps {
  data: StepPoint[];
  height?: number;
  className?: string;
}

const levelColors: Record<number, string> = {
  1: "#64748b", // PLANNED - slate
  2: "#2f74df", // COMMISSIONED - corporate blue
  3: "#10b981", // IN_OPERATION - emerald
  4: "#f59e0b", // MAINTENANCE - amber
  5: "#ef4444", // RETIRED - rose
};

export function StepChart({ data, height = 180, className }: StepChartProps) {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-xs text-slate-400",
          className
        )}
        style={{ height }}
      >
        Нет данных для временной шкалы состояний
      </div>
    );
  }

  const padding = 30;
  const chartWidth = 500;
  const chartHeight = height;

  const maxLevel = 5;
  const minLevel = 1;

  const points = data.map((d, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((d.stageLevel - minLevel) / (maxLevel - minLevel)) * (chartHeight - padding * 2);
    return { x, y, data: d };
  });

  // Generate Step Path: horizontal then vertical
  let stepPathD = "";
  points.forEach((pt, i) => {
    if (i === 0) {
      stepPathD += `M ${pt.x} ${pt.y}`;
    } else {
      stepPathD += ` H ${pt.x} V ${pt.y}`;
    }
  });

  return (
    <div className={cn("relative w-full overflow-hidden select-none", className)}>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto overflow-visible"
        style={{ height }}
      >
        {/* Horizontal Guide Lines */}
        {[1, 2, 3, 4, 5].map((lvl) => {
          const y = chartHeight - padding - ((lvl - minLevel) / (maxLevel - minLevel)) * (chartHeight - padding * 2);
          return (
            <g key={lvl}>
              <line
                x1={padding}
                y1={y}
                x2={chartWidth - padding}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="2 2"
                className="dark:stroke-slate-800"
              />
            </g>
          );
        })}

        {/* Step Line */}
        <path
          d={stepPathD}
          fill="none"
          stroke="#3473d4"
          strokeWidth="3"
          strokeLinecap="square"
          className="dark:stroke-blue-400"
        />

        {/* Step Points */}
        {points.map((pt, i) => {
          const isHovered = hoverIndex === i;
          const dotColor = levelColors[pt.data.stageLevel] || "#3473d4";

          return (
            <g key={i} className="cursor-pointer">
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? "7" : "5"}
                fill={dotColor}
                stroke="#ffffff"
                strokeWidth="2"
                className="transition-all duration-150 shadow-md"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoverIndex !== null && (
        <div
          className="absolute z-20 pointer-events-none rounded-xl border border-slate-700/40 bg-[#17243a]/95 dark:bg-slate-800 p-2.5 text-[10px] text-white shadow-xl backdrop-blur-xs animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${(points[hoverIndex].x / chartWidth) * 100}%`,
            top: `${Math.max(10, points[hoverIndex].y - 45)}px`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-bold text-slate-200">{points[hoverIndex].data.stage}</div>
          <div className="text-slate-400 font-mono">{points[hoverIndex].data.timestamp}</div>
          {points[hoverIndex].data.note && (
            <div className="mt-1 text-emerald-400 font-semibold border-t border-slate-700/60 pt-1">
              {points[hoverIndex].data.note}
            </div>
          )}
        </div>
      )}

      {/* Timeline Labels */}
      <div className="flex items-center justify-between mt-2 px-1 text-[10px] font-mono text-slate-400 dark:text-slate-500">
        <span>{data[0]?.timestamp}</span>
        <span>{data[data.length - 1]?.timestamp}</span>
      </div>
    </div>
  );
}
