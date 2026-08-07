import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ label, required, error, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <label className="font-semibold text-slate-600 dark:text-slate-300 text-[11px] block">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-[10px] font-medium text-rose-500">{error}</p>}
      {hint && !error && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}
