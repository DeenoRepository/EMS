"use client";

import { useState, useMemo } from "react";
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
  Save,
  Table,
  Box
} from "lucide-react";
import Link from "next/link";
import WmsSubNav from "@/components/wms/wms-sub-nav";

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

const MOCK_WMS_REPORTS: WmsReportItem[] = [
  {
    id: "rep-wms-001",
    name: "Оборотная ведомость ТМЦ и ЗИП (Август 2026)",
    category: "Складские остатки",
    format: "XLSX",
    generatedAt: "2026-08-05 16:30",
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
    generatedAt: "2026-08-06 09:15",
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
    generatedAt: "2026-08-04 11:00",
    status: "READY",
    size: "450 KB",
    description: "Группировка запасов по категориям A (80% стоимости), B (15%) и C (5%).",
    recordsCount: 890
  }
];

export default function WmsReportsPage() {
  const [reports, setReports] = useState<WmsReportItem[]>(MOCK_WMS_REPORTS);
  const [query, setQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<string>("ALL");
  const [showBuilder, setShowBuilder] = useState(false);

  // Flexible Builder State
  const [selectedFields, setSelectedFields] = useState<string[]>([
    "sku", "name", "category", "warehouse", "cell", "quantity", "unitPrice", "status"
  ]);

  const toggleField = (key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const filteredReports = useMemo(() => {
    return reports.filter((rep) => {
      if (formatFilter !== "ALL" && rep.format !== formatFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return rep.name.toLowerCase().includes(q) || rep.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [reports, query, formatFilter]);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-5">
        {/* Contextual Sub-Nav Bar */}
        <WmsSubNav />

        {/* Action Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <h2 className="text-base font-bold text-slate-900">Отчётность и Конструктор WMS</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Генерация оборотных ведомостей, анализа дефицита ЗИП и гибкая выгрузка данных
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowBuilder(!showBuilder)}
              className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#2565c8] transition cursor-pointer"
            >
              <Sparkles size={14} /> Конструктор выгрузки WMS
            </button>
          </div>
        </div>

        {/* Flexible Report Builder Modal / Collapsible Section */}
        {showBuilder && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-blue-100 pb-3">
              <div className="flex items-center gap-2 text-[#17243a] font-bold text-sm">
                <Sparkles size={16} className="text-[#3473d4]" />
                Гибкий конструктор экспорта складских запасов WMS
              </div>
              <button onClick={() => setShowBuilder(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Выберите поля ТМЦ, которые необходимо включить в персональный отчёт для выгрузки в CSV/Excel:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { key: "sku", label: "Артикул / SKU" },
                { key: "name", label: "Наименование ТМЦ" },
                { key: "category", label: "Категория запасов" },
                { key: "type", label: "Тип номенклатуры" },
                { key: "warehouse", label: "Склад хранения" },
                { key: "cell", label: "Ячейка хранения" },
                { key: "quantity", label: "Текущий остаток" },
                { key: "minQuantity", label: "Мин. неснижаемый остаток" },
                { key: "reservedQuantity", label: "Зарезервировано" },
                { key: "unitPrice", label: "Цена за единицу" },
                { key: "status", label: "Статус остатка" },
                { key: "compatibleEquipment", label: "Совместимость с EPS" },
                { key: "barcode", label: "Штрихкод / QR" },
                { key: "supplier", label: "Поставщик" }
              ].map((f) => (
                <label
                  key={f.key}
                  onClick={() => toggleField(f.key)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedFields.includes(f.key)
                      ? "bg-white border-blue-300 text-[#17243a] font-semibold shadow-2xs"
                      : "bg-blue-100/30 border-transparent text-slate-700 hover:bg-white"
                  }`}
                >
                  {selectedFields.includes(f.key) ? (
                    <CheckSquare size={14} className="text-[#3473d4] shrink-0" />
                  ) : (
                    <Square size={14} className="text-blue-300 shrink-0" />
                  )}
                  <span className="truncate">{f.label}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 border-t border-blue-100 pt-3">
              <a
                href="/api/modules/wms/items/export"
                download
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8] shadow-sm shadow-blue-200"
              >
                <Download size={14} /> Скачать сформированный отчёт ({selectedFields.length} полей)
              </a>
            </div>
          </div>
        )}

        {/* Existing Pre-packaged Reports List */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-4">
          <h2 className="text-sm font-bold text-[#17243a]">Готовые типовые отчёты WMS</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredReports.map((rep) => (
              <div key={rep.id} className="rounded-xl border border-slate-200 p-4 space-y-3 hover:border-blue-200 transition-colors">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[10px] font-bold text-[#3473d4] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    {rep.format}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{rep.generatedAt}</span>
                </div>

                <div>
                  <h3 className="font-bold text-xs text-[#17243a]">{rep.name}</h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{rep.description}</p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[11px]">
                  <span className="text-slate-400">{rep.recordsCount} записей | {rep.size}</span>
                  <a
                    href="/api/modules/wms/items/export"
                    download
                    className="flex items-center gap-1 font-semibold text-[#3473d4] hover:text-blue-700"
                  >
                    Скачать <Download size={12} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </ShellLayout>
  );
}
