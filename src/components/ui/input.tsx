import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  mono?: boolean;
  inputSize?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-9 px-2.5 text-sm",
  md: "h-10 px-3 text-sm",
  lg: "h-11 px-4 text-base",
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, mono, inputSize = "md", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full rounded-lg border border-input bg-background text-foreground",
          "outline-none transition-colors duration-200",
          "placeholder:text-muted-foreground",
          "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          sizeClasses[inputSize],
          error &&
          "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
          mono && "font-mono",
          className
        )}
        ref={ref}
        aria-invalid={error || undefined}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
