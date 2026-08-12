import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  active?: boolean;
  inputSize?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-9 px-2.5 text-xs",
  md: "h-10 px-3 text-sm",
  lg: "h-11 px-4 text-base",
};

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, error, active, inputSize = "md", ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          className={cn(
            "w-full appearance-none rounded-lg border border-input bg-background text-foreground",
            "outline-none transition-colors duration-200",
            "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "pr-9",
            sizeClasses[inputSize],
            active &&
            "border-primary bg-primary/5 text-primary font-semibold dark:bg-primary/10",
            error &&
            "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
            className
          )}
          ref={ref}
          aria-invalid={error || undefined}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
