import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "w-full rounded-lg border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 px-3 py-2 text-[11px] outline-none transition placeholder:text-slate-400 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-rose-400 focus:border-rose-500 focus:ring-rose-100 dark:focus:ring-rose-900/40",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
