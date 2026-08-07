import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  active?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, error, active, ...props }, ref) => {
    return (
      <select
        className={cn(
          "w-full rounded-lg border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 px-3 py-2 text-[11px] outline-none transition focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 disabled:cursor-not-allowed disabled:opacity-50",
          active && "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold dark:bg-blue-950/30 dark:text-blue-400",
          error && "border-rose-400 focus:border-rose-500 focus:ring-rose-100 dark:focus:ring-rose-900/40",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";

export { Select };
