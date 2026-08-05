"use client";

import Link from "next/link";
import { ChevronRight, Home, Building } from "lucide-react";
import { useShell } from "./shell-context";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const { currentFacility } = useShell();

  return (
    <nav aria-label="Хлебные крошки" className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground mb-5 bg-card/40 border border-border/50 px-3.5 py-2 rounded-xl backdrop-blur-xs shadow-2xs">
      <div className="flex items-center gap-1.5 text-primary/80 font-mono text-[11px] pr-2 border-r border-border/60">
        <Building className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
        <span className="font-semibold truncate max-w-[140px] sm:max-w-[200px]">{currentFacility.workshop}</span>
      </div>

      <Link href="/" className="flex items-center gap-1 hover:text-foreground font-medium transition-colors">
        <Home className="h-3.5 w-3.5 text-muted-foreground/80" aria-hidden="true" />
        <span>Главная</span>
      </Link>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center space-x-2">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" aria-hidden="true" />
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground font-medium transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-md" aria-current="page">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}

