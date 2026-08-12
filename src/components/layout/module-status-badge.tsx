"use client";

import React from "react";
import { ModuleCircuitBreaker, ModuleHealthStatus } from "@/lib/shell/circuit-breaker";

interface ModuleStatusBadgeProps {
  moduleId: string;
  showText?: boolean;
}

export function ModuleStatusBadge({ moduleId, showText = true }: ModuleStatusBadgeProps) {
  const health = ModuleCircuitBreaker.getModuleHealth(moduleId);
  const status: ModuleHealthStatus = health.status;

  const colorMap: Record<ModuleHealthStatus, { bg: string; dot: string; text: string; label: string }> = {
    ONLINE: {
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      dot: "bg-emerald-500",
      text: "Онлайн",
      label: "Модуль работает штатно",
    },
    DEGRADED: {
      bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      dot: "bg-amber-500 animate-pulse",
      text: "Деградация",
      label: "Зафиксированы задержки или сбои API",
    },
    OFFLINE: {
      bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
      dot: "bg-rose-500",
      text: "Офлайн",
      label: "Модуль недоступен",
    },
  };

  const style = colorMap[status];

  return (
    <div
      className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${style.bg}`}
      title={`${moduleId.toUpperCase()}: ${style.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {showText && <span>{style.text}</span>}
    </div>
  );
}
