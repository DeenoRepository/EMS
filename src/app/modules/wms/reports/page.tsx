"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { WmsItem } from "@/lib/modules/wms-store";
import {
  Download,
  RefreshCw,
  FileText,
  CheckCircle2,
  Clock,
  Wrench,
  Sparkles,
  Eye,
  FileSpreadsheet,
  X,
  Filter,
  Columns3,
  SlidersHorizontal,
  ChevronRight,
  Archive,
} from "lucide-react";
import Link from "next/link";
import {
  PageHeader,
  KpiGrid,
  FilterToolbar,
  DataTable,
  StatusBadge,
} from "@/components/ui";

export interface WmsReportItem {
  id: string;
  name: string;
  category: string;
  format: "XLSX" | "PDF" | "CSV";
  generatedAt: string;
  status: "READY" | "GENERATING" | "ARCHIVED";
  size: string;
  description?: string;
  recordsCount?: number;
}

export interface WmsReportColumnVisibility {
  name: boolean;
  category: boolean;
  format: boolean;
  generatedAt: boolean;
  status: boolean;
  actions: boolean;
}

const DEFAULT_COLUMNS: WmsReportColumnVisibility = {
  name: true,
  category: true,
  format: true,
  generatedAt: true,
  status: true,
  actions: true,
};

interface WmsBuilderField {
  key: string;
  label: string;
  category: "Идентификация" | "Склад и остатки" | "Финансы и поставка" | "Характеристики";
}

const WMS_BUILDER_FIELDS: WmsBuilderField[] = [
  { key: "sku", label: "Артикул / SKU", category: "Идентификация" },
  { key: "name", label: "Наименование ТМЦ", category: "Идентификация" },
  { key: "category", label: "Категория ЗИП", category: "Идентификация" },
  { key: "type", label: "Тип номенклатуры", category: "Идентификация" },
  { key: "barcode", label: "Штрихкод / EAN", category: "Идентификация" },

  { key: "warehouse", label: "Склад хранения", category: "Склад и остатки" },
  { key: "cell", label: "Стеллаж / Ячейка", category: "Склад и остатки" },
  { key: "quantity", label: "Текущий остаток", category: "Склад и остатки" },
  { key: "reservedQuantity", label: "Зарезервировано", category: "Склад и остатки" },
  { key: "minQuantity", label: "Мин. пороговый остаток", category: "Склад и остатки" },
  { key: "responsibleUser", label: "МОЛ / Ответственный", category: "Склад и остатки" },

  { key: "unitPrice", label: "Балансовая цена", category: "Финансы и поставка" },
  { key: "supplier", label: "Поставщик / Производитель", category: "Финансы и поставка" },

  { key: "compatibleEquipment", label: "Совместимое оборудование", category: "Характеристики" },
  { key: "techSpecs", label: "Технические спецификации", category: "Характеристики" },
];

