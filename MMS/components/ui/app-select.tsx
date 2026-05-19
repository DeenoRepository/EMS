"use client";

import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

type AppSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function AppSelect({ className, children, ...props }: AppSelectProps) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
