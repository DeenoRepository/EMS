"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (item: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (item: T) => void;
  getRowClassName?: (item: T) => string | undefined;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyText = "Записи по заданным критериям не найдены.",
  onRowClick,
  getRowClassName,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgba(15,23,42,.025)]", className)}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 dark:text-slate-500">
            {columns.map((col) => (
              <th key={col.key} className={cn("px-5 py-2.5", col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-400">
                <div className="flex items-center justify-center gap-2 text-xs">
                  <Loader2 size={16} className="animate-spin text-[#3473d4]" />
                  <span>Загрузка данных…</span>
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-400 text-xs">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick && onRowClick(item)}
                className={cn(
                  "hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition",
                  onRowClick && "cursor-pointer",
                  getRowClassName && getRowClassName(item)
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-5 py-3.5", col.className)}>
                    {col.cell(item)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
