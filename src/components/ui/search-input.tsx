import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Поиск…",
  className,
}: SearchInputProps) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search size={14} className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-900 pl-9 pr-8 text-[11px] outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-200 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
