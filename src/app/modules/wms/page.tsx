"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { WmsItem } from "@/lib/modules/wms-store";
import {
  Database,
  Search,
  Plus,
  RefreshCw,
  X,
  SlidersHorizontal,
  Download,
  Building2,
  ChevronRight,
  Columns3,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Archive,
  Layers,
  Box,
  PackageCheck,
  QrCode,
  DollarSign,
  ArrowUpDown,
  History,
  PieChart,
} from "lucide-react";
import Link from "next/link";
import WmsItemForm from "@/components/wms/wms-item-form";

export interface WmsColumnVisibility {
  sku: boolean;
  name: boolean;
  category: boolean;
  warehouse: boolean;
  cell: boolean;
  quantity: boolean;
  unitPrice: boolean;
  status: boolean;
  actions: boolean;
}

const DEFAULT_WMS_COLUMNS: WmsColumnVisibility = {
  sku: true,
  name: true,
  category: true,
  warehouse: true,
  cell: true,
  quantity: true,
  unitPrice: true,
  status: true,
  actions: true,
};

export default function WmsRegistryPage() {
  const [items, setItems] = useState<WmsItem[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Column visibility state with localStorage persistence
  const [columns, setColumns] = useState<WmsColumnVisibility>(DEFAULT_WMS_COLUMNS);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wms_registry_columns");
      if (saved) {
        const parsed = JSON.parse(saved);
        setColumns({ ...DEFAULT_WMS_COLUMNS, ...parsed });
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleColumn = (key: keyof WmsColumnVisibility) => {
    setColumns((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("wms_registry_columns", JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/modules/wms/items?query=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.category))).filter(Boolean);
  }, [items]);

  const warehouses = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.warehouse))).filter(Boolean);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (warehouseFilter !== "ALL" && item.warehouse !== warehouseFilter) return false;
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
      if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
      return true;
    });
  }, [items, statusFilter, warehouseFilter, categoryFilter, typeFilter]);

  const kpiStats = useMemo(() => {
    const totalPos = items.length;
    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
    const lowStock = items.filter((i) => i.status === "LOW_STOCK" || i.status === "OUT_OF_STOCK").length;
    const reserved = items.reduce((sum, i) => sum + i.reservedQuantity, 0);
    const totalValue = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    return { totalPos, totalQty, lowStock, reserved, totalValue };
  }, [items]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "ALL") count++;
    if (warehouseFilter !== "ALL") count++;
    if (categoryFilter !== "ALL") count++;
    if (typeFilter !== "ALL") count++;
    if (query.trim() !== "") count++;
    return count;
  }, [statusFilter, warehouseFilter, categoryFilter, typeFilter, query]);

  const resetAllFilters = () => {
    setQuery("");
    setStatusFilter("ALL");
    setWarehouseFilter("ALL");
    setCategoryFilter("ALL");
    setTypeFilter("ALL");
  };

  const getStatusBadge = (status: WmsItem["status"]) => {
    switch (status) {
      case "IN_STOCK":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-100">
            <CheckCircle2 size={10} /> В наличии
          </span>
        );
      case "LOW_STOCK":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-100">
            <AlertTriangle size={10} /> Дефицит / Мало
          </span>
        );
      case "OUT_OF_STOCK":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 border border-red-100">
            <X size={10} /> Отсутствует
          </span>
        );
      case "OVERSTOCKED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100">
            <Layers size={10} /> Избыток
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Breadcrumbs & Title */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
              <Link href="/" className="hover:text-slate-600">Главная</Link>
              <ChevronRight size={12} />
              <span className="text-purple-600">WMS Склад</span>
            </div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Реестр ТМЦ, ЗИП и Складских запасов
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Централизованный складской учёт расходных материалов, запасных частей и инструмента (найдено {filteredItems.length} из {items.length} номенклатур).
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/modules/wms/movements" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-50">
              <History size={13} /> Движение ТМЦ
            </Link>
            <Link href="/modules/wms/reports" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-50">
              <PieChart size={13} /> Отчёты
            </Link>
            <a href="/api/modules/wms/items/export" download className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-50">
              <Download size={13} /> Экспорт CSV
            </a>
            <button onClick={fetchItems} disabled={loading} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-50">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
            </button>
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 rounded-lg bg-purple-600 px-3.5 py-2 text-[11px] font-semibold text-white shadow-xs shadow-purple-200 hover:bg-purple-700">
              <Plus size={14} /> Создать карточку ТМЦ
            </button>
          </div>
        </div>

        {/* Quick KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Всего наименований</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <Box size={14} />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-[#17243a]">
              {kpiStats.totalPos} <span className="text-xs font-normal text-slate-400">позиций</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Общий физ. остаток</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <PackageCheck size={14} />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-emerald-600">
              {kpiStats.totalQty} <span className="text-xs font-normal text-slate-400">ед.</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Критический остаток</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <AlertTriangle size={14} />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-amber-600">
              {kpiStats.lowStock} <span className="text-xs font-normal text-slate-400">позиций</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Зарезервировано</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Archive size={14} />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-blue-600">
              {kpiStats.reserved} <span className="text-xs font-normal text-slate-400">ед.</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)] col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Оценка запасов</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <DollarSign size={14} />
              </div>
            </div>
            <div className="mt-2 text-lg font-bold tracking-tight text-[#17243a]">
              {(kpiStats.totalValue / 1000).toFixed(1)}k <span className="text-xs font-normal text-slate-400">руб.</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Поиск по артикулу (SKU), наименованию ТМЦ, ячейке хранения..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 pl-9 pr-8 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:border-purple-500 focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="ALL">Все статусы остатков</option>
                <option value="IN_STOCK">В наличии</option>
                <option value="LOW_STOCK">Дефицит / Мало</option>
                <option value="OUT_OF_STOCK">Отсутствует</option>
                <option value="OVERSTOCKED">Избыток</option>
              </select>

              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="ALL">Все склады</option>
                {warehouses.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="ALL">Все категории</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Column toggle popup toggle */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnMenu(!showColumnMenu)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Columns3 size={13} /> Колонки
                </button>

                {showColumnMenu && (
                  <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Видимость колонок
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {Object.keys(DEFAULT_WMS_COLUMNS).map((key) => (
                        <label key={key} className="flex items-center gap-2 font-medium text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={columns[key as keyof WmsColumnVisibility]}
                            onChange={() => toggleColumn(key as keyof WmsColumnVisibility)}
                            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                          />
                          {key === "sku" && "Артикул / SKU"}
                          {key === "name" && "Наименование"}
                          {key === "category" && "Категория"}
                          {key === "warehouse" && "Склад"}
                          {key === "cell" && "Ячейка"}
                          {key === "quantity" && "Остаток"}
                          {key === "unitPrice" && "Цена за ед."}
                          {key === "status" && "Статус"}
                          {key === "actions" && "Действия"}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {activeFiltersCount > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                >
                  <RotateCcw size={12} /> Сброс ({activeFiltersCount})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* WMS Data Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  {columns.sku && <th className="px-4 py-3">Артикул / SKU</th>}
                  {columns.name && <th className="px-4 py-3">Наименование ТМЦ / ЗИП</th>}
                  {columns.category && <th className="px-4 py-3">Категория</th>}
                  {columns.warehouse && <th className="px-4 py-3">Склад хранения</th>}
                  {columns.cell && <th className="px-4 py-3">Ячейка</th>}
                  {columns.quantity && <th className="px-4 py-3 text-right">Остаток / Мин</th>}
                  {columns.unitPrice && <th className="px-4 py-3 text-right">Цена ед.</th>}
                  {columns.status && <th className="px-4 py-3">Статус</th>}
                  {columns.actions && <th className="px-4 py-3 text-right">Действия</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                      <RefreshCw className="mx-auto mb-2 animate-spin text-purple-500" size={20} />
                      Загрузка реестра складских запасов...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                      Позиции ТМЦ по заданным фильтрам не найдены.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {columns.sku && (
                        <td className="px-4 py-3 font-mono text-[11px] font-bold text-purple-700">
                          <Link href={`/modules/wms/${item.id}`} className="hover:underline">
                            {item.sku}
                          </Link>
                        </td>
                      )}
                      {columns.name && (
                        <td className="px-4 py-3 font-medium text-[#17243a]">
                          <Link href={`/modules/wms/${item.id}`} className="hover:text-purple-600">
                            {item.name}
                          </Link>
                          {item.compatibleEquipment && item.compatibleEquipment.length > 0 && (
                            <div className="mt-0.5 text-[10px] text-slate-400">
                              Совместимо с: {item.compatibleEquipment.join(", ")}
                            </div>
                          )}
                        </td>
                      )}
                      {columns.category && (
                        <td className="px-4 py-3 text-slate-500">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            {item.category}
                          </span>
                        </td>
                      )}
                      {columns.warehouse && (
                        <td className="px-4 py-3 text-slate-600 font-medium">
                          {item.warehouse}
                        </td>
                      )}
                      {columns.cell && (
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                          {item.cell}
                        </td>
                      )}
                      {columns.quantity && (
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${item.quantity <= item.minQuantity ? "text-amber-600" : "text-slate-800"}`}>
                            {item.quantity} {item.unit}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            мин: {item.minQuantity} | рез: {item.reservedQuantity}
                          </span>
                        </td>
                      )}
                      {columns.unitPrice && (
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          {item.unitPrice.toLocaleString("ru-RU")} ₽
                        </td>
                      )}
                      {columns.status && (
                        <td className="px-4 py-3">
                          {getStatusBadge(item.status)}
                        </td>
                      )}
                      {columns.actions && (
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/modules/wms/${item.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-purple-600 hover:bg-purple-50 hover:border-purple-200"
                          >
                            Карточка <ChevronRight size={12} />
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* WMS Item Creation Modal */}
        <WmsItemForm
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmitSuccess={(newItem) => {
            setItems((prev) => [newItem, ...prev]);
          }}
        />
      </main>
    </ShellLayout>
  );
}
