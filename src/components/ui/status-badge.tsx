import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  status: string;
  label?: string;
  colorMap?: Record<string, { bg: string; text: string; dot: string }>;
  className?: string;
  size?: "sm" | "md";
}

const DEFAULT_COLOR_MAP: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  DRAFT: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  INACTIVE: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  DECOMMISSIONED: {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-600 dark:text-slate-400",
    dot: "bg-slate-400",
  },
  PENDING: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  APPROVED: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  REQUESTED: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  LOW_STOCK: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  IN_STOCK: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-0.5 text-xs",
};

export function StatusBadge({
  status,
  label,
  colorMap = DEFAULT_COLOR_MAP,
  className,
  size = "md",
}: StatusBadgeProps) {
  const styles = colorMap[status] || {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-600 dark:text-slate-400",
    dot: "bg-slate-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        sizeClasses[size],
        styles.bg,
        styles.text,
        className
      )}
      role="status"
      aria-label={`Статус: ${label || status}`}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full shrink-0", styles.dot)}
        aria-hidden="true"
      />
      {label || status}
    </span>
  );
}
