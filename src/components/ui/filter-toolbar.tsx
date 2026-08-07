"use client";

import * as React from "react";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { SearchInput } from "./search-input";
import { ColumnToggle, ColumnOption } from "./column-toggle";
import { FilterChip } from "./filter-chip";
import { cn } from "@/lib/utils";

export interface FilterOption {
  key: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export interface FilterChipItem {
  id: string;
  label: React.ReactNode;
  onRemove: () => void;
}

export interface FilterToolbarProps<K extends string = string> {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  columns?: ColumnOption<K>[];
  onColumnToggle?: (key: K) => void;
  onColumnReset?: () => void;
  activeChips?: FilterChipItem[];
  onResetAll?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function FilterToolbar<K extends string = string>({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Поиск…",
  filters = [],
  columns,
  onColumnToggle,
  onColumnReset,
  activeChips = [],
  onResetAll,
  actions,
  className,
}: FilterToolbarProps<K>) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
        {onSearchChange !== undefined && searchQuery !== undefined && (
          <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
            <SearchInput
              value={searchQuery}
              onChange={onSearchChange}
              placeholder={searchPlaceholder}
            />
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {filters.length > 0 && (
            <div className="flex items-center gap-1 text-[#3473d4] dark:text-blue-400">
              <SlidersHorizontal size={13} />
              <span className="font-semibold text-[11px]">Фильтры:</span>
            </div>
          )}

          {filters.map((f) => (
            <select
              key={f.key}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              className={`h-8 rounded-lg border px-2.5 text-[10px] outline-none transition ${
                f.value !== "ALL" && f.value !== ""
                  ? "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold dark:bg-blue-950/40 dark:text-blue-400"
                  : "border-slate-200 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-900 text-slate-600 dark:text-slate-300 focus:border-[#3c82ed]"
              }`}
            >
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}

          {columns && onColumnToggle && (
            <ColumnToggle
              columns={columns}
              onToggle={onColumnToggle}
              onReset={onColumnReset}
            />
          )}

          {actions}
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs px-1">
          <span className="text-[10px] font-semibold text-slate-400">Активные фильтры:</span>
          {activeChips.map((chip) => (
            <FilterChip key={chip.id} label={chip.label} onRemove={chip.onRemove} />
          ))}
          {onResetAll && (
            <button
              type="button"
              onClick={onResetAll}
              className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition ml-1"
            >
              <RotateCcw size={10} /> Сбросить все
            </button>
          )}
        </div>
      )}
    </div>
  );
}
