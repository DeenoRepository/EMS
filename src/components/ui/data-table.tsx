"use client";

import * as React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  sortKey?: string;
  width?: string;
  align?: "left" | "center" | "right";
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  loading?: boolean;
  emptyText?: string;
  emptyDescription?: string;
  emptyVariant?: "default" | "search" | "no-data";
  onRowClick?: (item: T) => void;
  getRowClassName?: (item: T) => string | undefined;
  className?: string;
  stickyHeader?: boolean;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string, direction: "asc" | "desc") => void;
  selectable?: boolean;
  selectedIds?: (string | number)[];
  onSelectionChange?: (ids: (string | number)[]) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyText = "Записи по заданным критериям не найдены",
  emptyDescription,
  emptyVariant = "no-data",
  onRowClick,
  getRowClassName,
  className,
  stickyHeader = false,
  sortBy,
  sortDirection,
  onSort,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
}: DataTableProps<T>) {
  const allSelected = data.length > 0 && selectedIds.length === data.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map(keyExtractor));
    }
  };

  const handleSelectRow = (id: string | number) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable || !onSort) return;
    const key = column.sortKey || column.key;
    const newDirection =
      sortBy === key && sortDirection === "asc" ? "desc" : "asc";
    onSort(key, newDirection);
  };

  const alignClass = (align?: "left" | "center" | "right") => {
    switch (align) {
      case "center":
        return "text-center";
      case "right":
        return "text-right";
      default:
        return "text-left";
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className
      )}
    >
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead
            className={cn(
              "bg-muted/50 border-b border-border",
              stickyHeader && "sticky top-0 z-10 backdrop-blur-sm"
            )}
          >
            <tr>
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={handleSelectAll}
                    aria-label="Выбрать все строки"
                    className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                    alignClass(col.align),
                    col.sortable && "cursor-pointer select-none hover:text-foreground transition-colors",
                    col.className
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => handleSort(col)}
                  aria-sort={
                    col.sortable && sortBy === (col.sortKey || col.key)
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5",
                      col.align === "right" && "flex-row-reverse"
                    )}
                  >
                    {col.header}
                    {col.sortable && (
                      <span className="shrink-0">
                        {sortBy === (col.sortKey || col.key) ? (
                          sortDirection === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-16 text-center"
                >
                  <div
                    className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Загрузка данных…</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)}>
                  <EmptyState
                    variant={emptyVariant}
                    title={emptyText}
                    description={emptyDescription}
                  />
                </td>
              </tr>
            ) : (
              data.map((item) => {
                const id = keyExtractor(item);
                const isSelected = selectedIds.includes(id);
                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick && onRowClick(item)}
                    className={cn(
                      "transition-colors duration-150",
                      "hover:bg-muted/50",
                      onRowClick && "cursor-pointer",
                      isSelected && "bg-primary/5",
                      getRowClassName && getRowClassName(item)
                    )}
                    aria-selected={selectable ? isSelected : undefined}
                  >
                    {selectable && (
                      <td
                        className="w-12 px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(id)}
                          aria-label={`Выбрать строку ${id}`}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-3 text-sm text-foreground",
                          alignClass(col.align),
                          col.className
                        )}
                      >
                        {col.cell(item)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
