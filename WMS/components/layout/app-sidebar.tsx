"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { BarChart3, Boxes, Building2, LayoutDashboard, MapPin, PackageCheck, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { hasAnyRole } from "@/lib/client/auth";
import { useWmsScope } from "@/lib/client/use-wms-scope";

interface NavItem {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: ReactNode;
  roles?: Array<"VIEWER" | "EDITOR" | "APPROVER" | "ADMIN">;
}

const navItems: NavItem[] = [
  { key: "dashboard", label: "Панель управления", description: "Ключевые показатели склада", href: "/wms", icon: <LayoutDashboard className="h-5 w-5" />, roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"] },
  { key: "warehouses", label: "Склады", description: "Справочник складов", href: "/wms/warehouses", icon: <Building2 className="h-5 w-5" />, roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"] },
  { key: "items", label: "Номенклатура", description: "SKU и карточки позиций", href: "/wms/items", icon: <PackageCheck className="h-5 w-5" />, roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"] },
  { key: "balances", label: "Остатки", description: "Текущие остатки и low stock", href: "/wms/balances", icon: <Boxes className="h-5 w-5" />, roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"] },
  { key: "movements", label: "Движения", description: "Приход, выдача, перенос, корректировка", href: "/wms/movements", icon: <Repeat className="h-5 w-5" />, roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"] },
  { key: "my_requests", label: "Мои заявки", description: "Заявки, резервирование и дефицит", href: "/wms/internal-requests", icon: <MapPin className="h-5 w-5" />, roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"] },
  { key: "reservations", label: "Резервы", description: "Резервы под заявки MMS", href: "/wms/reservations", icon: <MapPin className="h-5 w-5" />, roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"] },
  { key: "analytics", label: "Аналитика", description: "Складская аналитика", href: "/wms/analytics", icon: <BarChart3 className="h-5 w-5" />, roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"] }
  ,{ key: "audit", label: "Аудит", description: "Журнал действий системы", href: "/wms/audit", icon: <BarChart3 className="h-5 w-5" />, roles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"] }
  ,{ key: "settings", label: "Настройки", description: "Параметры проекта и аудит", href: "/wms/settings", icon: <Building2 className="h-5 w-5" />, roles: ["ADMIN"] }
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const { scope } = useWmsScope();
  const isActive = (href: string) => {
    if (href === "/wms") return pathname === "/wms";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const visibleByScope = (key: string) => {
    if (!scope) return true;
    if (scope.access === "ADMIN") return key !== "my_requests";
    if (scope.access === "AUXILIARY") return ["dashboard", "balances", "movements", "my_requests"].includes(key);
    if (scope.access === "CENTRAL") return ["dashboard", "balances", "movements", "my_requests", "reservations", "analytics", "audit"].includes(key);
    return false;
  };

  const visibleItems = navItems.filter((item) => (!item.roles || hasAnyRole(user, item.roles)) && visibleByScope(item.key));

  return (
    <aside className="fixed left-0 top-0 z-50 h-screen w-72 border-r border-sidebar-border bg-sidebar pt-6">
      <div className="px-4 pb-6">
        <div className="flex items-center gap-3 px-2 py-1">
          <Image src="/eps-logo-v2.png" alt="WMS" width={36} height={36} className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-sidebar-border/60" />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-5 text-sidebar-foreground">WMS</div>
            <div className="truncate text-[11px] leading-4 text-sidebar-foreground/70">Управление складом</div>
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
              isActive(item.href) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/40"
            )}
          >
            {item.icon}
            <span className="flex-1">
              <span className="block">{item.label}</span>
              <span className={cn("mt-0.5 block text-[11px] leading-4", isActive(item.href) ? "text-sidebar-accent-foreground/80" : "text-sidebar-foreground/60")}>{item.description}</span>
            </span>
          </Link>
        ))}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t border-sidebar-border bg-sidebar-background p-4">
        <div className="text-xs text-sidebar-foreground/60">
          <p className="font-semibold">Статус системы</p>
          <p className="mt-1 text-sidebar-foreground/40">WMS сервисы активны</p>
        </div>
      </div>
    </aside>
  );
}
