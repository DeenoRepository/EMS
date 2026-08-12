"use client";

import * as React from "react";
import { SlidersHorizontal, RotateCcw, X } from "lucide-react";
import { SearchInput } from "./search-input";
import { ColumnToggle, ColumnOption } from "./column-toggle";
import { FilterChip } from "./filter-chip";
import { Button } from "./button";
import { Select } from "./select";
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
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        {onSearchChange !== undefined && searchQuery !== undefined && (
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
            <SearchInput
              value={searchQuery}
              onChange={onSearchChange}
              placeholder={searchPlaceholder}
            />
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {filters.length > 0 && (
            <div className="flex items-center gap-1.5 text-primary">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-xs font-semibold">Фильтры:</span>
            </div>
          )}

          {filters.map((f) => {
            const isActive = f.value !== "ALL" && f.value !== "";
            return (
              <Select
                key={f.key}
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                inputSize="sm"
                active={isActive}
                aria-label={f.label}
                className="min-w-[140px]"
              >
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            );
          })}

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
        <div className="flex items-center gap-2 flex-wrap px-1">
          <span className="text-xs font-semibold text-muted-foreground">
            Активные фильтры:
          </span>
          {activeChips.map((chip) => (
            <FilterChip key={chip.id} label={chip.label} onRemove={chip.onRemove} />
          ))}
          {onResetAll && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3 mr-1" aria-hidden="true" />
              Сбросить все
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
