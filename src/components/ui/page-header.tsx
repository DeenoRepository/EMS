import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
}

export function PageHeader({
  title,
  description,
  breadcrumbs = [],
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col justify-between gap-4 md:flex-row md:items-end", className)}>
      <div>
        {breadcrumbs.length > 0 && (
          <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400 dark:text-slate-500">
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight size={12} />}
                {item.href ? (
                  <Link href={item.href} className="hover:text-slate-600 dark:hover:text-slate-300 transition">
                    {item.title}
                  </Link>
                ) : (
                  <span className="text-[#3473d4] dark:text-blue-400 font-semibold">{item.title}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
        <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a] dark:text-slate-100">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
