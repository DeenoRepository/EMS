import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tabs({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("space-y-4", className)}>{children}</div>;
}

export function TabsList({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("inline-flex rounded-md bg-secondary p-1", className)}>{children}</div>;
}

export function TabsTrigger({
  className,
  active,
  children,
  ...props
}: {
  className?: string;
  active?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center rounded-sm px-3 py-1.5 text-sm font-medium",
        active ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        className
      )}
      type="button"
    >
      {children}
    </button>
  );
}
