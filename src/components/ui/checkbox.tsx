import * as React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <label htmlFor={inputId} className="inline-flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 dark:text-slate-300 select-none">
        <input
          type="checkbox"
          id={inputId}
          ref={ref}
          className={cn(
            "rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[#3473d4] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 h-3.5 w-3.5 transition",
            className
          )}
          {...props}
        />
        {label && <span>{label}</span>}
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
