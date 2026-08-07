import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterChipProps {
  label: React.ReactNode;
  onRemove: () => void;
  className?: string;
}

export function FilterChip({ label, onRemove, className }: FilterChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] dark:text-blue-400 border border-blue-100 dark:border-blue-900/50",
        className
      )}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="hover:text-blue-800 dark:hover:text-blue-200 transition"
      >
        <X size={11} />
      </button>
    </span>
  );
}
