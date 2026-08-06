"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { WmsItem, WmsMovement } from "@/lib/modules/wms-store";
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
  History,
  PieChart,
  Tag,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCcw,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import WmsItemForm from "@/components/wms/wms-item-form";
import WmsOperationModal from "@/components/wms/wms-operation-modal";
import WmsSubNav from "@/components/wms/wms-sub-nav";

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

  // Selection & Bulk Operations State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showOpModal, setShowOpModal] = useState(false);
  const [opModalDefaultType, setOpModalDefaultType] = useState<WmsMovement["type"]>("INCOMING");
  const [opModalSelectedItems, setOpModalSelectedItems] = useState<WmsItem[]>([]);

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

  const types = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.type))).filter(Boolean);
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

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map((i) => i.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((iId) => iId !== id) : [...prev, id]
    );
  };

  const openBulkOperation = (type: WmsMovement["type"]) => {
    const selectedItemsList = items.filter((i) => selectedIds.includes(i.id));
    setOpModalDefaultType(type);
    setOpModalSelectedItems(selectedItemsList.length > 0 ? selectedItemsList : (items[0] ? [items[0]] : []));
    setShowOpModal(true);
  };

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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> В наличии
          </span>
        );
      case "LOW_STOCK":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Дефицит / Мало
          </span>
        );
      case "OUT_OF_STOCK":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-semibold text-rose-700">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Отсутствует
          </span>
        );
      case "OVERSTOCKED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-[#3473d4]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3473d4]" /> Избыток
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Breadcrumbs & Title Block aligned with EPS Standard */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
              <Link href="/" className="hover:text-slate-600">Главная</Link>
              <ChevronRight size={12} />
              <span className="text-[#3473d4] font-semibold">WMS Складской учёт</span>
            </div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Реестр ТМЦ, ЗИП и Складских запасов
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Централизованный учёт номенклатуры, деталей и материалов (найдено {filteredItems.length} из {items.length} ед.).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/modules/wms/items/export"
              download
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <Download size={13} /> Экспорт CSV
            </a>
            <button
              onClick={fetchItems}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              title="Обновить данные"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] transition"
            >
              <Plus size={14} /> Создать ТМЦ
            </button>
          </div>
        </div>

        {/* Quick KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Всего позиций
              </span>
              <div className="rounded-md bg-blue-50 p-1.5 text-[#3473d4]">
                <Layers size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
              {kpiStats.totalPos}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Номенклатур в картотеке</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Физ. остаток
              </span>
              <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-600">
                <PackageCheck size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
              {kpiStats.totalQty} <span className="text-xs font-normal text-slate-400">ед.</span>
            </div>
            <div className="mt-1 text-[10px] text-emerald-600 font-semibold">На складах предприятия</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Дефицит / Мало
              </span>
              <div className="rounded-md bg-amber-50 p-1.5 text-amber-600">
                <AlertTriangle size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-amber-600">
              {kpiStats.lowStock}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Ниже минимального порога</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Зарезервировано
              </span>
              <div className="rounded-md bg-blue-50 p-1.5 text-[#3473d4]">
                <Archive size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
              {kpiStats.reserved} <span className="text-xs font-normal text-slate-400">ед.</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Под плановые ремонты</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)] col-span-2 sm:col-span-1">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Оценка остатков
              </span>
              <div className="rounded-md bg-indigo-50 p-1.5 text-indigo-600">
                <DollarSign size={14} />
              </div>
            </div>
            <div className="mt-2 text-[20px] font-bold tracking-tight text-[#17243a]">
              {(kpiStats.totalValue / 1000).toFixed(1)}k ₽
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Балансовая стоимость</div>
          </div>
        </div>

        {/* Enhanced Filter Toolbar & Column Selector */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            {/* Search Input */}
            <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
              <div className="relative w-full">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Поиск по артикулу (SKU), наименованию ТМЦ, ячейке хранения..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-[#f8fafc] pl-9 pr-8 text-[11px] outline-none placeholder:text-slate-400 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1 text-[#3473d4]">
                <SlidersHorizontal size={13} />
                <span className="font-semibold text-[11px]">Фильтры:</span>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`h-8 rounded-lg border px-2.5 text-[10px] outline-none transition ${
                  statusFilter !== "ALL"
                    ? "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold"
                    : "border-slate-200 bg-[#f8fafc] text-slate-600 focus:border-[#3c82ed]"
                }`}
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
                className={`h-8 rounded-lg border px-2.5 text-[10px] outline-none transition ${
                  warehouseFilter !== "ALL"
                    ? "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold"
                    : "border-slate-200 bg-[#f8fafc] text-slate-600 focus:border-[#3c82ed]"
                }`}
              >
                <option value="ALL">Все склады</option>
                {warehouses.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`h-8 rounded-lg border px-2.5 text-[10px] outline-none transition ${
                  categoryFilter !== "ALL"
                    ? "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold"
                    : "border-slate-200 bg-[#f8fafc] text-slate-600 focus:border-[#3c82ed]"
                }`}
              >
                <option value="ALL">Все категории</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Column Selector Toggle */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnMenu(!showColumnMenu)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-50"
                  title="Настройка видимости колонок"
                >
                  <Columns3 size={13} className="text-[#3473d4]" />
                  <span>Колонки</span>
                </button>

                {showColumnMenu && (
                  <div className="absolute right-0 top-10 z-30 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-[#17243a] text-[11px]">Отображение колонок</span>
                      <button onClick={() => setShowColumnMenu(false)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="space-y-1.5 pt-1 text-[11px]">
                      {Object.keys(DEFAULT_WMS_COLUMNS).map((key) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer text-slate-700 hover:bg-slate-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={columns[key as keyof WmsColumnVisibility]}
                            onChange={() => toggleColumn(key as keyof WmsColumnVisibility)}
                            className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                          />
                          <span>
                            {key === "sku" && "Артикул / SKU"}
                            {key === "name" && "Наименование"}
                            {key === "category" && "Категория"}
                            {key === "warehouse" && "Склад"}
                            {key === "cell" && "Ячейка"}
                            {key === "quantity" && "Остаток"}
                            {key === "unitPrice" && "Цена ед."}
                            {key === "status" && "Статус"}
                            {key === "actions" && "Действие"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Active Filter Chips */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-xs px-1">
              <span className="text-[10px] font-semibold text-slate-400">Активные фильтры:</span>

              {query && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100">
                  Поиск: "{query}"
                  <button onClick={() => setQuery("")} className="hover:text-blue-800">
                    <X size={11} />
                  </button>
                </span>
              )}

              {statusFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100">
                  Статус: {statusFilter}
                  <button onClick={() => setStatusFilter("ALL")} className="hover:text-blue-800">
                    <X size={11} />
                  </button>
                </span>
              )}

              {warehouseFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100">
                  Склад: {warehouseFilter}
                  <button onClick={() => setWarehouseFilter("ALL")} className="hover:text-blue-800">
                    <X size={11} />
                  </button>
                </span>
              )}

              {categoryFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100">
                  Категория: {categoryFilter}
                  <button onClick={() => setCategoryFilter("ALL")} className="hover:text-blue-800">
                    <X size={11} />
                  </button>
                </span>
              )}

              <button onClick={resetAllFilters} className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700 ml-1">
                <RotateCcw size={10} /> Сбросить все
              </button>
            </div>
          )}
        </div>

        {/* Bulk Action Toolbar when items are selected */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2f74df] text-[11px] font-bold text-white">
                {selectedIds.length}
              </span>
              <span className="font-bold text-[#17243a]">Выбрано позиций ТМЦ</span>
              <button
                onClick={() => setSelectedIds([])}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-700 underline ml-2"
              >
                Снять выделение
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => openBulkOperation("INCOMING")}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 shadow-xs transition"
              >
                <ArrowDownLeft size={13} /> Массовый приход
              </button>
              <button
                onClick={() => openBulkOperation("TRANSFER")}
                className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#2565c8] shadow-xs transition"
              >
                <RefreshCcw size={13} /> Массовое перемещение
              </button>
              <button
                onClick={() => openBulkOperation("OUTGOING")}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-700 shadow-xs transition"
              >
                <ArrowUpRight size={13} /> Массовое списание
              </button>
              <button
                onClick={() => openBulkOperation("PERSONAL_CARD")}
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-purple-700 shadow-xs transition"
              >
                <UserCheck size={13} /> Массовая выдача
              </button>
            </div>
          </div>
        )}

        {/* WMS Data Table styled 1-in-1 with EPS Equipment Table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
          <div className="hidden border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 md:grid grid-cols-12 gap-3 items-center">
            <div className="col-span-1 flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200 cursor-pointer"
              />
            </div>
            {columns.sku && <span className="col-span-2">Артикул / SKU</span>}
            {columns.name && <span className="col-span-3">Наименование ТМЦ</span>}
            {columns.category && <span className="col-span-2">Категория & Тип</span>}
            {columns.warehouse && <span className="col-span-2">Склад / Ячейка</span>}
            {columns.quantity && <span className="col-span-1">Остаток & Статус</span>}
            {columns.actions && <span className="col-span-1 text-right">Действия</span>}
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400">
              <RefreshCw className="mx-auto mb-2 animate-spin text-[#3473d4]" size={20} />
              Загрузка реестра складских запасов...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400 space-y-2">
              <p>Позиции ТМЦ по заданным критериям фильтрации не найдены.</p>
              {activeFiltersCount > 0 && (
                <button onClick={resetAllFilters} className="text-[11px] font-semibold text-[#3473d4] hover:underline">
                  Сбросить все фильтры
                </button>
              )}
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-2 border-b border-slate-100 px-5 py-3.5 last:border-0 md:items-center md:gap-3 transition text-xs ${
                    isSelected ? "bg-blue-50/40" : "hover:bg-slate-50/50"
                  }`}
                >
                  <div className="col-span-1 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectItem(item.id)}
                      className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200 cursor-pointer"
                    />
                  </div>

                  {columns.sku && (
                    <div className="col-span-2 font-mono">
                      <Link href={`/modules/wms/${item.id}`} className="block text-[11px] font-bold text-[#3473d4] hover:underline">
                        {item.sku}
                      </Link>
                      {item.barcode && <span className="block text-[10px] text-slate-400 mt-0.5">ШК: {item.barcode}</span>}
                    </div>
                  )}

                  {columns.name && (
                    <div className="col-span-3">
                      <Link href={`/modules/wms/${item.id}`} className="block text-[11px] font-semibold text-[#17243a] hover:text-[#3473d4]">
                        {item.name}
                      </Link>
                      {item.compatibleEquipment && item.compatibleEquipment.length > 0 && (
                        <span className="block text-[10px] text-slate-400">Совместимо: {item.compatibleEquipment.join(", ")}</span>
                      )}
                    </div>
                  )}

                  {columns.category && (
                    <div className="col-span-2">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                        <Tag size={12} className="text-slate-400" />
                        <span>{item.category}</span>
                      </div>
                      <span className="block text-[10px] text-slate-400">{item.type}</span>
                    </div>
                  )}

                  {columns.warehouse && (
                    <div className="col-span-2">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                        <Building2 size={12} className="text-slate-400" />
                        <span>{item.warehouse}</span>
                      </div>
                      <span className="block text-[10px] font-mono text-slate-400">{item.cell}</span>
                    </div>
                  )}

                  {columns.quantity && (
                    <div className="col-span-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold text-[11px] ${item.quantity <= item.minQuantity ? "text-amber-600" : "text-[#17243a]"}`}>
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                      <div className="mt-0.5">{getStatusBadge(item.status)}</div>
                    </div>
                  )}

                  {columns.actions && (
                    <div className="col-span-1 text-right">
                      <Link
                        href={`/modules/wms/${item.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-[#3473d4] hover:bg-blue-50 hover:border-blue-200 transition shadow-xs"
                      >
                        Открыть <ChevronRight size={11} />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* WMS Item Creation Modal */}
        <WmsItemForm
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmitSuccess={(newItem) => {
            setItems((prev) => [newItem, ...prev]);
          }}
        />

        {/* WMS Operation Modal with Bulk Support */}
        <WmsOperationModal
          isOpen={showOpModal}
          onClose={() => {
            setShowOpModal(false);
            setOpModalSelectedItems([]);
          }}
          items={items}
          selectedItems={opModalSelectedItems}
          defaultType={opModalDefaultType}
          onSubmitSuccess={(_, updatedItems) => {
            if (updatedItems && updatedItems.length > 0) {
              setItems((prev) =>
                prev.map((i) => {
                  const match = updatedItems.find((u) => u.id === i.id);
                  return match ? { ...i, ...match } : i;
                })
              );
              setSelectedIds([]);
            }
          }}
        />
      </main>
    </ShellLayout>
  );
}

