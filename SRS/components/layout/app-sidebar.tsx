"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  BarChart3,
  Gauge,
  UsersRound,
  Settings,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ru } from "@/lib/i18n";
import { useState } from "react";
import type { ReactNode } from "react";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { hasAnyRole } from "@/lib/client/auth";

interface NavItem {
  label: string;
  description: string;
  href: string;
  icon: ReactNode;
  roles?: Array<"VIEWER" | "ANALYST" | "ADMIN">;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { label: ru.sidebar.dashboard, description: "KPI, динамика событий и загрузка оборудования", href: "/dashboard", icon: <BarChart3 className="h-5 w-5" />, roles: ["VIEWER", "ANALYST", "ADMIN"] },
  { label: ru.sidebar.equipment, description: "Карта тепла, фильтры и таймлайны простоев", href: "/failures", icon: <Gauge className="h-5 w-5" />, roles: ["VIEWER", "ANALYST", "ADMIN"] },
  { label: ru.sidebar.myRequests, description: "Анализ исполнителей, длительности и пиков", href: "/employees", icon: <UsersRound className="h-5 w-5" />, roles: ["ANALYST", "ADMIN"] },
  { label: "Настройки", description: "Подключение Jira, тест соединения и запуск импорта", href: "/settings", icon: <Settings className="h-5 w-5" />, roles: ["ADMIN", "ANALYST"] }
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) => (prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]));
  };

  const isActive = (href: string) => pathname === href;

  const visibleItems = navItems.filter((item) => !item.roles || hasAnyRole(user, item.roles as any));

  return (
    <aside className="fixed left-0 top-0 z-50 h-screen w-72 border-r border-sidebar-border bg-sidebar pt-6">
      <div className="px-4 pb-6">
        <div className="flex items-center gap-3 px-2 py-1">
          <Image
            src="/eps-logo-v2.png"
            alt="EFA"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-sidebar-border/60"
          />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-5 text-sidebar-foreground">EFA</div>
            <div className="truncate text-[11px] leading-4 text-sidebar-foreground/70">{ru.sidebar.equipmentCaption}</div>
          </div>
        </div>
      </div>

      <nav className="space-y-1 px-3">
        {visibleItems.map((item) => (
          <div key={item.label}>
            <Link
              href={item.href as any}
              onClick={(e) => {
                if (item.children) {
                  e.preventDefault();
                  toggleExpanded(item.label);
                }
              }}
              className={cn(
                "flex items-start gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/40"
              )}
            >
              {item.icon}
              <span className="flex-1">
                <span className="block">{item.label}</span>
                <span
                  className={cn(
                    "mt-0.5 block text-[11px] leading-4",
                    isActive(item.href) ? "text-sidebar-accent-foreground/80" : "text-sidebar-foreground/60"
                  )}
                >
                  {item.description}
                </span>
              </span>
              {item.children && (
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", expandedItems.includes(item.label) && "rotate-180")}
                />
              )}
            </Link>
            {item.children && expandedItems.includes(item.label) && (
              <div className="ml-2 space-y-1 border-l border-sidebar-border py-2">
                {item.children.map((child) => (
                  <Link
                    key={child.label}
                    href={child.href as any}
                    className={cn(
                      "block rounded-md px-3 py-2 text-xs font-medium transition-colors",
                      isActive(child.href)
                        ? "bg-sidebar-primary/20 text-sidebar-primary"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                    )}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t border-sidebar-border bg-sidebar-background p-4">
        <div className="text-xs text-sidebar-foreground/60">
          <p className="font-semibold">{ru.sidebar.systemStatus}</p>
          <p className="mt-1 text-sidebar-foreground/40">{ru.sidebar.systemOk}</p>
        </div>
      </div>
    </aside>
  );
}
