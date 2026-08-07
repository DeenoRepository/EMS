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
    <nav aria-label="Хлебные крошки" className="mb-4 flex items-center flex-wrap gap-2 text-[10px] font-medium text-slate-400">
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500 pr-2 border-r border-slate-200">
        <Building className="h-3 w-3 text-[#3473d4] shrink-0" aria-hidden="true" />
        <span className="font-semibold truncate max-w-[140px] sm:max-w-[200px]">{currentFacility.workshop}</span>
      </div>

      <Link href="/" className="hover:text-slate-600 transition-colors">
        Главная
      </Link>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
          {item.href ? (
            <Link href={item.href} className="hover:text-slate-600 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-[#3473d4] font-semibold" aria-current="page">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}

