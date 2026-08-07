"use client";

import { useState, useMemo, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { Download, RefreshCw, FileText, CheckCircle2, Clock, Archive } from "lucide-react";
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

export default function WmsReportsPage() {
  const [reports, setReports] = useState<WmsReportItem[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [formatFilter, setFormatFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

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
    const generating = reports.filter((r) => r.status === "GENERATING").length;
    return { total, ready, generating };
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
        cell: (r: WmsReportItem) => <span className="font-mono text-[10px] text-slate-400">{new Date(r.generatedAt).toLocaleString("ru-RU")}</span>,
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
        header: <span className="text-right block">Скачать</span>,
        cell: (r: WmsReportItem) => (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => alert(`Скачивание отчёта: ${r.name}`)}
              className="flex items-center gap-1 text-[10px] font-semibold text-[#3473d4] hover:underline"
            >
              <Download size={12} /> {r.size}
            </button>
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
          description="Генерация, выгрузка и архив регулярной документации складского учёта"
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учёт", href: "/modules/wms" },
            { title: "Отчёты" },
          ]}
          actions={
            <button
              onClick={fetchReports}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
            </button>
          }
        />

        <KpiGrid
          items={[
            { label: "Всего отчётов", value: kpiStats.total, icon: <FileText size={14} />, iconColor: "blue", sub: "В архиве и реестре" },
            { label: "Готовы к скачиванию", value: kpiStats.ready, icon: <CheckCircle2 size={14} />, iconColor: "emerald", sub: "Сформированы", subColor: "emerald" },
            { label: "В процессе генерации", value: kpiStats.generating, icon: <Clock size={14} />, iconColor: "amber", sub: "Фоновая сборка данных", subColor: "amber" },
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
      </main>
    </ShellLayout>
  );
}
