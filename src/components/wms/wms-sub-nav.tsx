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
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-2 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-2 py-1 border-b border-slate-100 mb-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-[#3473d4]/10 text-[#3473d4] flex items-center justify-center font-bold">
            <Database size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 leading-none">Складской учёт (WMS)</h1>
              <span className="text-[10px] font-semibold bg-[#3473d4]/10 text-[#3473d4] px-2 py-0.5 rounded-full">
                v2.4
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Управление запасами, ячейками хранения, логистикой и движением ТМЦ</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {lowStockCount !== undefined && lowStockCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/60 text-amber-800 text-[11px] font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Дефицит: <strong>{lowStockCount}</strong> поз.</span>
            </div>
          )}
          <Link
            href="/admin/settings/wms"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Настройки складов и МОЛ"
          >
            <Settings size={14} />
            <span className="hidden md:inline">Настройки складов</span>
          </Link>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                isActive
                  ? "bg-[#3473d4] text-white shadow-sm shadow-[#3473d4]/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <Icon size={15} className={isActive ? "text-white" : "text-slate-500"} />
              <span>{item.title}</span>
              {item.badge !== null && item.badge !== undefined && (
                <span
                  className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? "bg-white/20 text-white"
                      : item.badgeColor || "bg-slate-200 text-slate-700"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
