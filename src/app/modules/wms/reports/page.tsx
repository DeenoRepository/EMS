"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { MOCK_WMS_ITEMS, WmsItem } from "@/lib/modules/wms-store";
import {
  PieChart,
  Download,
  ChevronRight,
  SlidersHorizontal,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  RefreshCw,
  X,
  Columns3,
  Eye,
  FileText,
  Clock,
  Archive,
  Layers,
  Wrench,
  CheckSquare,
  Square,
  Sparkles,
  RotateCcw,
  Calendar,
  Filter,
} from "lucide-react";
import Link from "next/link";

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

const FORMAT_CONFIG: Record<
  WmsReportItem["format"],
  { bg: string; text: string; label: string }
> = {
  XLSX: { bg: "bg-emerald-50 border-emerald-100", text: "text-emerald-700", label: "XLSX Excel" },
  PDF: { bg: "bg-red-50 border-red-100", text: "text-red-600", label: "PDF Документ" },
  CSV: { bg: "bg-blue-50 border-blue-100", text: "text-[#3473d4]", label: "CSV Данные" },
};

interface WmsFieldOption {
  key: keyof WmsItem;
  label: string;
  category: "Идентификация ТМЦ" | "Размещение и Хранение" | "Количества и Стоимость";
}

const BUILDER_WMS_FIELDS: WmsFieldOption[] = [
  { key: "sku", label: "Артикул / SKU", category: "Идентификация ТМЦ" },
  { key: "name", label: "Наименование ТМЦ", category: "Идентификация ТМЦ" },
  { key: "category", label: "Категория запасов", category: "Идентификация ТМЦ" },
  { key: "type", label: "Тип номенклатуры", category: "Идентификация ТМЦ" },
  { key: "barcode", label: "Штрихкод / QR-код", category: "Идентификация ТМЦ" },

  { key: "warehouse", label: "Склад хранения", category: "Размещение и Хранение" },
  { key: "cell", label: "Ячейка хранения", category: "Размещение и Хранение" },
  { key: "status", label: "Статус остатка", category: "Размещение и Хранение" },

  { key: "quantity", label: "Текущий физ. остаток", category: "Количества и Стоимость" },
  { key: "minQuantity", label: "Мин. неснижаемый порог", category: "Количества и Стоимость" },
  { key: "reservedQuantity", label: "Зарезервировано", category: "Количества и Стоимость" },
  { key: "unitPrice", label: "Цена за единицу (₽)", category: "Количества и Стоимость" },
  { key: "unit", label: "Единица измерения", category: "Количества и Стоимость" },
];

const MOCK_WMS_REPORTS: WmsReportItem[] = [
  {
    id: "rep-wms-001",
    name: "Оборотная ведомость ТМЦ и ЗИП (Август 2026)",
    category: "Складские остатки",
    format: "XLSX",
    generatedAt: "05.08.2026 16:30",
    status: "READY",
    size: "2.4 MB",
    description: "Полная ведомость начальных и конечных остатков, прихода и списания за текущий месяц.",
    recordsCount: 1420
  },
  {
    id: "rep-wms-002",
    name: "Отчет по дефицитным позициям и неснижаемому остатку",
    category: "Анализ дефицита",
    format: "PDF",
    generatedAt: "06.08.2026 09:15",
    status: "READY",
    size: "1.1 MB",
    description: "Перечень номенклатур ЗИП, требующих срочной закупки SRM.",
    recordsCount: 18
  },
  {
    id: "rep-wms-003",
    name: "ABC-анализ складских запасов по стоимости",
    category: "Аналитика стоимости",
    format: "CSV",
    generatedAt: "04.08.2026 11:00",
    status: "READY",
    size: "450 KB",
    description: "Группировка запасов по категориям A (80% стоимости), B (15%) и C (5%).",
    recordsCount: 890
  }
];

