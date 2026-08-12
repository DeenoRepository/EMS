import * as React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  title: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  breadcrumbs = [],
  actions,
  className,
  icon,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col justify-between gap-4 md:flex-row md:items-end", className)}>
      <div className="min-w-0 flex-1">
        {breadcrumbs.length > 0 && (
          <nav aria-label="Хлебные крошки" className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                {index === 0 && item.href === "/" ? (
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    aria-label="Главная"
                  >
                    <Home className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                ) : item.href ? (
                  <Link
                    href={item.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {item.title}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium" aria-current="page">
                    {item.title}
                  </span>
                )}
                {index < breadcrumbs.length - 1 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground text-balance">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
