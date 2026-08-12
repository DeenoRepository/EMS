import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputSize?: "sm" | "md" | "lg";
  onSubmit?: () => void;
}

const sizeClasses = {
  sm: "h-9 pl-8 pr-8 text-sm",
  md: "h-10 pl-9 pr-9 text-sm",
  lg: "h-11 pl-10 pr-10 text-base",
};

const iconSizeClasses = {
  sm: "h-3.5 w-3.5 left-2.5",
  md: "h-4 w-4 left-3",
  lg: "h-5 w-5 left-3.5",
};

export function SearchInput({
  value,
  onChange,
  placeholder = "Поиск…",
  className,
  inputSize = "md",
  onSubmit,
}: SearchInputProps) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
          iconSizeClasses[inputSize]
        )}
        aria-hidden="true"
      />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSubmit) {
            onSubmit();
          }
        }}
        aria-label={placeholder}
        className={cn(
          "w-full rounded-lg border border-input bg-background text-foreground",
          "outline-none transition-colors duration-200",
          "placeholder:text-muted-foreground",
          "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
          sizeClasses[inputSize]
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Очистить поиск"
          className={cn(
            "absolute top-1/2 -translate-y-1/2 right-2.5 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
