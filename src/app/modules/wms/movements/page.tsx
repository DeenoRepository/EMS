"use client";

import { useState, useMemo } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { MOCK_WMS_MOVEMENTS, WmsMovement } from "@/lib/modules/wms-store";
import {
  History,
  Search,
  Plus,
  Filter,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCcw,
  Archive,
  Download,
  Calendar
} from "lucide-react";
import Link from "next/link";

export default function WmsMovementsPage() {
  const [movements, setMovements] = useState<WmsMovement[]>(MOCK_WMS_MOVEMENTS);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (typeFilter !== "ALL" && m.type !== typeFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          m.itemName.toLowerCase().includes(q) ||
          m.itemSku.toLowerCase().includes(q) ||
          m.performedBy.toLowerCase().includes(q) ||
          (m.reason && m.reason.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [movements, query, typeFilter]);

  const getTypeBadge = (type: WmsMovement["type"]) => {
    switch (type) {
      case "INCOMING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-100">
            <ArrowDownLeft size={10} /> Приход / Поступление
          </span>
        );
      case "OUTGOING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-100">
            <ArrowUpRight size={10} /> Расход / Списание
          </span>
        );
      case "TRANSFER":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100">
            <RefreshCcw size={10} /> Перемещение
          </span>
        );
      case "RESERVE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-100">
            <Archive size={10} /> Резервирование
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
              <Link href="/" className="hover:text-slate-600">Главная</Link>
              <ChevronRight size={12} />
              <Link href="/modules/wms" className="hover:text-slate-600">WMS Склад</Link>
              <ChevronRight size={12} />
              <span className="text-purple-600">Журнал движения ТМЦ</span>
            </div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Журнал складских операций и движений ЗИП
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Полный хронологический аудит приходов, списаний на ремонты и внутренних перемещений.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/modules/wms"
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-50"
            >
              Вернуться в Реестр
            </Link>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Поиск по ТМЦ, артикулу, сотруднику, причине..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-1.5 text-xs text-slate-700 focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-purple-500 focus:outline-none"
            >
              <option value="ALL">Все типы операций</option>
              <option value="INCOMING">Приход / Поступление</option>
              <option value="OUTGOING">Расход / Списание</option>
              <option value="TRANSFER">Перемещение</option>
              <option value="RESERVE">Резервирование</option>
            </select>
          </div>
        </div>

        {/* Movements Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Дата & Время</th>
                <th className="px-4 py-3">Тип операции</th>
                <th className="px-4 py-3">Артикул / Наименование ТМЦ</th>
                <th className="px-4 py-3 text-right">Кол-во</th>
                <th className="px-4 py-3">Откуда → Куда</th>
                <th className="px-4 py-3">Ответственный</th>
                <th className="px-4 py-3">Основание / Объект</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Операций движения за выбранный период не найдено.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(m.timestamp).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-4 py-3">{getTypeBadge(m.type)}</td>
                    <td className="px-4 py-3 font-medium text-[#17243a]">
                      <div className="font-mono text-[11px] font-bold text-purple-700">{m.itemSku}</div>
                      <div>{m.itemName}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      {m.type === "OUTGOING" ? "-" : "+"}{m.quantity} ед.
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[11px]">
                      {m.fromLocation || "—"} → <span className="font-semibold text-slate-700">{m.toLocation || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{m.performedBy}</td>
                    <td className="px-4 py-3 text-slate-500 text-[11px]">
                      {m.reason}
                      {m.relatedOrderOrEq && (
                        <span className="block font-mono text-purple-600 font-semibold">{m.relatedOrderOrEq}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </ShellLayout>
  );
}