export default function WmsReportsPage() {
  const [reports, setReports] = useState<WmsReportItem[]>([]);
  const [items, setItems] = useState<WmsItem[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [formatFilter, setFormatFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  // Modal & Builder states
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [previewReport, setPreviewReport] = useState<WmsReportItem | null>(null);

  // Flexible Report Builder State (matching EPS builder 1:1)
  const [builderTitle, setBuilderTitle] = useState("Настраиваемый отчет по складским остаткам ТМЦ");
  const [builderCategory, setBuilderCategory] = useState("Складские остатки");
  const [builderFormat, setBuilderFormat] = useState<"XLSX" | "PDF" | "CSV">("XLSX");
  const [builderWarehouseFilter, setBuilderWarehouseFilter] = useState("ALL");
  const [builderStatusFilter, setBuilderStatusFilter] = useState("ALL");
  const [builderCategoryFilter, setBuilderCategoryFilter] = useState("ALL");

  const [selectedFields, setSelectedFields] = useState<string[]>([
    "sku",
    "name",
    "category",
    "warehouse",
    "cell",
    "quantity",
    "unitPrice",
    "responsibleUser",
  ]);
  const [generating, setGenerating] = useState(false);

  const [columns, setColumns] = useState<WmsReportColumnVisibility>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("wms_reports_columns") : null;
      if (saved) {
        return { ...DEFAULT_COLUMNS, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore
    }
    return DEFAULT_COLUMNS;
  });

  const toggleColumn = (key: keyof WmsReportColumnVisibility) => {
    setColumns((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("wms_reports_columns", JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  useEffect(() => {
    let isSubscribed = true;
    Promise.all([
      fetch("/api/modules/wms/reports"),
      fetch("/api/modules/wms/items"),
    ])
      .then(async ([resRep, resItems]) => {
        if (!isSubscribed) return;
        if (resRep.ok) {
          const dRep = await resRep.json();
          if (dRep.reports) setReports(dRep.reports);
        }
        if (resItems.ok) {
          const dItems = await resItems.json();
          if (dItems.items) setItems(dItems.items);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isSubscribed) setLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  const toggleBuilderField = (key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAllBuilderFields = () => {
    setSelectedFields(WMS_BUILDER_FIELDS.map((f) => f.key));
  };

  const clearAllBuilderFields = () => {
    setSelectedFields(["sku", "name"]);
  };

  const builderPreviewData = useMemo(() => {
    return items.filter((item) => {
      if (builderWarehouseFilter !== "ALL" && item.warehouse !== builderWarehouseFilter) return false;
      if (builderStatusFilter !== "ALL" && item.status !== builderStatusFilter) return false;
      if (builderCategoryFilter !== "ALL" && item.category !== builderCategoryFilter) return false;
      return true;
    });
  }, [items, builderWarehouseFilter, builderStatusFilter, builderCategoryFilter]);

  const handleGenerateCustomReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!builderTitle.trim() || selectedFields.length === 0) return;

    setGenerating(true);
    setTimeout(() => {
      const createdReport: WmsReportItem = {
        id: `wms-rep-${Date.now()}`,
        name: builderTitle.trim(),
        category: builderCategory,
        format: builderFormat,
        generatedAt: new Date().toLocaleString("ru-RU"),
        status: "READY",
        size: builderFormat === "XLSX" ? "2.8 MB" : builderFormat === "PDF" ? "3.9 MB" : "1.1 MB",
        description: `Сформирован через Конструктор отчётов WMS (${selectedFields.length} колонок, ${builderPreviewData.length} записей).`,
        recordsCount: builderPreviewData.length,
      };

      setReports((prev) => [createdReport, ...prev]);
      setGenerating(false);
      setShowBuilderModal(false);
    }, 500);
  };

  const filteredReports = useMemo(() => {
    return reports.filter((rep) => {
      if (categoryFilter !== "ALL" && rep.category !== categoryFilter) return false;
      if (statusFilter !== "ALL" && rep.status !== statusFilter) return false;
      if (formatFilter !== "ALL" && rep.format !== formatFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          rep.name.toLowerCase().includes(q) ||
          rep.category.toLowerCase().includes(q) ||
          (rep.description && rep.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [reports, query, categoryFilter, statusFilter, formatFilter]);

  const warehouses = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.warehouse))).filter(Boolean);
  }, [items]);

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.category))).filter(Boolean);
  }, [items]);

  const kpiStats = useMemo(() => {
    const total = reports.length;
    const ready = reports.filter((r) => r.status === "READY").length;
    const generatingCount = reports.filter((r) => r.status === "GENERATING").length;
    return { total, ready, generatingCount };
  }, [reports]);

  const reportColorMap = {
    READY: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
    GENERATING: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
    ARCHIVED: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" },
  };

  const reportStatusLabels = {
    READY: "Сформирован",
    GENERATING: "Формируется",
    ARCHIVED: "Архивный",
  };

  const tableColumns = useMemo(() => {
    const cols = [];
    if (columns.name) {
      cols.push({
        key: "name",
        header: "Наименование отчёта",
        cell: (r: WmsReportItem) => (
          <div>
            <span className="block text-[11px] font-semibold text-slate-800 dark:text-slate-200">{r.name}</span>
            {r.description && <span className="block text-[10px] text-slate-400">{r.description}</span>}
          </div>
        ),
      });
    }
    if (columns.category) {
      cols.push({
        key: "category",
        header: "Категория",
        cell: (r: WmsReportItem) => <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{r.category}</span>,
      });
    }
    if (columns.format) {
      cols.push({
        key: "format",
        header: "Формат",
        cell: (r: WmsReportItem) => <span className="font-mono text-[10px] font-bold text-[#3473d4]">{r.format}</span>,
      });
    }
    if (columns.generatedAt) {
      cols.push({
        key: "generatedAt",
        header: "Дата генерации",
        cell: (r: WmsReportItem) => <span className="font-mono text-[10px] text-slate-400">{r.generatedAt}</span>,
      });
    }
    if (columns.status) {
      cols.push({
        key: "status",
        header: "Статус",
        cell: (r: WmsReportItem) => (
          <StatusBadge status={r.status} label={reportStatusLabels[r.status]} colorMap={reportColorMap} />
        ),
      });
    }
    if (columns.actions) {
      cols.push({
        key: "actions",
        header: <span className="text-right block">Действия</span>,
        cell: (r: WmsReportItem) => (
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setPreviewReport(r)}
              className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:text-[#3473d4]"
            >
              <Eye size={13} /> Инфо
            </button>
            <a
              href={`/api/modules/wms/items/export?format=${r.format.toLowerCase()}`}
              download
              className="flex items-center gap-1 text-[10px] font-semibold text-[#3473d4] hover:underline"
            >
              <Download size={13} /> {r.size}
            </a>
          </div>
        ),
      });
    }
    return cols;
  }, [columns]);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Отчёты WMS"
          description={`Гибкий конструктор отчетов, экспорты всех параметров ТМЦ и складских ведомостей (найдено ${filteredReports.length} из ${reports.length} отч.).`}
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учёт", href: "/modules/wms" },
            { title: "Отчёты" },
          ]}
          actions={
            <>
              <a
                href="/api/modules/wms/items/export"
                download
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <FileSpreadsheet size={14} className="text-emerald-600" /> Быстрый отчёт (Все ТМЦ)
              </a>
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
              </button>
              <button
                onClick={() => setShowBuilderModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
              >
                <Wrench size={14} /> Конструктор отчётов
              </button>
            </>
          }
        />

        <KpiGrid
          items={[
            { label: "Всего отчётов", value: kpiStats.total, icon: <FileText size={14} />, iconColor: "blue", sub: "В архиве и реестре" },
            { label: "Готовы к скачиванию", value: kpiStats.ready, icon: <CheckCircle2 size={14} />, iconColor: "emerald", sub: "Сформированы", subColor: "emerald" },
            { label: "В процессе генерации", value: kpiStats.generatingCount, icon: <Clock size={14} />, iconColor: "amber", sub: "Фоновая сборка данных", subColor: "amber" },
          ]}
          columns={3}
        />

        <FilterToolbar
          searchQuery={query}
          onSearchChange={setQuery}
          searchPlaceholder="Поиск по наименованию отчета, категории или описанию…"
          filters={[
            {
              key: "category",
              label: "Категория",
              value: categoryFilter,
              onChange: setCategoryFilter,
              options: [
                { value: "ALL", label: "Все категории" },
                { value: "Складские остатки", label: "Складские остатки" },
                { value: "Аналитика движений", label: "Аналитика движений" },
                { value: "Инвентаризация", label: "Инвентаризация" },
                { value: "Финансовый аудит", label: "Финансовый аудит" },
              ],
            },
            {
              key: "format",
              label: "Формат",
              value: formatFilter,
              onChange: setFormatFilter,
              options: [
                { value: "ALL", label: "Все форматы" },
                { value: "XLSX", label: "XLSX Excel" },
                { value: "PDF", label: "PDF Документ" },
                { value: "CSV", label: "CSV Таблица" },
              ],
            },
            {
              key: "status",
              label: "Статус",
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { value: "ALL", label: "Все статусы" },
                { value: "READY", label: "Готов" },
                { value: "GENERATING", label: "Формируется" },
                { value: "ARCHIVED", label: "В архиве" },
              ],
            },
          ]}
          columns={[
            { key: "name", label: "Наименование отчёта", visible: columns.name },
            { key: "category", label: "Категория", visible: columns.category },
            { key: "format", label: "Формат выгрузки", visible: columns.format },
            { key: "generatedAt", label: "Дата формирования", visible: columns.generatedAt },
            { key: "status", label: "Статус", visible: columns.status },
          ]}
          onColumnToggle={(key) => toggleColumn(key as keyof WmsReportColumnVisibility)}
          onColumnReset={() => setColumns(DEFAULT_COLUMNS)}
          onResetAll={() => {
            setQuery("");
            setCategoryFilter("ALL");
            setStatusFilter("ALL");
            setFormatFilter("ALL");
          }}
        />

        <DataTable
          columns={tableColumns}
          data={filteredReports}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyText="Отчёты по выгруженным параметрам не найдены."
        />

        {/* Modal: Flexible Report Builder (Identical structure to EPS Report Builder 1:1) */}
        {showBuilderModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto"
            onClick={() => setShowBuilderModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5 max-h-[92vh] flex flex-col my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef5ff] dark:bg-blue-950/60 text-[#3473d4]">
                    <Wrench size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#17243a] dark:text-slate-100">Конструктор отчётов WMS</h3>
                    <p className="text-[11px] text-slate-400">
                      Выберите поля ТМЦ, фильтры и формат выгрузки для формирования отчёта
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBuilderModal(false)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Content Scrollable */}
              <div className="overflow-y-auto space-y-5 pr-1 text-xs flex-1">
                {/* General Settings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Наименование отчета <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={builderTitle}
                      onChange={(e) => setBuilderTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-800 px-3 py-2 text-xs outline-none focus:border-[#3c82ed] font-medium text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Категория отчета
                    </label>
                    <select
                      value={builderCategory}
                      onChange={(e) => setBuilderCategory(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-800 px-3 py-2 text-xs outline-none focus:border-[#3c82ed] text-slate-800 dark:text-slate-100"
                    >
                      <option value="Складские остатки">Складские остатки</option>
                      <option value="Аналитика движений">Аналитика движений</option>
                      <option value="Инвентаризация">Инвентаризация</option>
                      <option value="Финансовый аудит">Финансовый аудит</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Формат выгрузки
                    </label>
                    <select
                      value={builderFormat}
                      onChange={(e) => setBuilderFormat(e.target.value as "XLSX" | "PDF" | "CSV")}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-800 px-3 py-2 text-xs outline-none focus:border-[#3c82ed] text-slate-800 dark:text-slate-100"
                    >
                      <option value="XLSX">XLSX (Excel Таблица)</option>
                      <option value="PDF">PDF (Печатный документ)</option>
                      <option value="CSV">CSV (Машиночитаемый)</option>
                    </select>
                  </div>
                </div>

                {/* Field Selection Matrix */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-800/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-[#3473d4]" />
                      <span className="font-bold text-[#17243a] dark:text-slate-200 text-xs">
                        Выбор атрибутов ТМЦ ({selectedFields.length} из {WMS_BUILDER_FIELDS.length} полей)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllBuilderFields}
                        className="text-[10px] font-semibold text-[#3473d4] hover:underline"
                      >
                        Выбрать все
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={clearAllBuilderFields}
                        className="text-[10px] font-semibold text-slate-500 hover:underline"
                      >
                        Сбросить до базовых
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {["Идентификация", "Склад и остатки", "Финансы и поставка", "Характеристики"].map(
                      (catName) => {
                        const fieldsInCat = WMS_BUILDER_FIELDS.filter((f) => f.category === catName);
                        return (
                          <div key={catName} className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3 space-y-1.5">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-100 dark:border-slate-800">
                              {catName}
                            </span>
                            <div className="space-y-1 pt-1">
                              {fieldsInCat.map((f) => {
                                const isChecked = selectedFields.includes(f.key);
                                return (
                                  <label
                                    key={f.key}
                                    className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded transition"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleBuilderField(f.key)}
                                      className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                                    />
                                    <span className={isChecked ? "font-semibold text-[#17243a] dark:text-slate-100" : "text-slate-600 dark:text-slate-400"}>
                                      {f.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Filtering Controls */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-[#3473d4]" />
                    <span className="font-bold text-[#17243a] dark:text-slate-200 text-xs">Фильтрация данных для выгрузки</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                        Склад хранения
                      </label>
                      <select
                        value={builderWarehouseFilter}
                        onChange={(e) => setBuilderWarehouseFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-800 px-2.5 py-1.5 text-xs outline-none text-slate-800 dark:text-slate-200"
                      >
                        <option value="ALL">Все склады</option>
                        {warehouses.map((wh) => (
                          <option key={wh} value={wh}>
                            {wh}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                        Статус ТМЦ
                      </label>
                      <select
                        value={builderStatusFilter}
                        onChange={(e) => setBuilderStatusFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-800 px-2.5 py-1.5 text-xs outline-none text-slate-800 dark:text-slate-200"
                      >
                        <option value="ALL">Все статусы</option>
                        <option value="IN_STOCK">В наличии (IN_STOCK)</option>
                        <option value="LOW_STOCK">Дефицит (LOW_STOCK)</option>
                        <option value="OUT_OF_STOCK">Отсутствует (OUT_OF_STOCK)</option>
                        <option value="OVERSTOCKED">Избыток (OVERSTOCKED)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                        Категория ЗИП
                      </label>
                      <select
                        value={builderCategoryFilter}
                        onChange={(e) => setBuilderCategoryFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-800 px-2.5 py-1.5 text-xs outline-none text-slate-800 dark:text-slate-200"
                      >
                        <option value="ALL">Все категории</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Real-time Data Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#17243a] dark:text-slate-200">
                      Предварительный просмотр данных ({builderPreviewData.length} ед. ТМЦ)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Выбрано полей: {selectedFields.length}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 max-h-48">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-[9px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 sticky top-0">
                        <tr>
                          {selectedFields.map((fKey) => {
                            const option = WMS_BUILDER_FIELDS.find((b) => b.key === fKey);
                            return (
                              <th key={fKey} className="px-3 py-2 font-bold whitespace-nowrap">
                                {option?.label || fKey}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                        {builderPreviewData.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
                            {selectedFields.map((fKey) => {
                              let val = (item as Record<string, unknown>)[fKey];
                              if (fKey === "techSpecs" && item.techSpecs) {
                                val = Object.entries(item.techSpecs)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join("; ");
                               }
                              if (Array.isArray(val)) val = val.join(", ");
                              return (
                                <td key={fKey} className="px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[200px] truncate">
                                  {val !== undefined && val !== null && val !== "" ? String(val) : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                <a
                  href={`/api/modules/wms/items/export?fields=${selectedFields.join(",")}&warehouse=${builderWarehouseFilter}&status=${builderStatusFilter}`}
                  download
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs"
                >
                  <Download size={13} /> Скачать прямо сейчас ({builderFormat})
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBuilderModal(false)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateCustomReport}
                    disabled={generating || selectedFields.length === 0}
                    className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4.5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] disabled:opacity-50"
                  >
                    {generating && <RefreshCw size={13} className="animate-spin" />}
                    {generating ? "Сохранение..." : "Сформировать и сохранить отчет"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Preview Info */}
        {previewReport && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
            onClick={() => setPreviewReport(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-[#3473d4]" />
                  <h3 className="text-base font-bold text-[#17243a] dark:text-slate-100">Сведения об отчёте WMS</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewReport(null)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Наименование:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{previewReport.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Категория:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{previewReport.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Формат:</span>
                    <span className="font-mono text-[#3473d4] font-bold">{previewReport.format}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Размер файла:</span>
                    <span className="font-mono">{previewReport.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Описание:</span>
                    <span>{previewReport.description || "—"}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPreviewReport(null)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </ShellLayout>
  );
}
