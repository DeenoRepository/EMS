"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface AreaChartPoint {
  label: string;
  value: number;
  value2?: number;
}

export interface AreaChartProps {
  data: AreaChartPoint[];
  height?: number;
  color?: "blue" | "emerald" | "amber" | "indigo" | "rose";
  showGrid?: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
  className?: string;
}

const colorMap = {
  blue: {
    stroke: "#3473d4",
    fillStart: "rgba(52, 115, 212, 0.28)",
    fillEnd: "rgba(52, 115, 212, 0.0)",
    dot: "#2f74df",
  },
  emerald: {
    stroke: "#10b981",
    fillStart: "rgba(16, 185, 129, 0.28)",
    fillEnd: "rgba(16, 185, 129, 0.0)",
    dot: "#059669",
  },
  amber: {
    stroke: "#f59e0b",
    fillStart: "rgba(245, 158, 11, 0.28)",
    fillEnd: "rgba(245, 158, 11, 0.0)",
    dot: "#d97706",
  },
  indigo: {
    stroke: "#6366f1",
    fillStart: "rgba(99, 102, 241, 0.28)",
    fillEnd: "rgba(99, 102, 241, 0.0)",
    dot: "#4f46e5",
  },
  rose: {
    stroke: "#f43f5e",
    fillStart: "rgba(244, 63, 94, 0.28)",
    fillEnd: "rgba(244, 63, 94, 0.0)",
    dot: "#e11d48",
  },
};

export function AreaChart({
  data,
  height = 200,
  color = "blue",
  showGrid = true,
  valuePrefix = "",
  valueSuffix = "",
  className,
}: AreaChartProps) {
  const generatedId = React.useId();
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-[11px] font-medium text-slate-400 dark:text-slate-500",
          className
        )}
        style={{ height }}
      >
        Нет данных для отображения графика
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;

  const padding = 20;
  const chartWidth = 500;
  const chartHeight = height;

  const points = data.map((d, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((d.value - minValue) / range) * (chartHeight - padding * 2);
    return { x, y, data: d };
  });

  const pathD = points.reduce((acc, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prev = points[index - 1];
    const cx = (prev.x + point.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${point.y}, ${point.x} ${point.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z`;

  const themeColors = colorMap[color];
  const gradientId = `area-gradient-${color}-${generatedId}`;

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className={cn("relative w-full overflow-hidden select-none", className)}>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto overflow-visible"
        style={{ height }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={themeColors.fillStart} />
            <stop offset="100%" stopColor={themeColors.fillEnd} />
          </linearGradient>
        </defs>

        {showGrid && (
          <g className="stroke-slate-200/60 dark:stroke-slate-800/80" strokeDasharray="3 3">
            {[0.25, 0.5, 0.75].map((ratio) => {
              const y = chartHeight - padding - ratio * (chartHeight - padding * 2);
              return <line key={ratio} x1={padding} y1={y} x2={chartWidth - padding} y2={y} strokeWidth="1" />;
            })}
          </g>
        )}

        <path d={areaD} fill={`url(#${gradientId})`} />
        <path d={pathD} fill="none" stroke={themeColors.stroke} strokeWidth="2.5" strokeLinecap="round" />

        {points.map((pt, i) => {
          const isHovered = hoverIndex === i;
          return (
            <g key={i} className="cursor-pointer">
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? "6" : "4"}
                fill={isHovered ? "#ffffff" : themeColors.dot}
                stroke={themeColors.stroke}
                strokeWidth={isHovered ? "3" : "2"}
                className="transition-all duration-150"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            </g>
          );
        })}
      </svg>

      {/* Hover Tooltip */}
      {hoverIndex !== null && activePoint && (
        <div
          className="absolute z-20 pointer-events-none rounded-xl border border-slate-700/40 bg-[#17243a]/95 dark:bg-slate-800 px-3 py-1.5 text-[10px] text-white shadow-xl backdrop-blur-xs animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${(activePoint.x / chartWidth) * 100}%`,
            top: `${Math.max(10, activePoint.y - 40)}px`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-semibold text-slate-300">{activePoint.data.label}</div>
          <div className="font-mono font-bold text-sky-400">
            {valuePrefix}
            {activePoint.data.value.toLocaleString()}
            {valueSuffix}
          </div>
        </div>
      )}

      {/* Axis Labels */}
      <div className="flex items-center justify-between mt-2 px-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
        <span>{data[0]?.label}</span>
        {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.label}</span>}
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
