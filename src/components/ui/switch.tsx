import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  className?: string;
}

export function Switch({ checked, onChange, disabled, label, className }: SwitchProps) {
  return (
    <label className={cn("inline-flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-700 dark:text-slate-300", disabled && "opacity-50 cursor-not-allowed", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40",
          checked ? "bg-[#2f74df]" : "bg-slate-200 dark:bg-slate-700"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
      {label && <span>{label}</span>}
    </label>
  );
}
