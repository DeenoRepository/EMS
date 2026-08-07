"use client";

import * as React from "react";
import { Columns3, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface ColumnOption<K extends string = string> {
  key: K;
  label: string;
  visible: boolean;
}

export interface ColumnToggleProps<K extends string = string> {
  columns: ColumnOption<K>[];
  onToggle: (key: K) => void;
  onReset?: () => void;
  className?: string;
}

export function ColumnToggle<K extends string = string>({
  columns,
  onToggle,
  onReset,
  className,
}: ColumnToggleProps<K>) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        title="Настройка видимости колонок таблицы"
      >
        <Columns3 size={13} className="text-[#3473d4] dark:text-blue-400" />
        <span>Колонки</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-30 w-52 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xl space-y-2 text-xs animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <span className="font-bold text-[#17243a] dark:text-slate-200 text-[11px]">
              Отображение колонок
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
            >
              <X size={13} />
            </button>
          </div>
          <div className="space-y-1.5 pt-1">
            {columns.map((col) => (
              <div key={col.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 p-1 rounded transition">
                <Checkbox
                  checked={col.visible}
                  onChange={() => onToggle(col.key)}
                  label={col.label}
                />
              </div>
            ))}
          </div>

          {onReset && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between">
              <button
                type="button"
                onClick={() => {
                  onReset();
                }}
                className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline transition"
              >
                Сбросить видимость
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
