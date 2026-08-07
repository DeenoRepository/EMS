import * as React from "react";
import { Save } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalFooterProps {
  onCancel?: () => void;
  cancelLabel?: string;
  onSubmit?: () => void;
  submitLabel?: string;
  submitIcon?: React.ReactNode;
  submitting?: boolean;
  submitVariant?: "primary" | "danger";
  children?: React.ReactNode;
  className?: string;
}

export function ModalFooter({
  onCancel,
  cancelLabel = "Отмена",
  onSubmit,
  submitLabel = "Сохранить",
  submitIcon = <Save size={13} />,
  submitting = false,
  submitVariant = "primary",
  children,
  className,
}: ModalFooterProps) {
  return (
    <div className={cn("pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800", className)}>
      {children}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      )}
      {onSubmit && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-semibold text-white shadow-sm transition disabled:opacity-50",
            submitVariant === "primary"
              ? "bg-[#2f74df] shadow-blue-200 dark:shadow-none hover:bg-[#2565c8]"
              : "bg-rose-600 shadow-rose-200 dark:shadow-none hover:bg-rose-700"
          )}
        >
          {submitIcon}
          {submitting ? "Сохранение…" : submitLabel}
        </button>
      )}
    </div>
  );
}
