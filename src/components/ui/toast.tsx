"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
    id: string;
    title?: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
}

interface ToastContextValue {
    toasts: Toast[];
    toast: (toast: Omit<Toast, "id">) => string;
    success: (title: string, description?: string) => string;
    error: (title: string, description?: string) => string;
    warning: (title: string, description?: string) => string;
    info: (title: string, description?: string) => string;
    dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
    const context = React.useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return context;
}

const variantStyles: Record<ToastVariant, { bg: string; text: string; icon: React.ReactNode }> = {
    success: {
        bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900",
        text: "text-emerald-900 dark:text-emerald-100",
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
    },
    error: {
        bg: "bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900",
        text: "text-rose-900 dark:text-rose-100",
        icon: <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />,
    },
    warning: {
        bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900",
        text: "text-amber-900 dark:text-amber-100",
        icon: <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
    },
    info: {
        bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900",
        text: "text-blue-900 dark:text-blue-100",
        icon: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
    },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
    const variant = toast.variant || "info";
    const styles = variantStyles[variant];

    React.useEffect(() => {
        const duration = toast.duration ?? 4000;
        if (duration > 0) {
            const timer = setTimeout(onDismiss, duration);
            return () => clearTimeout(timer);
        }
    }, [toast.duration, onDismiss]);

    return (
        <div
            role="alert"
            aria-live="polite"
            className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg",
                "animate-in slide-in-from-right-full duration-300",
                styles.bg,
                styles.text
            )}
        >
            <div className="shrink-0 mt-0.5">{styles.icon}</div>
            <div className="flex-1 min-w-0">
                {toast.title && (
                    <p className="text-sm font-semibold">{toast.title}</p>
                )}
                {toast.description && (
                    <p className="mt-1 text-sm opacity-90">{toast.description}</p>
                )}
            </div>
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Закрыть уведомление"
                className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([]);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const dismiss = React.useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = React.useCallback(
        (newToast: Omit<Toast, "id">) => {
            const id = Math.random().toString(36).slice(2, 9);
            setToasts((prev) => [...prev, { ...newToast, id }]);
            return id;
        },
        []
    );

    const success = React.useCallback(
        (title: string, description?: string) =>
            toast({ title, description, variant: "success" }),
        [toast]
    );

    const error = React.useCallback(
        (title: string, description?: string) =>
            toast({ title, description, variant: "error" }),
        [toast]
    );

    const warning = React.useCallback(
        (title: string, description?: string) =>
            toast({ title, description, variant: "warning" }),
        [toast]
    );

    const info = React.useCallback(
        (title: string, description?: string) =>
            toast({ title, description, variant: "info" }),
        [toast]
    );

    const value = React.useMemo(
        () => ({ toasts, toast, success, error, warning, info, dismiss }),
        [toasts, toast, success, error, warning, info, dismiss]
    );

    return (
        <ToastContext.Provider value={value}>
            {children}
            {mounted &&
                createPortal(
                    <div
                        aria-label="Уведомления"
                        className="pointer-events-none fixed bottom-4 right-4 z-[var(--z-toast)] flex flex-col gap-2"
                    >
                        {toasts.map((t) => (
                            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
                        ))}
                    </div>,
                    document.body
                )}
        </ToastContext.Provider>
    );
}
