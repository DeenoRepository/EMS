import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
  className?: string;
}

export function ModalHeader({ icon, title, subtitle, onClose, className }: ModalHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3", className)}>
      <div className="flex items-center gap-2">
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#eef5ff] dark:bg-blue-950/50 text-[#3473d4] dark:text-blue-400">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-bold text-[#17243a] dark:text-slate-100">{title}</h3>
          {subtitle && <p className="text-[10px] text-slate-400 dark:text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition"
      >
        <X size={16} />
      </button>
    </div>
  );
}
