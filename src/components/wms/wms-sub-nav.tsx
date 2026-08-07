"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, History, PieChart, Settings, Warehouse } from "lucide-react";
import { TabNav, TabNavItem } from "@/components/ui";

interface WmsSubNavProps {
  totalItemsCount?: number;
  lowStockCount?: number;
}

export default function WmsSubNav({ totalItemsCount, lowStockCount }: WmsSubNavProps) {
  const pathname = usePathname();

  const items: TabNavItem[] = [
    {
      id: "items",
      label: "Реестр ТМЦ и ЗИП",
      href: "/modules/wms",
      icon: <Box size={14} />,
      badge: totalItemsCount !== undefined ? totalItemsCount : null,
      badgeColor: "bg-blue-100 text-[#3473d4]",
    },
    {
      id: "movements",
      label: "Движения ТМЦ",
      href: "/modules/wms/movements",
      icon: <History size={14} />,
    },
    {
      id: "warehouses",
      label: "Склады и Ячейки",
      href: "/modules/wms/warehouses",
      icon: <Warehouse size={14} />,
    },
    {
      id: "reports",
      label: "Отчёты и Аналитика",
      href: "/modules/wms/reports",
      icon: <PieChart size={14} />,
    },
  ];

  const activeItem = items.find((i) =>
    i.id === "items" ? pathname === "/modules/wms" : pathname.startsWith(i.href || "")
  );

  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <TabNav items={items} activeId={activeItem?.id || "items"} className="flex-1 mb-0" />
      <div className="flex items-center gap-2 shrink-0">
        {lowStockCount !== undefined && lowStockCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 text-[10px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Дефицит: {lowStockCount}</span>
          </div>
        )}
        <Link
          href="/admin/settings/wms"
          className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition"
          title="Настройки складов и МОЛ"
        >
          <Settings size={13} className="text-[#3473d4] dark:text-blue-400" />
          <span className="hidden md:inline">Настройки</span>
        </Link>
      </div>
    </div>
  );
}
