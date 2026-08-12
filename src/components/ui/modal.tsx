"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  title?: string;
  description?: string;
  showCloseButton?: boolean;
  children: React.ReactNode;
  className?: string;
}

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Modal({
  open,
  isOpen,
  onClose,
  size = "lg",
  closeOnBackdrop = true,
  closeOnEscape = true,
  title,
  description,
  showCloseButton = true,
  children,
  className,
}: ModalProps) {
  const isModalOpen = open ?? isOpen ?? false;
  const modalRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElement = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  // Mount check for SSR
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Focus management
  React.useEffect(() => {
    if (!isModalOpen) return;

    // Save current focus
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus first focusable element in modal
    const focusFirst = () => {
      if (!modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
      const first = focusable[0];
      if (first) {
        first.focus();
      } else {
        modalRef.current.focus();
      }
    };

    // Small delay to ensure modal is rendered
    const timer = setTimeout(focusFirst, 10);

    return () => {
      clearTimeout(timer);
      // Restore focus on close
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isModalOpen]);

  // Escape key handler
  React.useEffect(() => {
    if (!isModalOpen || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement;

        if (e.shiftKey) {
          if (active === first || !modalRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !modalRef.current.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, closeOnEscape, onClose]);

  // Body scroll lock
  React.useEffect(() => {
    if (!isModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isModalOpen]);

  if (!isModalOpen || !mounted) return null;

  const maxWidthClass = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[95vw]",
  }[size];

  const modalContent = (
    <div
      className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      onClick={() => closeOnBackdrop && onClose()}
      aria-hidden="true"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative w-full rounded-2xl border border-border bg-card text-card-foreground shadow-2xl",
          "max-h-[90vh] flex flex-col my-auto",
          "transition-all animate-in zoom-in-95 duration-200",
          "focus:outline-none",
          maxWidthClass,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div className="flex-1 min-w-0">
              {title && (
                <h2
                  id={titleId}
                  className="text-lg font-semibold text-foreground text-balance"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id={descriptionId}
                  className="mt-1 text-sm text-muted-foreground"
                >
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