export default function WmsReportsPage() {
  const [reports, setReports] = useState<WmsReportItem[]>(MOCK_WMS_REPORTS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [formatFilter, setFormatFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal & Details state
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [previewReport, setPreviewReport] = useState<WmsReportItem | null>(null);

  // Builder form state
  const [builderTitle, setBuilderTitle] = useState("Настраиваемый отчёт по складским запасам");
  const [builderCategory, setBuilderCategory] = useState("Складские остатки");
  const [builderFormat, setBuilderFormat] = useState<"XLSX" | "PDF" | "CSV">("XLSX");
  const [builderWarehouseFilter, setBuilderWarehouseFilter] = useState("ALL");
  const [builderStatusFilter, setBuilderStatusFilter] = useState("ALL");
  const [generating, setGenerating] = useState(false);

  // Columns state
  const [columns, setColumns] = useState<WmsReportColumnVisibility>(DEFAULT_COLUMNS);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Flexible Builder Selected Fields
  const [selectedFields, setSelectedFields] = useState<string[]>([
    "sku", "name", "category", "warehouse", "cell", "quantity", "unitPrice", "status"
  ]);

  const toggleColumn = (key: keyof WmsReportColumnVisibility) => {
    setColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleField = (key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const categories = useMemo(() => {
    return Array.from(new Set(reports.map((r) => r.category))).filter(Boolean);
  }, [reports]);

  const warehousesList = useMemo(() => {
    return Array.from(new Set(MOCK_WMS_ITEMS.map((i) => i.warehouse))).filter(Boolean);
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter((rep) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        rep.name.toLowerCase().includes(q) ||
        rep.category.toLowerCase().includes(q) ||
        (rep.description && rep.description.toLowerCase().includes(q));

      const matchesCat = categoryFilter === "ALL" || rep.category === categoryFilter;
      const matchesFmt = formatFilter === "ALL" || rep.format === formatFilter;
      const matchesSt = statusFilter === "ALL" || rep.status === statusFilter;

      return matchesQuery && matchesCat && matchesFmt && matchesSt;
    });
  }, [reports, searchQuery, categoryFilter, formatFilter, statusFilter]);

  // Live Preview items for builder
  const builderPreviewData = useMemo(() => {
    return MOCK_WMS_ITEMS.filter((item) => {
      if (builderWarehouseFilter !== "ALL" && item.warehouse !== builderWarehouseFilter) return false;
      if (builderStatusFilter !== "ALL" && item.status !== builderStatusFilter) return false;
      return true;
    });
  }, [builderWarehouseFilter, builderStatusFilter]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim() !== "") count++;
    if (categoryFilter !== "ALL") count++;
    if (formatFilter !== "ALL") count++;
    if (statusFilter !== "ALL") count++;
    return count;
  }, [searchQuery, categoryFilter, formatFilter, statusFilter]);

  const resetAllFilters = () => {
    setSearchQuery("");
    setCategoryFilter("ALL");
    setFormatFilter("ALL");
    setStatusFilter("ALL");
  };

  const refreshReports = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 400);
  }, []);

  const handleGenerateCustomReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!builderTitle.trim() || selectedFields.length === 0) return;

    setGenerating(true);

    setTimeout(() => {
      const createdReport: WmsReportItem = {
        id: `rep-wms-${Date.now()}`,
        name: builderTitle.trim(),
        category: builderCategory,
        format: builderFormat,
        generatedAt: new Date().toLocaleString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        status: "READY",
        size: builderFormat === "XLSX" ? "2.8 MB" : builderFormat === "PDF" ? "3.6 MB" : "1.2 MB",
        description: `Сформирован через Конструктор отчётов WMS (${selectedFields.length} колонок, ${builderPreviewData.length} позиций).`,
        recordsCount: builderPreviewData.length,
      };

      setReports((prev) => [createdReport, ...prev]);
      setGenerating(false);
      setShowBuilderModal(false);
    }, 600);
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Breadcrumbs & Title Block aligned with EPS Standard */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
              <Link href="/" className="hover:text-slate-600">Главная</Link>
              <ChevronRight size={12} />
              <Link href="/modules/wms" className="hover:text-slate-600">WMS Складской учёт</Link>
              <ChevronRight size={12} />
              <span className="text-[#3473d4] font-semibold">Отчёты и Аналитика</span>
            </div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Отчёты WMS
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Гибкий конструктор экспорта складских остатков, оборотных ведомостей и аналитики ЗИП (найдено {filteredReports.length} из {reports.length} отч.).
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a
              href="/api/modules/wms/items/export"
              download
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" /> Быстрый отчёт (Все ТМЦ)
            </a>
            <button
              onClick={refreshReports}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
            </button>
            <button
              onClick={() => setShowBuilderModal(true)}
              className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
            >
              <Wrench size={14} /> Конструктор отчётов WMS
            </button>
          </div>
        </div>

        {/* Enhanced Filter Toolbar & Column Customizer aligned with EPS Standard */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            {/* Search Input */}
            <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
              <div className="relative w-full">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Поиск по наименованию отчета, категории или описанию…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-[#f8fafc] pl-9 pr-8 text-[11px] outline-none placeholder:text-slate-400 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Controls & Column Selector */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1 text-[#3473d4]">
                <SlidersHorizontal size={13} />
                <span className="font-semibold text-[11px]">Фильтры:</span>
              </div>

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
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                className={`h-8 rounded-lg border px-2.5 text-[10px] outline-none transition ${
                  formatFilter !== "ALL"
                    ? "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold"
                    : "border-slate-200 bg-[#f8fafc] text-slate-600 focus:border-[#3c82ed]"
                }`}
              >
                <option value="ALL">Все форматы</option>
                <option value="XLSX">XLSX Excel</option>
                <option value="PDF">PDF Документ</option>
                <option value="CSV">CSV Таблица</option>
              </select>

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
                <option value="READY">Готов</option>
                <option value="GENERATING">Формируется</option>
                <option value="ARCHIVED">В архиве</option>
              </select>

              {/* Column Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnMenu(!showColumnMenu)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-50"
                  title="Настройка видимости колонок таблицы"
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
                      {Object.keys(DEFAULT_COLUMNS).map((key) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer text-slate-700 hover:bg-slate-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={columns[key as keyof WmsReportColumnVisibility]}
                            onChange={() => toggleColumn(key as keyof WmsReportColumnVisibility)}
                            className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                          />
                          <span>
                            {key === "name" && "Наименование отчёта"}
                            {key === "category" && "Категория"}
                            {key === "format" && "Формат выгрузки"}
                            {key === "generatedAt" && "Дата формирования"}
                            {key === "status" && "Статус"}
                            {key === "actions" && "Действия"}
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

              {searchQuery && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100">
                  Поиск: "{searchQuery}"
                  <button onClick={() => setSearchQuery("")} className="hover:text-blue-800">
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

              {formatFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100">
                  Формат: {formatFilter}
                  <button onClick={() => setFormatFilter("ALL")} className="hover:text-blue-800">
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

              <button onClick={resetAllFilters} className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700 ml-1">
                <RotateCcw size={10} /> Сбросить все
              </button>
            </div>
          )}
        </div>

        {/* Reports Table aligned with EPS Standard */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
          <div className="hidden border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 md:grid grid-cols-6 gap-4">
            {columns.name && <span>Наименование отчёта</span>}
            {columns.category && <span>Категория</span>}
            {columns.format && <span>Формат</span>}
            {columns.generatedAt && <span>Дата формирования</span>}
            {columns.status && <span>Статус</span>}
            {columns.actions && <span className="text-right">Действие</span>}
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400">
              <RefreshCw className="mx-auto mb-2 animate-spin text-[#3473d4]" size={20} />
              Загрузка списка отчётов WMS...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400 space-y-2">
              <p>Отчёты по заданным критериям фильтрации не найдены.</p>
              {activeFiltersCount > 0 && (
                <button onClick={resetAllFilters} className="text-[11px] font-semibold text-[#3473d4] hover:underline">
                  Сбросить все фильтры
                </button>
              )}
            </div>
          ) : (
            filteredReports.map((rep) => {
              const fmtConfig = FORMAT_CONFIG[rep.format] || FORMAT_CONFIG.CSV;
              return (
                <div
                  key={rep.id}
                  className="grid grid-cols-1 md:grid-cols-6 gap-2 border-b border-slate-100 px-5 py-3.5 last:border-0 hover:bg-slate-50/50 md:items-center md:gap-4 transition text-xs"
                >
                  {columns.name && (
                    <div>
                      <span className="block text-[11px] font-bold text-[#17243a]">{rep.name}</span>
                      {rep.description && (
                        <span className="block text-[10px] text-slate-400 mt-0.5 truncate max-w-sm">{rep.description}</span>
                      )}
                    </div>
                  )}

                  {columns.category && (
                    <div>
                      <span className="inline-block rounded-full bg-slate-100 border border-slate-200/60 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {rep.category}
                      </span>
                    </div>
                  )}

                  {columns.format && (
                    <div>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${fmtConfig.bg} ${fmtConfig.text}`}>
                        {fmtConfig.label}
                      </span>
                    </div>
                  )}

                  {columns.generatedAt && (
                    <div className="font-mono text-[10px] text-slate-500 flex items-center gap-1">
                      <Calendar size={12} className="text-slate-400" /> {rep.generatedAt}
                    </div>
                  )}

                  {columns.status && (
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        <CheckCircle2 size={10} /> Готов
                      </span>
                    </div>
                  )}

                  {columns.actions && (
                    <div className="text-right flex items-center justify-end gap-3">
                      <button
                        onClick={() => setPreviewReport(rep)}
                        className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 hover:text-[#3473d4]"
                        title="Просмотр сведений об отчете"
                      >
                        <Eye size={13} /> Инфо
                      </button>
                      <a
                        href="/api/modules/wms/items/export"
                        download
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-[#3473d4] hover:bg-blue-50 hover:border-blue-200 transition"
                      >
                        <Download size={12} /> {rep.size}
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* Modal: Flexible Report Builder 100% aligned with EPS Standard */}
        {showBuilderModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto"
            onClick={() => setShowBuilderModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 max-h-[92vh] flex flex-col my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef5ff] text-[#3473d4]">
                    <Wrench size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#17243a]">Конструктор отчётов WMS</h3>
                    <p className="text-[11px] text-slate-400">
                      Выберите поля ТМЦ, фильтры складских остатков и формат выгрузки для формирования отчёта
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBuilderModal(false)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Content Scrollable */}
              <div className="overflow-y-auto space-y-5 pr-1 text-xs flex-1">
                {/* General Settings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Наименование отчёта <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={builderTitle}
                      onChange={(e) => setBuilderTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-xs outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Категория отчёта
                    </label>
                    <select
                      value={builderCategory}
                      onChange={(e) => setBuilderCategory(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-xs outline-none focus:border-[#3c82ed]"
                    >
                      <option value="Складские остатки">Складские остатки</option>
                      <option value="Анализ дефицита">Анализ дефицита</option>
                      <option value="Аналитика стоимости">Аналитика стоимости</option>
                      <option value="Инвентаризация">Инвентаризация</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Формат выгрузки
                    </label>
                    <select
                      value={builderFormat}
                      onChange={(e) => setBuilderFormat(e.target.value as "XLSX" | "PDF" | "CSV")}
                      className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-xs outline-none focus:border-[#3c82ed]"
                    >
                      <option value="XLSX">XLSX (Excel Таблица)</option>
                      <option value="PDF">PDF (Печатный документ)</option>
                      <option value="CSV">CSV (Машиночитаемый)</option>
                    </select>
                  </div>
                </div>

                {/* Field Selection Matrix */}
                <div className="rounded-xl border border-slate-200 bg-[#f8fafc] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-[#3473d4]" />
                      <span className="font-bold text-[#17243a] text-xs">
                        Выбор атрибутов ТМЦ ({selectedFields.length} из {BUILDER_WMS_FIELDS.length} полей)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedFields(BUILDER_WMS_FIELDS.map((f) => f.key))}
                        className="text-[10px] font-semibold text-[#3473d4] hover:underline"
                      >
                        Выбрать все
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedFields(["sku", "name"])}
                        className="text-[10px] font-semibold text-slate-500 hover:underline"
                      >
                        Сбросить до базовых
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    {["Идентификация ТМЦ", "Размещение и Хранение", "Количества и Стоимость"].map(
                      (catName) => {
                        const fieldsInCat = BUILDER_WMS_FIELDS.filter((f) => f.category === catName);
                        return (
                          <div key={catName} className="rounded-lg border border-slate-200/80 bg-white p-3 space-y-1.5">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-100">
                              {catName}
                            </span>
                            <div className="space-y-1 pt-1">
                              {fieldsInCat.map((f) => {
                                const isChecked = selectedFields.includes(f.key);
                                return (
                                  <label
                                    key={f.key}
                                    className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded transition"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleField(f.key)}
                                      className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                                    />
                                    <span className={isChecked ? "font-semibold text-[#17243a]" : "text-slate-600"}>
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
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-[#3473d4]" />
                    <span className="font-bold text-[#17243a] text-xs">Фильтрация данных для выгрузки</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                        Склад хранения
                      </label>
                      <select
                        value={builderWarehouseFilter}
                        onChange={(e) => setBuilderWarehouseFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-2.5 py-1.5 text-xs outline-none"
                      >
                        <option value="ALL">Все склады</option>
                        {warehousesList.map((w) => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                        Статус остатка ТМЦ
                      </label>
                      <select
                        value={builderStatusFilter}
                        onChange={(e) => setBuilderStatusFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-2.5 py-1.5 text-xs outline-none"
                      >
                        <option value="ALL">Все статусы</option>
                        <option value="IN_STOCK">В наличии (IN_STOCK)</option>
                        <option value="LOW_STOCK">Дефицит / Мало (LOW_STOCK)</option>
                        <option value="OUT_OF_STOCK">Отсутствует (OUT_OF_STOCK)</option>
                        <option value="OVERSTOCKED">Избыток (OVERSTOCKED)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Real-time Data Preview Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#17243a]">
                      Предварительный просмотр данных ({builderPreviewData.length} поз. ТМЦ)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Выбрано полей: {selectedFields.length}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white max-h-48">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-[9px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 sticky top-0">
                        <tr>
                          {selectedFields.map((fKey) => {
                            const option = BUILDER_WMS_FIELDS.find((b) => b.key === fKey);
                            return (
                              <th key={fKey} className="px-3 py-2 font-bold whitespace-nowrap">
                                {option?.label || fKey}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {builderPreviewData.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/60">
                            {selectedFields.map((fKey) => {
                              let val = (item as any)[fKey];
                              if (Array.isArray(val)) val = val.join(", ");
                              return (
                                <td key={fKey} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                                  {val !== undefined && val !== null ? String(val) : "—"}
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
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <a
                  href={`/api/modules/wms/items/export?fields=${selectedFields.join(",")}&warehouse=${builderWarehouseFilter}&status=${builderStatusFilter}`}
                  download
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  <Download size={13} /> Скачать прямо сейчас ({builderFormat})
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBuilderModal(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
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
                    {generating ? "Сохранение..." : "Сформировать и сохранить отчёт"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Report Details Preview */}
        {previewReport && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
            onClick={() => setPreviewReport(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-[#3473d4]">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#17243a]">Параметры отчёта WMS</h3>
                    <p className="text-[10px] font-mono text-slate-400">{previewReport.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewReport(null)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px]">Наименование отчета:</span>
                  <p className="font-bold text-[#17243a] text-sm mt-0.5">{previewReport.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 text-[10px]">Категория:</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{previewReport.category}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Формат выгрузки:</span>
                    <p className="font-mono font-semibold text-[#3473d4] mt-0.5">{previewReport.format}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 text-[10px]">Дата формирования:</span>
                    <p className="font-mono text-slate-700 mt-0.5">{previewReport.generatedAt}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Размер и объем:</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{previewReport.recordsCount} зап. ({previewReport.size})</p>
                  </div>
                </div>

                {previewReport.description && (
                  <div className="pt-1 border-t border-slate-100">
                    <span className="text-slate-400 text-[10px]">Описание:</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">{previewReport.description}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setPreviewReport(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Закрыть
                </button>
                <a
                  href="/api/modules/wms/items/export"
                  download
                  className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
                >
                  <Download size={13} /> Скачать {previewReport.format}
                </a>
              </div>
            </div>
          </div>
        )}
      </main>
    </ShellLayout>
  );
}
