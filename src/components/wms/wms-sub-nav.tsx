"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  History,
  Building2,
  PieChart,
  Settings,
  Warehouse,
  ChevronRight,
  Database
} from "lucide-react";

interface WmsSubNavProps {
  totalItemsCount?: number;
  lowStockCount?: number;
}

export default function WmsSubNav({ totalItemsCount, lowStockCount }: WmsSubNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      title: "Реестр ТМЦ и ЗИП",
      href: "/modules/wms",
      exact: true,
      icon: Box,
      badge: totalItemsCount !== undefined ? totalItemsCount : null,
      badgeColor: "bg-blue-100 text-[#3473d4]",
    },
    {
      title: "Движения ТМЦ",
      href: "/modules/wms/movements",
      exact: false,
      icon: History,
      badge: null,
    },
    {
      title: "Склады и Ячейки",
      href: "/modules/wms/warehouses",
      exact: false,
      icon: Warehouse,
      badge: null,
    },
    {
      title: "Отчёты и Аналитика",
      href: "/modules/wms/reports",
      exact: false,
      icon: PieChart,
      badge: null,
    },
  ];

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_2px_8px_rgba(15,23,42,.025)] mb-6 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {/* Tabs list */}
      <div className="flex items-center gap-1.5">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-[#2f74df] text-white shadow-xs shadow-blue-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Icon size={14} className={isActive ? "text-white" : "text-[#3473d4]"} />
              <span>{item.title}</span>
              {item.badge !== null && item.badge !== undefined && (
                <span
                  className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? "bg-white/20 text-white"
                      : item.badgeColor || "bg-slate-100 text-slate-700"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {lowStockCount !== undefined && lowStockCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/60 text-amber-700 text-[10px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Дефицит: {lowStockCount}</span>
          </div>
        )}
        <Link
          href="/admin/settings/wms"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50 shadow-xs transition"
          title="Настройки складов и МОЛ"
        >
          <Settings size={13} className="text-[#3473d4]" />
          <span className="hidden md:inline">Настройки</span>
        </Link>
      </div>
    </div>
  );
}
