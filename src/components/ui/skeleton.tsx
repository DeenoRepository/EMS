import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "text" | "circular" | "rectangular";
    width?: string | number;
    height?: string | number;
    lines?: number;
}

function Skeleton({
    className,
    variant = "rectangular",
    width,
    height,
    style,
    ...props
}: SkeletonProps) {
    const variantClasses = {
        text: "h-4 w-full rounded",
        circular: "rounded-full",
        rectangular: "rounded-md",
    };

    return (
        <div
            role="status"
            aria-label="Загрузка"
            className={cn(
                "animate-pulse bg-muted",
                variantClasses[variant],
                className
            )}
            style={{
                width: typeof width === "number" ? `${width}px` : width,
                height: typeof height === "number" ? `${height}px` : height,
                ...style,
            }}
            {...props}
        />
    );
}

function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
    return (
        <div className={cn("space-y-2", className)} role="status" aria-label="Загрузка текста">
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    variant="text"
                    className={i === lines - 1 ? "w-3/4" : "w-full"}
                />
            ))}
        </div>
    );
}

function SkeletonCard({ className }: { className?: string }) {
    return (
        <div
            role="status"
            aria-label="Загрузка карточки"
            className={cn(
                "rounded-xl border border-border bg-card p-6 space-y-4",
                className
            )}
        >
            <div className="flex items-center gap-3">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="flex-1 space-y-2">
                    <Skeleton variant="text" className="w-1/2" />
                    <Skeleton variant="text" className="w-1/3" />
                </div>
            </div>
            <SkeletonText lines={3} />
        </div>
    );
}

function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
    return (
        <div
            role="status"
            aria-label="Загрузка таблицы"
            className="rounded-xl border border-border bg-card overflow-hidden"
        >
            <div className="border-b border-border bg-muted/50 p-4">
                <div className="flex gap-4">
                    {Array.from({ length: columns }).map((_, i) => (
                        <Skeleton key={i} variant="text" className="flex-1" />
                    ))}
                </div>
            </div>
            <div className="divide-y divide-border">
                {Array.from({ length: rows }).map((_, rowIdx) => (
                    <div key={rowIdx} className="flex gap-4 p-4">
                        {Array.from({ length: columns }).map((_, colIdx) => (
                            <Skeleton
                                key={colIdx}
                                variant="text"
                                className="flex-1"
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonTable };
