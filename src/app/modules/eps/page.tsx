"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { EquipmentItem } from "@/lib/modules/eps-store";
import {
  Server,
  Search,
  Plus,
  RefreshCw,
  X,
  SlidersHorizontal,
  Download,
  Building2,
  Tag,
  ChevronRight,
  Columns3,
  RotateCcw,
  Activity,
  CheckCircle2,
  AlertCircle,
  Archive,
  Layers,
} from "lucide-react";
import Link from "next/link";
import EquipmentPassportForm from "@/components/eps/equipment-passport-form";

export interface ColumnVisibility {
  code: boolean;
  name: boolean;
  category: boolean;
  department: boolean;
  status: boolean;
  actions: boolean;
}

const DEFAULT_COLUMNS: ColumnVisibility = {
  code: true,
  name: true,
  category: true,
  department: true,
  status: true,
  actions: true,
};

export default function EpsEquipmentPage() {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Column visibility state with localStorage persistence
  const [columns, setColumns] = useState<ColumnVisibility>(DEFAULT_COLUMNS);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("eps_registry_columns");
      if (saved) {
        const parsed = JSON.parse(saved);
        setColumns({ ...DEFAULT_COLUMNS, ...parsed });
      }
    } catch {
      // Игнорируем ошибки чтения localStorage
    }
  }, []);

  const toggleColumn = (key: keyof ColumnVisibility) => {
    setColumns((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("eps_registry_columns", JSON.stringify(updated));
      } catch {
        // Игнорируем
      }
      return updated;
    });
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/modules/eps/equipment?query=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // Игнорируем сетевые ошибки
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

  const departments = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.department))).filter(Boolean);
  }, [items]);

  const types = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.type))).filter(Boolean);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (departmentFilter !== "ALL" && item.department !== departmentFilter) return false;
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
      if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
      return true;
    });
  }, [items, statusFilter, departmentFilter, categoryFilter, typeFilter]);

  const kpiStats = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.status === "ACTIVE").length;
    const reserve = items.filter((i) => i.status === "INACTIVE" || i.status === "DRAFT").length;
    const decommissioned = items.filter((i) => i.status === "DECOMMISSIONED").length;
    const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;
    return { total, active, reserve, decommissioned, activeRate };
  }, [items]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "ALL") count++;
    if (departmentFilter !== "ALL") count++;
    if (categoryFilter !== "ALL") count++;
    if (typeFilter !== "ALL") count++;
    if (query.trim() !== "") count++;
    return count;
  }, [statusFilter, departmentFilter, categoryFilter, typeFilter, query]);

  const resetAllFilters = () => {
    setQuery("");
    setStatusFilter("ALL");
    setDepartmentFilter("ALL");
    setCategoryFilter("ALL");
    setTypeFilter("ALL");
  };

  // Dynamic grid template calculation based on visible columns
  const gridTemplateClass = useMemo(() => {
    const parts: string[] = [];
    if (columns.code) parts.push("1.2fr");
    if (columns.name) parts.push("2fr");
    if (columns.category) parts.push("1.5fr");
    if (columns.department) parts.push("1.5fr");
    if (columns.status) parts.push("1fr");
    if (columns.actions) parts.push("1fr");

    if (parts.length === 0) return "1fr";
    return parts.join(" ");
  }, [columns]);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Breadcrumbs & Title */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
              <Link href="/" className="hover:text-slate-600">Главная</Link>
              <ChevronRight size={12} />
              <span className="text-[#3473d4]">EPS Паспортизация</span>
            </div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Реестр оборудования EPS
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Централизованный корпоративный учет единиц производственного оборудования (найдено {filteredItems.length} из {items.length} ед.).
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/api/modules/eps/equipment/export" download className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
              <Download size={13} /> Экспорт CSV
            </a>
            <button onClick={fetchItems} disabled={loading} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
            </button>
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]">
              <Plus size={14} /> Создать паспорт
            </button>
          </div>
        </div>

        {/* Quick KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Всего единиц
              </span>
              <div className="rounded-md bg-blue-50 p-1.5 text-[#3473d4]">
                <Layers size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
              {kpiStats.total}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Паспортизировано в системе</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                В эксплуатации
              </span>
              <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-600">
                <CheckCircle2 size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
              {kpiStats.active}
            </div>
            <div className="mt-1 text-[10px] text-emerald-600 font-semibold">{kpiStats.activeRate}% от общего парка</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                В резерве / Черновик
              </span>
              <div className="rounded-md bg-amber-50 p-1.5 text-amber-600">
                <AlertCircle size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
              {kpiStats.reserve}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Готовится к вводу</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Списано / Выведено
              </span>
              <div className="rounded-md bg-slate-100 p-1.5 text-slate-500">
                <Archive size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
              {kpiStats.decommissioned}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">В архиве</div>
          </div>
        </div>

        {/* Modal Create Equipment Passport */}
        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
            onClick={() => setShowCreateModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#eef5ff] text-[#3473d4]">
                    <Server size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#17243a]">Создание нового паспорта оборудования</h3>
                    <p className="text-[10px] text-slate-400">Внесите технические параметры единицы оборудования</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <EquipmentPassportForm
                onSubmit={async (formData) => {
                  setCreating(true);
                  try {
                    const res = await fetch("/api/modules/eps/equipment", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(formData),
                    });

                    if (res.ok) {
                      setShowCreateModal(false);
                      fetchItems();
                    } else {
                      const err = await res.json();
                      alert(err.error || "Ошибка создания паспорта");
                    }
                  } catch {
                    alert("Ошибка создания паспорта");
                  } finally {
                    setCreating(false);
                  }
                }}
                onCancel={() => setShowCreateModal(false)}
                submitting={creating}
              />
            </div>
          </div>
        )}

        {/* Enhanced Filter Toolbar & Column Selector */}
        <div className="mb-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            {/* Search Input */}
            <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
              <div className="relative w-full">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Поиск по названию, коду или инвентарному номеру…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-[#f8fafc] pl-9 pr-8 text-[11px] outline-none placeholder:text-slate-400 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Controls & Column Customizer */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1 text-[#3473d4]">
                <SlidersHorizontal size={13} />
                <span className="font-semibold text-[11px]">Фильтры:</span>
              </div>

              {/* Status Select */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`h-8 rounded-lg border px-2.5 text-[10px] outline-none transition ${
                  statusFilter !== "ALL"
                    ? "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold"
                    : "border-slate-200 bg-[#f8fafc] text-slate-600 focus:border-[#3c82ed]"
                }`}
              >
                <option value="ALL">Все статусы</option>
                <option value="ACTIVE">ACTIVE (В эксплуатации)</option>
                <option value="INACTIVE">INACTIVE (В резерве)</option>
                <option value="DRAFT">DRAFT (Черновик)</option>
                <option value="DECOMMISSIONED">DECOMMISSIONED (Списано)</option>
              </select>

              {/* Department Select */}
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className={`h-8 rounded-lg border px-2.5 text-[10px] outline-none transition ${
                  departmentFilter !== "ALL"
                    ? "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold"
                    : "border-slate-200 bg-[#f8fafc] text-slate-600 focus:border-[#3c82ed]"
                }`}
              >
                <option value="ALL">Все цеха</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Category Select */}
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
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Type Select */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={`h-8 rounded-lg border px-2.5 text-[10px] outline-none transition ${
                  typeFilter !== "ALL"
                    ? "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold"
                    : "border-slate-200 bg-[#f8fafc] text-slate-600 focus:border-[#3c82ed]"
                }`}
              >
                <option value="ALL">Все типы техники</option>
                {types.map((tp) => (
                  <option key={tp} value={tp}>
                    {tp}
                  </option>
                ))}
              </select>

              {/* Column Selector Toggle Popover */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnMenu((prev) => !prev)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-50"
                  title="Настройка видимости колонок таблицы"
                >
                  <Columns3 size={13} className="text-[#3473d4]" />
                  <span>Колонки</span>
                </button>

                {showColumnMenu && (
                  <div
                    className="absolute right-0 top-10 z-30 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-xl space-y-2 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-[#17243a] text-[11px]">Отображение колонок</span>
                      <button
                        onClick={() => setShowColumnMenu(false)}
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={columns.code}
                          onChange={() => toggleColumn("code")}
                          className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                        />
                        <span>Код / Инв. №</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={columns.name}
                          onChange={() => toggleColumn("name")}
                          className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                        />
                        <span>Наименование & Модель</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={columns.category}
                          onChange={() => toggleColumn("category")}
                          className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                        />
                        <span>Категория & Тип</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={columns.department}
                          onChange={() => toggleColumn("department")}
                          className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                        />
                        <span>Подразделение / Позиция</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={columns.status}
                          onChange={() => toggleColumn("status")}
                          className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                        />
                        <span>Статус</span>
                      </label>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-between">
                      <button
                        onClick={() => {
                          setColumns(DEFAULT_COLUMNS);
                          try {
                            localStorage.removeItem("eps_registry_columns");
                          } catch {}
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                      >
                        Сбросить видимость
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Active Filter Chips / Badges */}
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

              {departmentFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100">
                  Цех: {departmentFilter}
                  <button onClick={() => setDepartmentFilter("ALL")} className="hover:text-blue-800">
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

              {typeFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100">
                  Тип: {typeFilter}
                  <button onClick={() => setTypeFilter("ALL")} className="hover:text-blue-800">
                    <X size={11} />
                  </button>
                </span>
              )}

              <button
                onClick={resetAllFilters}
                className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700 ml-1"
              >
                <RotateCcw size={10} /> Сбросить все
              </button>
            </div>
          )}
        </div>

        {/* Equipment Registry Table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
          {/* Table Header */}
          <div className="hidden border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 md:grid grid-cols-6 gap-4">
            <span>Код / Инв. №</span>
            <span>Наименование</span>
            <span>Категория & Тип</span>
            <span>Подразделение / Позиция</span>
            <span>Статус</span>
            <span className="text-right">Действие</span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400 space-y-2">
              <p>Оборудование по заданным критериям фильтрации не найдено.</p>
              {activeFiltersCount > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="text-[11px] font-semibold text-[#3473d4] hover:underline"
                >
                  Сбросить все фильтры
                </button>
              )}
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-1 md:grid-cols-6 gap-2 border-b border-slate-100 px-5 py-3.5 last:border-0 hover:bg-slate-50/50 md:items-center md:gap-4 transition text-xs"
              >
                <div className="font-mono">
                  <span className="block text-[11px] font-bold text-[#3473d4]">{item.equipmentCode}</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">{item.inventoryNumber}</span>
                </div>

                <div>
                  <span className="block text-[11px] font-semibold text-[#17243a]">{item.name}</span>
                  <span className="block text-[10px] text-slate-400">Модель: {item.model}</span>
                </div>

                <div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                    <Tag size={12} className="text-slate-400" />
                    <span>{item.category}</span>
                  </div>
                  <span className="block text-[10px] text-slate-400">{item.type}</span>
                </div>

                <div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                    <Building2 size={12} className="text-slate-400" />
                    <span>{item.department}</span>
                  </div>
                  <span className="block text-[10px] text-slate-400">{item.location}</span>
                </div>

                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                      item.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-600"
                        : item.status === "DRAFT"
                        ? "bg-amber-50 text-amber-600"
                        : item.status === "INACTIVE"
                        ? "bg-blue-50 text-blue-600"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        item.status === "ACTIVE"
                          ? "bg-emerald-500"
                          : item.status === "DRAFT"
                          ? "bg-amber-500"
                          : item.status === "INACTIVE"
                          ? "bg-blue-500"
                          : "bg-slate-400"
                      }`}
                    />
                    {item.status}
                  </span>
                </div>

                <div className="flex items-center justify-end">
                  <Link
                    href={`/modules/eps/${item.id}`}
                    className="text-[10px] font-semibold text-[#3473d4] hover:text-blue-700"
                  >
                    Открыть <ChevronRight size={11} className="inline" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </section>

      </main>
    </ShellLayout>
  );
}

