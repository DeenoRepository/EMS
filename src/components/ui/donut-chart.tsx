"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerTitle?: string;
  centerSubtitle?: string;
  className?: string;
}

export function DonutChart({
  data,
  size = 180,
  strokeWidth = 24,
  centerTitle,
  centerSubtitle = "Всего",
  className,
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  const total = React.useMemo(() => data.reduce((acc, curr) => acc + curr.value, 0), [data]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className={cn("flex flex-col sm:flex-row items-center gap-6", className)}>
      {/* SVG Donut */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {total === 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={strokeWidth}
            />
          ) : (
            data.map((item, idx) => {
              const percent = item.value / total;
              const strokeDasharray = `${percent * circumference} ${circumference}`;
              const strokeDashoffset = -accumulatedPercent * circumference;
              accumulatedPercent += percent;

              const isHovered = hoveredIndex === idx;

              return (
                <circle
                  key={idx}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })
          )}
        </svg>

        {/* Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-2xl font-bold font-mono tracking-tight text-[#17243a] dark:text-slate-100">
            {hoveredIndex !== null
              ? data[hoveredIndex].value.toLocaleString()
              : centerTitle || total.toLocaleString()}
          </span>
          <span className="text-[9px] uppercase font-bold tracking-[.1em] text-slate-400 dark:text-slate-500">
            {hoveredIndex !== null ? data[hoveredIndex].label : centerSubtitle}
          </span>
        </div>
      </div>

      {/* Legend Grid */}
      <div className="space-y-2 w-full min-w-[150px]">
        {data.map((item, idx) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          const isHovered = hoveredIndex === idx;

          return (
            <div
              key={idx}
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer border border-transparent",
                isHovered
                  ? "bg-blue-50/60 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/50 font-semibold"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
              )}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate text-slate-700 dark:text-slate-300 font-medium">{item.label}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono shrink-0">
                <span className="font-bold text-[#17243a] dark:text-slate-200">
                  {item.value.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">({percent}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
