"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import ShellLayout from "@/components/layout/shell-layout";
import { EquipmentItem } from "@/lib/modules/eps-store";
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  ChevronRight,
  SlidersHorizontal,
  PieChart,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  RefreshCw,
  X,
  RotateCcw,
  Columns3,
  Eye,
  FileText,
  Clock,
  Archive,
  Layers,
  Wrench,
  CheckSquare,
  Square,
  Filter,
  Sparkles,
  Save,
  Table,
} from "lucide-react";

export interface ReportItem {
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

export interface ReportColumnVisibility {
  name: boolean;
  category: boolean;
  format: boolean;
  generatedAt: boolean;
  status: boolean;
  actions: boolean;
}

const DEFAULT_COLUMNS: ReportColumnVisibility = {
  name: true,
  category: true,
  format: true,
  generatedAt: true,
  status: true,
  actions: true,
};

const FORMAT_CONFIG: Record<
  ReportItem["format"],
  { bg: string; text: string; label: string }
> = {
  XLSX: { bg: "bg-emerald-50 border-emerald-100", text: "text-emerald-700", label: "XLSX Excel" },
  PDF: { bg: "bg-red-50 border-red-100", text: "text-red-600", label: "PDF Документ" },
  CSV: { bg: "bg-blue-50 border-blue-100", text: "text-[#3473d4]", label: "CSV Данные" },
};

interface FieldOption {
  key: keyof EquipmentItem | "techSpecs";
  label: string;
  category: "Идентификация" | "Локация и ответственность" | "Даты и гарантия" | "Изготовитель" | "Характеристики";
}

const BUILDER_FIELDS: FieldOption[] = [
  { key: "equipmentCode", label: "Код оборудования", category: "Идентификация" },
  { key: "name", label: "Наименование техники", category: "Идентификация" },
  { key: "type", label: "Тип оборудования", category: "Идентификация" },
  { key: "category", label: "Категория оборудования", category: "Идентификация" },
  { key: "model", label: "Марка / Модель", category: "Идентификация" },
  { key: "serialNumber", label: "Заводской номер", category: "Идентификация" },
  { key: "inventoryNumber", label: "Инвентарный номер", category: "Идентификация" },
  { key: "status", label: "Статус учета", category: "Идентификация" },
  { key: "lifecycleStage", label: "Стадия жизненного цикла", category: "Идентификация" },
  { key: "criticality", label: "Класс критичности (A/B/C)", category: "Идентификация" },

  { key: "department", label: "Подразделение (Цех)", category: "Локация и ответственность" },
  { key: "location", label: "Точная локация / Пролет", category: "Локация и ответственность" },
  { key: "responsibleUser", label: "Ответственный сотрудник", category: "Локация и ответственность" },

  { key: "productionDate", label: "Дата выпуска", category: "Даты и гарантия" },
  { key: "deliveryDate", label: "Дата поставки", category: "Даты и гарантия" },
  { key: "commissioningDate", label: "Дата ввода в эксплуатацию", category: "Даты и гарантия" },
  { key: "warrantyExpiration", label: "Срок окончания гарантии", category: "Даты и гарантия" },
  { key: "serviceDueDate", label: "Дата следующего ТО", category: "Даты и гарантия" },

  { key: "manufacturer", label: "Завод-изготовитель", category: "Изготовитель" },
  { key: "supplier", label: "Компания-поставщик", category: "Изготовитель" },
  { key: "countryOfOrigin", label: "Страна производства", category: "Изготовитель" },
  { key: "isImported", label: "Признак импортного оборудования", category: "Изготовитель" },
  { key: "isUnique", label: "Признак уникальной техники", category: "Изготовитель" },

  { key: "techSpecs", label: "Параметры и тех. характеристики", category: "Характеристики" },
  { key: "notes", label: "Примечания и эксплуатационные заметки", category: "Характеристики" },
];

const INITIAL_REPORTS: ReportItem[] = [
  {
    id: "rep-1",
    name: "Полный реестр всех атрибутов и характеристик оборудования (Быстрый отчёт)",
    category: "Паспортизация",
    format: "CSV",
    generatedAt: "05.08.2026 14:30",
    status: "READY",
    size: "4.8 MB",
    description: "Полная выгрузка всех 25+ атрибутов оборудования, включая заводские номера, гарантийные сроки, локации и тех. параметры.",
    recordsCount: 148,
  },
  {
    id: "rep-2",
    name: "Аналитический отчет по возрастному составу и износу техники",
    category: "Аналитика",
    format: "PDF",
    generatedAt: "05.08.2026 12:15",
    status: "READY",
    size: "4.1 MB",
    description: "Распределение оборудования по срокам эксплуатации, амортизационным группам и уровню физического износа.",
    recordsCount: 92,
  },
  {
    id: "rep-3",
    name: "Реестр оборудования в разрезе цехов и пролетов",
    category: "Инвентаризация",
    format: "XLSX",
    generatedAt: "04.08.2026 18:00",
    status: "READY",
    size: "1.8 MB",
    description: "Полная ведомость распределения парка техники по структурным подразделениям и производственным площадкам.",
    recordsCount: 230,
  },
  {
    id: "rep-4",
    name: "Журнал движения ревизий техпаспортов (v1.0 - v2.0)",
    category: "Аудит версий",
    format: "CSV",
    generatedAt: "03.08.2026 09:45",
    status: "READY",
    size: "850 KB",
    description: "История внесенных изменений в технические характеристики, схемы и эксплуатационные данные оборудования.",
    recordsCount: 310,
  },
];

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>(INITIAL_REPORTS);
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [formatFilter, setFormatFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    fetch("/api/modules/eps/equipment/export")
      .then((res) => res.text())
      .catch(() => "");
  }, []);

  // Modal & Builder states
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [previewReport, setPreviewReport] = useState<ReportItem | null>(null);

  // Flexible Report Builder State
  const [builderTitle, setBuilderTitle] = useState("Настраиваемый отчет по парку оборудования");
  const [builderCategory, setBuilderCategory] = useState("Паспортизация");
  const [builderFormat, setBuilderFormat] = useState<"XLSX" | "PDF" | "CSV">("XLSX");
  const [builderDeptFilter, setBuilderDeptFilter] = useState("ALL");
  const [builderStatusFilter, setBuilderStatusFilter] = useState("ALL");
  const [builderCriticalityFilter, setBuilderCriticalityFilter] = useState("ALL");

  // Selected fields for builder (default: primary equipment fields)
  const [selectedFields, setSelectedFields] = useState<string[]>([
    "equipmentCode",
    "name",
    "type",
    "category",
    "department",
    "status",
    "responsibleUser",
  ]);

  const [generating, setGenerating] = useState(false);

  const [columns, setColumns] = useState<ReportColumnVisibility>(DEFAULT_COLUMNS);

  useEffect(() => {
    let isSubscribed = true;
    Promise.resolve().then(() => {
      if (!isSubscribed) return;
      try {
        const saved = localStorage.getItem("eps_reports_columns");
        if (saved) {
          const parsed = JSON.parse(saved);
          setColumns({ ...DEFAULT_COLUMNS, ...parsed });
        }
      } catch {
        // Игнорируем
      }
    });
    return () => {
      isSubscribed = false;
    };
  }, []);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const toggleColumn = (key: keyof ReportColumnVisibility) => {
    setColumns((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("eps_reports_columns", JSON.stringify(updated));
      } catch {
        // Игнорируем
      }
      return updated;
    });
  };

  const toggleBuilderField = (key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAllBuilderFields = () => {
    setSelectedFields(BUILDER_FIELDS.map((f) => f.key));
  };

  const clearAllBuilderFields = () => {
    setSelectedFields(["equipmentCode", "name"]);
  };

  const refreshReports = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 400);
  }, []);

  const categories = useMemo(() => {
    return Array.from(new Set(reports.map((r) => r.category))).filter(Boolean);
  }, [reports]);

  const departments = useMemo(() => {
    return Array.from(new Set(equipmentList.map((e) => e.department))).filter(Boolean);
  }, [equipmentList]);

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

  // Live preview items for report builder
  const builderPreviewData = useMemo(() => {
    return equipmentList.filter((item) => {
      if (builderDeptFilter !== "ALL" && item.department !== builderDeptFilter) return false;
      if (builderStatusFilter !== "ALL" && item.status !== builderStatusFilter) return false;
      if (builderCriticalityFilter !== "ALL" && item.criticality !== builderCriticalityFilter) return false;
      return true;
    });
  }, [equipmentList, builderDeptFilter, builderStatusFilter, builderCriticalityFilter]);

  const kpiStats = useMemo(() => {
    const total = reports.length;
    const ready = reports.filter((r) => r.status === "READY").length;
    const generatingCount = reports.filter((r) => r.status === "GENERATING").length;
    const readyPercentage = total > 0 ? Math.round((ready / total) * 100) : 0;
    return { total, ready, generatingCount, readyPercentage };
  }, [reports]);

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

  const handleGenerateCustomReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!builderTitle.trim() || selectedFields.length === 0) return;

    setGenerating(true);

    setTimeout(() => {
      const createdReport: ReportItem = {
        id: `rep-custom-${Date.now()}`,
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
        size: builderFormat === "XLSX" ? "3.2 MB" : builderFormat === "PDF" ? "4.5 MB" : "1.4 MB",
        description: `Сформирован через Конструктор отчётов (${selectedFields.length} колонок, ${builderPreviewData.length} записей).`,
        recordsCount: builderPreviewData.length,
      };

      setReports((prev) => [createdReport, ...prev]);
      setGenerating(false);
      setShowBuilderModal(false);
    }, 600);
  };

  // Dynamic grid template calculation based on visible columns
  const gridTemplateClass = useMemo(() => {
    const parts: string[] = [];
    if (columns.name) parts.push("2.5fr");
    if (columns.category) parts.push("1.5fr");
    if (columns.format) parts.push("1.2fr");
    if (columns.generatedAt) parts.push("1.5fr");
    if (columns.status) parts.push("1.2fr");
    if (columns.actions) parts.push("1.5fr");

    if (parts.length === 0) return "1fr";
    return parts.join(" ");
  }, [columns]);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Breadcrumbs & Title Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
              <Link href="/" className="hover:text-slate-600">Главная</Link>
              <ChevronRight size={12} />
              <Link href="/modules/eps" className="hover:text-slate-600">EPS Паспортизация</Link>
              <ChevronRight size={12} />
              <span className="text-[#3473d4]">Отчёты</span>
            </div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Отчёты
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Гибкий конструктор отчетов, экспорты всех параметров оборудования и ведомостей техники (найдено {filteredReports.length} из {reports.length} отч.).
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a
              href="/api/modules/eps/equipment/export"
              download
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              title="Выгрузить весь массив данных о технике в CSV"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" /> Быстрый отчёт (Всё оборудование)
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
              <Wrench size={14} /> Конструктор отчётов
            </button>
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
                  placeholder="Поиск по наименованию отчета, категории или описанию…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-[#f8fafc] pl-9 pr-8 text-[11px] outline-none placeholder:text-slate-400 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
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

              {/* Format Select */}
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
                <option value="READY">Готов</option>
                <option value="GENERATING">Формируется</option>
                <option value="ARCHIVED">В архиве</option>
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
                          checked={columns.name}
                          onChange={() => toggleColumn("name")}
                          className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                        />
                        <span>Наименование отчёта</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={columns.category}
                          onChange={() => toggleColumn("category")}
                          className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                        />
                        <span>Категория</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={columns.format}
                          onChange={() => toggleColumn("format")}
                          className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                        />
                        <span>Формат выгрузки</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={columns.generatedAt}
                          onChange={() => toggleColumn("generatedAt")}
                          className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                        />
                        <span>Дата формирования</span>
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

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={columns.actions}
                          onChange={() => toggleColumn("actions")}
                          className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                        />
                        <span>Действия</span>
                      </label>
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
                  Поиск: &quot;{searchQuery}&quot;
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
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100 font-mono">
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

              <button
                onClick={resetAllFilters}
                className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700 ml-1"
              >
                <RotateCcw size={10} /> Сбросить все
              </button>
            </div>
          )}
        </div>

        {/* Generated Reports Table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
          <div
            className="hidden gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 md:grid"
            style={{ gridTemplateColumns: gridTemplateClass }}
          >
            {columns.name && <span>Наименование отчёта</span>}
            {columns.category && <span>Категория</span>}
            {columns.format && <span>Формат</span>}
            {columns.generatedAt && <span>Дата формирования</span>}
            {columns.status && <span>Статус</span>}
            {columns.actions && <span className="text-right">Действия</span>}
          </div>

          {filteredReports.length === 0 ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400 space-y-2">
              <p>Отчёты по заданным критериям фильтрации не найдены.</p>
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
            filteredReports.map((rep) => {
              const fmtConfig = FORMAT_CONFIG[rep.format] || FORMAT_CONFIG.XLSX;

              return (
                <div
                  key={rep.id}
                  className="grid gap-2 border-b border-slate-100 px-5 py-3.5 last:border-0 hover:bg-slate-50/50 md:items-center md:gap-4 transition text-xs"
                  style={{ gridTemplateColumns: gridTemplateClass }}
                >
                  {columns.name && (
                    <div>
                      <span className="block font-semibold text-[#17243a] text-[12px]">{rep.name}</span>
                      {rep.description && (
                        <span className="block text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          {rep.description}
                        </span>
                      )}
                    </div>
                  )}

                  {columns.category && (
                    <div>
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200/60">
                        {rep.category}
                      </span>
                    </div>
                  )}

                  {columns.format && (
                    <div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold font-mono border ${fmtConfig.bg} ${fmtConfig.text}`}>
                        {rep.format}
                      </span>
                    </div>
                  )}

                  {columns.generatedAt && (
                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                      <Calendar size={12} className="text-slate-400" /> {rep.generatedAt}
                    </div>
                  )}

                  {columns.status && (
                    <div>
                      {rep.status === "READY" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-600 border border-emerald-100">
                          <CheckCircle2 size={10} /> Готов
                        </span>
                      )}
                      {rep.status === "GENERATING" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-600 border border-amber-100">
                          <Clock size={10} className="animate-spin" /> Формируется
                        </span>
                      )}
                      {rep.status === "ARCHIVED" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500 border border-slate-200">
                          <Archive size={10} /> Архив
                        </span>
                      )}
                    </div>
                  )}

                  {columns.actions && (
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setPreviewReport(rep)}
                        className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 hover:text-[#3473d4]"
                        title="Просмотр сведений об отчете"
                      >
                        <Eye size={13} /> Инфо
                      </button>
                      <a
                        href={`/api/modules/eps/equipment/export?format=${rep.format.toLowerCase()}`}
                        download
                        className="flex items-center gap-1 text-[10px] font-semibold text-[#3473d4] hover:text-blue-700"
                      >
                        <Download size={13} /> {rep.size}
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* Modal: Flexible Report Builder */}
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
                    <h3 className="text-base font-bold text-[#17243a]">Конструктор отчётов EPS</h3>
                    <p className="text-[11px] text-slate-400">
                      Выберите поля оборудования, фильтры и формат выгрузки для формирования отчёта
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
                      Наименование отчета <span className="text-red-500">*</span>
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
                      Категория отчета
                    </label>
                    <select
                      value={builderCategory}
                      onChange={(e) => setBuilderCategory(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-xs outline-none focus:border-[#3c82ed]"
                    >
                      <option value="Паспортизация">Паспортизация</option>
                      <option value="Аналитика">Аналитика</option>
                      <option value="Инвентаризация">Инвентаризация</option>
                      <option value="Аудит версий">Аудит версий</option>
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
                        Выбор атрибутов оборудования ({selectedFields.length} из {BUILDER_FIELDS.length} полей)
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

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                    {["Идентификация", "Локация и ответственность", "Даты и гарантия", "Изготовитель", "Характеристики"].map(
                      (catName) => {
                        const fieldsInCat = BUILDER_FIELDS.filter((f) => f.category === catName);
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
                                      onChange={() => toggleBuilderField(f.key)}
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                        Подразделение
                      </label>
                      <select
                        value={builderDeptFilter}
                        onChange={(e) => setBuilderDeptFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-2.5 py-1.5 text-xs outline-none"
                      >
                        <option value="ALL">Все подразделения</option>
                        {departments.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                        Статус оборудования
                      </label>
                      <select
                        value={builderStatusFilter}
                        onChange={(e) => setBuilderStatusFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-2.5 py-1.5 text-xs outline-none"
                      >
                        <option value="ALL">Все статусы</option>
                        <option value="ACTIVE">В эксплуатации (ACTIVE)</option>
                        <option value="INACTIVE">В резерве (INACTIVE)</option>
                        <option value="DRAFT">Черновик (DRAFT)</option>
                        <option value="DECOMMISSIONED">Списано (DECOMMISSIONED)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                        Класс критичности
                      </label>
                      <select
                        value={builderCriticalityFilter}
                        onChange={(e) => setBuilderCriticalityFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-2.5 py-1.5 text-xs outline-none"
                      >
                        <option value="ALL">Все классы (A, B, C)</option>
                        <option value="A">Класс A (Критическое)</option>
                        <option value="B">Класс B (Основное)</option>
                        <option value="C">Класс C (Вспомогательное)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Real-time Data Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#17243a]">
                      Предварительный просмотр данных ({builderPreviewData.length} ед. техники)
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
                            const option = BUILDER_FIELDS.find((b) => b.key === fKey);
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
                              let val = (item as unknown as Record<string, unknown>)[fKey];
                              if (fKey === "techSpecs" && item.techSpecs) {
                                val = Object.entries(item.techSpecs)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join("; ");
                              }
                              if (typeof val === "boolean") val = val ? "Да" : "Нет";
                              const displayVal = typeof val === "string" || typeof val === "number" ? String(val) : "—";
                              return (
                                <td key={fKey} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                                  {displayVal}
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
                  href={`/api/modules/eps/equipment/export?fields=${selectedFields.join(",")}&department=${builderDeptFilter}&status=${builderStatusFilter}`}
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
                    {generating ? "Сохранение..." : "Сформировать и сохранить отчет"}
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
                    <h3 className="text-sm font-bold text-[#17243a]">Параметры отчёта</h3>
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
                  <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Наименование</span>
                  <p className="font-bold text-[#17243a] text-sm mt-0.5">{previewReport.name}</p>
                </div>

                {previewReport.description && (
                  <div>
                    <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Описание</span>
                    <p className="text-slate-600 text-[11px] mt-0.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {previewReport.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="block text-[9px] font-semibold uppercase text-slate-400">Категория</span>
                    <span className="font-semibold text-slate-700 text-[11px] mt-0.5 block">{previewReport.category}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="block text-[9px] font-semibold uppercase text-slate-400">Формат & Размер</span>
                    <span className="font-bold text-[#3473d4] font-mono text-[11px] mt-0.5 block">
                      {previewReport.format} ({previewReport.size})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="block text-[9px] font-semibold uppercase text-slate-400">Дата сбора</span>
                    <span className="font-mono text-slate-600 text-[11px] mt-0.5 block">{previewReport.generatedAt}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="block text-[9px] font-semibold uppercase text-slate-400">Записей обработано</span>
                    <span className="font-mono font-semibold text-emerald-600 text-[11px] mt-0.5 block">
                      {previewReport.recordsCount || 100} ед.
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => setPreviewReport(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Закрыть
                </button>
                <a
                  href={`/api/modules/eps/equipment/export?format=${previewReport.format.toLowerCase()}`}
                  download
                  className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#2565c8]"
                >
                  <Download size={13} /> Скачать файл ({previewReport.size})
                </a>
              </div>
            </div>
          </div>
        )}
      </main>
    </ShellLayout>
  );
}
