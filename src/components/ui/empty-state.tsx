import * as React from "react";
import { Inbox, Search, FileX, AlertCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    variant?: "default" | "search" | "error" | "no-data";
    className?: string;
}

const variantIcons: Record<NonNullable<EmptyStateProps["variant"]>, LucideIcon> = {
    default: Inbox,
    search: Search,
    error: AlertCircle,
    "no-data": FileX,
};

const variantStyles: Record<NonNullable<EmptyStateProps["variant"]>, string> = {
    default: "bg-muted text-muted-foreground",
    search: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
    error: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
    "no-data": "bg-muted text-muted-foreground",
};

export function EmptyState({
    icon,
    title,
    description,
    action,
    variant = "default",
    className,
}: EmptyStateProps) {
    const Icon = icon || variantIcons[variant];
    const iconBgClass = variantStyles[variant];

    return (
        <div
            role="status"
            className={cn(
                "flex flex-col items-center justify-center text-center py-12 px-6",
                className
            )}
        >
            <div
                className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-full mb-4",
                    iconBgClass
                )}
                aria-hidden="true"
            >
                <Icon className="h-8 w-8" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {description && (
                <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
                    {description}
                </p>
            )}
            {action && (
                <Button
                    onClick={action.onClick}
                    variant="outline"
                    size="sm"
                    className="mt-4"
                >
                    {action.label}
                </Button>
            )}
        </div>
    );
}
