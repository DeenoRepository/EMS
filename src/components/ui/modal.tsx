"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  size = "lg",
  closeOnBackdrop = true,
  closeOnEscape = true,
  children,
  className,
}: ModalProps) {
  React.useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  const maxWidthClass = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
    full: "max-w-[95vw]",
  }[size];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={() => closeOnBackdrop && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col my-auto transition-transform animate-in zoom-in-95 duration-200",
          maxWidthClass,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
