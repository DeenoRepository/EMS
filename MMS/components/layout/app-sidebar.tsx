"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { AlertTriangle, BarChart3, CalendarClock, ClipboardList, LayoutDashboard, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { hasAnyRole } from "@/lib/client/auth";

interface NavItem {
  label: string;
  description: string;
  href: string;
  icon: ReactNode;
  roles?: Array<"VIEWER" | "EDITOR" | "APPROVER" | "ADMIN">;
}

const navItems: NavItem[] = [
  {
    label: "Панель ТОиР",
    description: "Операционная сводка и приоритеты",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"]
  },
  {
    label: "Планы ППР",
    description: "Индивидуальные планы по оборудованию",
    href: "/ppr-plans",
    icon: <CalendarClock className="h-5 w-5" />,
    roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"]
  },
  {
    label: "Операции",
    description: "Исполнение и статусы работ",
    href: "/operations",
    icon: <Wrench className="h-5 w-5" />,
    roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"]
  },
  {
    label: "Наряды",
    description: "Work orders и SLA",
    href: "/work-orders",
    icon: <ClipboardList className="h-5 w-5" />,
    roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"]
  },
  {
    label: "График",
    description: "Планирование по исполнителям",
    href: "/schedule",
    icon: <CalendarClock className="h-5 w-5" />,
    roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"]
  },
  {
    label: "Отказы и RCA",
    description: "Журнал отказов и расследования",
    href: "/failures",
    icon: <AlertTriangle className="h-5 w-5" />,
    roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"]
  },
  {
    label: "Аналитика",
    description: "KPI ППР и RCA",
    href: "/analytics",
    icon: <BarChart3 className="h-5 w-5" />,
    roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"]
  }
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const visibleItems = navItems.filter((item) => !item.roles || hasAnyRole(user, item.roles));

  return (
    <aside className="fixed left-0 top-0 z-50 h-screen w-72 border-r border-sidebar-border bg-sidebar pt-6">
      <div className="px-4 pb-6">
        <div className="flex items-center gap-3 px-2 py-1">
          <Image
            src="/eps-logo-v2.png"
            alt="MMS"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-sidebar-border/60"
          />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-5 text-sidebar-foreground">MMS</div>
            <div className="truncate text-[11px] leading-4 text-sidebar-foreground/70">Техническое обслуживание и ремонт</div>
          </div>
        </div>
      </div>

      <nav className="space-y-1 px-3">
        {visibleItems.map((item) => (
          <Link
            key={item.label}
            href={item.href as any}
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
              <span className={cn("mt-0.5 block text-[11px] leading-4", isActive(item.href) ? "text-sidebar-accent-foreground/80" : "text-sidebar-foreground/60")}>
                {item.description}
              </span>
            </span>
          </Link>
        ))}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t border-sidebar-border bg-sidebar-background p-4">
        <div className="text-xs text-sidebar-foreground/60">
          <p className="font-semibold">Статус системы</p>
          <p className="mt-1 text-sidebar-foreground/40">Сервисы активны</p>
        </div>
      </div>
    </aside>
  );
}
