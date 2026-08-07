import * as React from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UserChipProps {
  name: string;
  role?: string;
  avatarUrl?: string;
  size?: "sm" | "md";
  className?: string;
}

export function UserChip({ name, role, avatarUrl, size = "md", className }: UserChipProps) {
  const avatarSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 px-2.5 py-1 text-xs", className)}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className={cn("rounded-full object-cover shrink-0", avatarSize)} />
      ) : (
        <div className={cn("flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-[#3473d4] dark:text-blue-400 shrink-0", avatarSize)}>
          <User size={size === "sm" ? 10 : 12} />
        </div>
      )}
      <div className="leading-tight">
        <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">{name}</div>
        {role && <div className="text-[9px] text-slate-400 dark:text-slate-500">{role}</div>}
      </div>
    </div>
  );
}
