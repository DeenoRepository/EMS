"use client";

import { useState, useMemo, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { Download, RefreshCw, FileText, CheckCircle2, Clock, Wrench, Sparkles, Eye, FileSpreadsheet } from "lucide-react";
import {
  PageHeader,
  KpiGrid,
  FilterToolbar,
  DataTable,
  StatusBadge,
  Modal,
  ModalHeader,
  ModalFooter,
  FormSection,
  FormField,
  Input,
  Select,
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
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [formatFilter, setFormatFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  // Modal & Builder states
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [previewReport, setPreviewReport] = useState<WmsReportItem | null>(null);

  // Flexible Report Builder State
  const [builderTitle, setBuilderTitle] = useState("Настраиваемый отчёт по остаткам ТМЦ");
  const [builderCategory, setBuilderCategory] = useState("Складские остатки");
  const [builderFormat, setBuilderFormat] = useState<"XLSX" | "PDF" | "CSV">("XLSX");
  const [selectedFields, setSelectedFields] = useState<string[]>([
    "sku",
    "name",
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
    fetch("/api/modules/wms/reports")
      .then((res) => (res.ok ? res.json() : { reports: [] }))
      .then((data) => {
        if (isSubscribed) setReports(data.reports || []);
      })
      .catch(() => {})
      .finally(() => {
        if (isSubscribed) setLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  const fetchReports = () => {
    setLoading(true);
    fetch("/api/modules/wms/reports")
      .then((res) => (res.ok ? res.json() : { reports: [] }))
      .then((data) => setReports(data.reports || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

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
        description: `Сформирован через Конструктор отчётов WMS (${selectedFields.length} колонок).`,
        recordsCount: 120,
      };

      setReports((prev) => [createdReport, ...prev]);
      setGenerating(false);
      setShowBuilderModal(false);
    }, 500);
  };

  const toggleBuilderField = (key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
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
          title="Складские отчёты и Аналитика WMS"
          description="Гибкий конструктор отчётов, экспорты параметров ТМЦ, выгрузка ведомостей и аналитика складских запасов"
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
                onClick={fetchReports}
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
          searchPlaceholder="Поиск по названию или категории отчёта…"
          filters={[
            {
              key: "status",
              label: "Статус",
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { value: "ALL", label: "Все статусы" },
                { value: "READY", label: "Сформирован" },
                { value: "GENERATING", label: "Формируется" },
                { value: "ARCHIVED", label: "Архивный" },
              ],
            },
            {
              key: "format",
              label: "Формат",
              value: formatFilter,
              onChange: setFormatFilter,
              options: [
                { value: "ALL", label: "Все форматы" },
                { value: "XLSX", label: "Excel (XLSX)" },
                { value: "PDF", label: "PDF Документ" },
                { value: "CSV", label: "CSV Реестр" },
              ],
            },
          ]}
          columns={[
            { key: "name", label: "Наименование отчёта", visible: columns.name },
            { key: "category", label: "Категория", visible: columns.category },
            { key: "format", label: "Формат", visible: columns.format },
            { key: "generatedAt", label: "Дата генерации", visible: columns.generatedAt },
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

        {/* Modal: Flexible Report Builder */}
        <Modal open={showBuilderModal} onClose={() => setShowBuilderModal(false)} size="xl">
          <ModalHeader
            icon={<Wrench size={16} />}
            title="Конструктор отчётов WMS"
            subtitle="Выберите атрибуты ТМЦ, фильтры и формат выгрузки для формирования отчёта"
            onClose={() => setShowBuilderModal(false)}
          />
          <form onSubmit={handleGenerateCustomReport} className="py-3 space-y-4 text-xs">
            <FormSection title="Основные параметры отчёта">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField label="Наименование отчёта" required>
                  <Input
                    required
                    value={builderTitle}
                    onChange={(e) => setBuilderTitle(e.target.value)}
                  />
                </FormField>
                <FormField label="Категория отчёта">
                  <Select
                    value={builderCategory}
                    onChange={(e) => setBuilderCategory(e.target.value)}
                    options={[
                      { value: "Складские остатки", label: "Складские остатки" },
                      { value: "Аналитика движений", label: "Аналитика движений" },
                      { value: "Инвентаризация", label: "Инвентаризация" },
                      { value: "Финансовый аудит", label: "Финансовый аудит" },
                    ]}
                  />
                </FormField>
                <FormField label="Формат выгрузки">
                  <Select
                    value={builderFormat}
                    onChange={(e) => setBuilderFormat(e.target.value as "XLSX" | "PDF" | "CSV")}
                    options={[
                      { value: "XLSX", label: "XLSX (Excel Таблица)" },
                      { value: "PDF", label: "PDF (Печатный документ)" },
                      { value: "CSV", label: "CSV (Машиночитаемый)" },
                    ]}
                  />
                </FormField>
              </div>
            </FormSection>

            <FormSection title={`Выбор атрибутов ТМЦ (${selectedFields.length} полей)`}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {["Идентификация", "Склад и остатки", "Финансы и поставка", "Характеристики"].map(
                  (catName) => {
                    const fieldsInCat = WMS_BUILDER_FIELDS.filter((f) => f.category === catName);
                    return (
                      <div key={catName} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-800/40 p-3 space-y-2">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-1">
                          {catName}
                        </span>
                        <div className="space-y-1.5 pt-1">
                          {fieldsInCat.map((field) => {
                            const isChecked = selectedFields.includes(field.key);
                            return (
                              <label key={field.key} className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 dark:text-slate-300 hover:text-black">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleBuilderField(field.key)}
                                  className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                                />
                                <span>{field.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </FormSection>

            <ModalFooter
              onCancel={() => setShowBuilderModal(false)}
              cancelLabel="Отмена"
              confirmLabel={generating ? "Формирование…" : "Сформировать отчёт"}
              submitting={generating}
            />
          </form>
        </Modal>

        {/* Modal Preview Info */}
        <Modal open={Boolean(previewReport)} onClose={() => setPreviewReport(null)} size="md">
          <ModalHeader
            icon={<FileText size={16} />}
            title="Сведения об отчёте WMS"
            subtitle={`ID: ${previewReport?.id || ""}`}
            onClose={() => setPreviewReport(null)}
          />
          {previewReport && (
            <div className="py-2 space-y-3 text-xs">
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
          )}
          <ModalFooter onCancel={() => setPreviewReport(null)} cancelLabel="Закрыть" />
        </Modal>
      </main>
    </ShellLayout>
  );
}
