"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TabNavItem {
  id: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  badgeColor?: string;
}

export interface TabNavProps {
  items: TabNavItem[];
  activeId?: string;
  onChange?: (id: string) => void;
  className?: string;
}

export function TabNav({ items, activeId, onChange, className }: TabNavProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-[0_2px_8px_rgba(15,23,42,.025)] overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        {items.map((item) => {
          const isActive = activeId === item.id;
          const content = (
            <>
              {item.icon && <span className={isActive ? "text-white" : "text-[#3473d4] dark:text-blue-400"}>{item.icon}</span>}
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge !== null && (
                <span
                  className={cn(
                    "ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    isActive
                      ? "bg-white/20 text-white"
                      : item.badgeColor || "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </>
          );

          const baseClasses = cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap cursor-pointer",
            isActive
              ? "bg-[#2f74df] text-white shadow-xs shadow-blue-200 dark:shadow-none"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
          );

          if (item.href) {
            return (
              <Link key={item.id} href={item.href} className={baseClasses}>
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange && onChange(item.id)}
              className={baseClasses}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
