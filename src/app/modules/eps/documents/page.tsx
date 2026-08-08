"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useShell } from "@/components/layout/shell-context";
import { DocumentItem } from "@/lib/modules/eps-advanced-store";
import { EquipmentItem } from "@/lib/modules/eps-store";
import {
  FileText,
  Plus,
  Download,
  RefreshCw,
  X,
  Upload,
  Eye,
  Server,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Search,
  SlidersHorizontal,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  HardDrive,
  RotateCcw,
} from "lucide-react";

const DOC_TYPE_CONFIG: Record<
  DocumentItem["docType"],
  { label: string; bg: string; text: string; icon: React.ElementType }
> = {
  PASSPORT: {
    label: "PASSPORT",
    bg: "bg-blue-50",
    text: "text-[#3473d4]",
    icon: FileText,
  },
  OPERATION_MANUAL: {
    label: "MANUAL",
    bg: "bg-indigo-50",
    text: "text-indigo-600",
    icon: HardDrive,
  },
  DRAWING: {
    label: "DRAWING",
    bg: "bg-purple-50",
    text: "text-purple-600",
    icon: FileCode,
  },
  CERTIFICATE: {
    label: "CERTIFICATE",
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    icon: ShieldCheck,
  },
  ACT: {
    label: "ACT",
    bg: "bg-amber-50",
    text: "text-amber-600",
    icon: CheckCircle2,
  },
  OTHER: {
    label: "OTHER",
    bg: "bg-slate-100",
    text: "text-slate-500",
    icon: FileSpreadsheet,
  },
};

import ShellLayout from "@/components/layout/shell-layout";

export default function DocumentsPage() {
  return (
    <ShellLayout>
      <DocumentsPageContent />
    </ShellLayout>
  );
}

function DocumentsPageContent() {
  const { currentUser } = useShell();
  const userRoles = currentUser?.roles || [];
  const canEdit = userRoles.includes("ADMIN") || userRoles.includes("EDITOR") || userRoles.includes("APPROVER");

  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewPage, setPreviewPage] = useState<number>(1);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedEqFilter, setSelectedEqFilter] = useState<string>("ALL");

  // Form state
  const [title, setTitle] = useState("");
  const [selectedEquipmentCode, setSelectedEquipmentCode] = useState("");
  const [docType, setDocType] = useState<DocumentItem["docType"]>("PASSPORT");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const [docsRes, eqRes] = await Promise.all([
        fetch("/api/modules/eps/documents"),
        fetch("/api/modules/eps/equipment"),
      ]);

      if (docsRes.ok) {
        const data = await docsRes.json();
        setDocs(data.items || []);
      }

      if (eqRes.ok) {
        const eqData = await eqRes.json();
        const items = eqData.items || [];
        setEquipmentList(items);
        if (items.length > 0) {
          setSelectedEquipmentCode(items[0].equipmentCode);
        }
      }
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchDocs();
    })();
  }, [fetchDocs]);

  // Statistics
  const stats = useMemo(() => {
    const total = docs.length;
    const passports = docs.filter((d) => d.docType === "PASSPORT").length;
    const drawings = docs.filter((d) => d.docType === "DRAWING").length;
    const acts = docs.filter((d) => d.docType === "ACT").length;
    return { total, passports, drawings, acts };
  }, [docs]);

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return docs.filter((doc) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.fileName.toLowerCase().includes(q) ||
        doc.equipmentCode.toLowerCase().includes(q);

      const matchesType = selectedType === "ALL" || doc.docType === selectedType;
      const matchesEq = selectedEqFilter === "ALL" || doc.equipmentCode === selectedEqFilter;

      return matchesQuery && matchesType && matchesEq;
    });
  }, [docs, searchQuery, selectedType, selectedEqFilter]);

  const activeFiltersCount = (searchQuery ? 1 : 0) + (selectedType !== "ALL" ? 1 : 0) + (selectedEqFilter !== "ALL" ? 1 : 0);

  const resetAllFilters = () => {
    setSearchQuery("");
    setSelectedType("ALL");
    setSelectedEqFilter("ALL");
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !file || !selectedEquipmentCode) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("equipmentCode", selectedEquipmentCode);
      formData.append("title", title);
      formData.append("docType", docType);

      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setShowUploadModal(false);
        setTitle("");
        setFile(null);
        fetchDocs();
      }
    } catch {
      alert("Ошибка при загрузке документа");
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Breadcrumbs & Title */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
              <Link href="/" className="hover:text-slate-600">Главная</Link>
              <ChevronRight size={12} />
              <Link href="/modules/eps" className="hover:text-slate-600">EPS Паспортизация</Link>
              <ChevronRight size={12} />
              <span className="text-[#3473d4]">Документы</span>
            </div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Документы и Схемы EPS
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Электронный архив техпаспортов, руководств по эксплуатации и чертежей (найдено {filteredDocs.length} из {docs.length} док.).
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchDocs}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
            </button>
            {canEdit && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
              >
                <Plus size={14} /> Загрузить документ
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Overview */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Всего документов
              </span>
              <div className="rounded-md bg-blue-50 p-1.5 text-[#3473d4]">
                <Layers size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
              {stats.total}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">В электронном архиве</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Техпаспорта
              </span>
              <div className="rounded-md bg-indigo-50 p-1.5 text-indigo-600">
                <FileText size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
              {stats.passports}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Паспорта единиц</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Чертежи и схемы
              </span>
              <div className="rounded-md bg-purple-50 p-1.5 text-purple-600">
                <FileCode size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
              {stats.drawings}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Электросхемы и узлы</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Акты ввода
              </span>
              <div className="rounded-md bg-amber-50 p-1.5 text-amber-600">
                <CheckCircle2 size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
              {stats.acts}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Приемка в эксплуатацию</div>
          </div>
        </div>

        {/* Enhanced Filter Toolbar */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            {/* Search Input */}
            <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
              <div className="relative w-full">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Поиск по наименованию, файлу или коду техники…"
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

            {/* Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1 text-[#3473d4]">
                <SlidersHorizontal size={13} />
                <span className="font-semibold text-[11px]">Фильтры:</span>
              </div>

              {/* Type Select */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className={`h-8 rounded-lg border px-2.5 text-[10px] outline-none transition ${
                  selectedType !== "ALL"
                    ? "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold"
                    : "border-slate-200 bg-[#f8fafc] text-slate-600 focus:border-[#3c82ed]"
                }`}
              >
                <option value="ALL">Все типы документов</option>
                <option value="PASSPORT">Технический паспорт</option>
                <option value="OPERATION_MANUAL">Инструкция по эксплуатации</option>
                <option value="DRAWING">Чертеж / Электросхема</option>
                <option value="CERTIFICATE">Сертификат</option>
                <option value="ACT">Акт ввода</option>
                <option value="OTHER">Прочее</option>
              </select>

              {/* Equipment Select */}
              <select
                value={selectedEqFilter}
                onChange={(e) => setSelectedEqFilter(e.target.value)}
                className={`h-8 rounded-lg border px-2.5 text-[10px] outline-none transition font-mono max-w-[200px] truncate ${
                  selectedEqFilter !== "ALL"
                    ? "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold"
                    : "border-slate-200 bg-[#f8fafc] text-slate-600 focus:border-[#3c82ed]"
                }`}
              >
                <option value="ALL">Всё оборудование</option>
                {equipmentList.map((eq) => (
                  <option key={eq.id} value={eq.equipmentCode}>
                    {eq.equipmentCode} ({eq.name})
                  </option>
                ))}
              </select>
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

              {selectedType !== "ALL" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100">
                  Тип: {selectedType}
                  <button onClick={() => setSelectedType("ALL")} className="hover:text-blue-800">
                    <X size={11} />
                  </button>
                </span>
              )}

              {selectedEqFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100 font-mono">
                  Техника: {selectedEqFilter}
                  <button onClick={() => setSelectedEqFilter("ALL")} className="hover:text-blue-800">
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

        {/* Documents Table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
          <div className="hidden grid-cols-[1.2fr_2.5fr_1.5fr_1fr_1.5fr] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 md:grid">
            <span>Код техники</span>
            <span>Наименование документа</span>
            <span>Тип документа</span>
            <span>Размер</span>
            <span className="text-right">Действие</span>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400 space-y-2">
              <p>Документы в архиве по заданным критериям не найдены.</p>
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
            filteredDocs.map((doc) => {
              const config = DOC_TYPE_CONFIG[doc.docType] || DOC_TYPE_CONFIG.OTHER;

              return (
                <div
                  key={doc.id}
                  className="grid gap-2 border-b border-slate-100 px-5 py-3.5 last:border-0 hover:bg-slate-50/50 md:grid-cols-[1.2fr_2.5fr_1.5fr_1fr_1.5fr] md:items-center md:gap-4 transition text-xs"
                >
                  <div>
                    <Link
                      href={`/modules/eps/${encodeURIComponent(doc.equipmentCode)}`}
                      className="text-[11px] font-bold text-[#3473d4] font-mono hover:underline"
                    >
                      {doc.equipmentCode}
                    </Link>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-[#17243a]">{doc.title}</span>
                    <span className="block text-[10px] text-slate-400 font-mono">{doc.fileName}</span>
                  </div>

                  <div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full ${config.bg} px-2 py-0.5 text-[9px] font-semibold ${config.text}`}
                    >
                      {config.label}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 font-mono">
                    {doc.fileSize}
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="flex items-center gap-1 text-[10px] font-semibold text-[#3473d4] hover:text-blue-700"
                    >
                      <Eye size={12} /> Просмотр
                    </button>
                    <a
                      href={`/api/files/download?id=${doc.id}`}
                      download
                      className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700"
                    >
                      <Download size={12} /> Скачать
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Upload Document Modal */}
        {showUploadModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
            onClick={() => setShowUploadModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#eef5ff] text-[#3473d4]">
                    <Upload size={16} />
                  </div>
                  <h3 className="text-sm font-bold text-[#17243a]">Загрузка технического документа</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600 flex items-center gap-1.5">
                    <Server size={13} className="text-[#3473d4]" /> Оборудование
                  </label>
                  <select
                    value={selectedEquipmentCode}
                    onChange={(e) => setSelectedEquipmentCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
                    required
                  >
                    {equipmentList.map((eq) => (
                      <option key={eq.id} value={eq.equipmentCode}>
                        {eq.equipmentCode} — {eq.name} ({eq.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Название документа *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="например, Паспорт завода-изготовителя 2026.pdf"
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Тип документа</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as DocumentItem["docType"])}
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="PASSPORT">Технический паспорт</option>
                    <option value="OPERATION_MANUAL">Инструкция по эксплуатации</option>
                    <option value="DRAWING">Чертеж / Электросхема</option>
                    <option value="CERTIFICATE">Сертификат соответствия</option>
                    <option value="ACT">Акт ввода в эксплуатацию</option>
                    <option value="OTHER">Прочее</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Файл документа *</label>
                  <input
                    type="file"
                    required
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-[#eef5ff] file:text-[#3473d4] hover:file:bg-blue-100"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
                  >
                    <Upload size={13} />
                    {uploading ? "Загрузка…" : "Загрузить файл"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Document Preview Modal */}
        {previewDoc && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
            onClick={() => setPreviewDoc(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 max-h-[92vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#3473d4]">
                    <FileText size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#17243a]">{previewDoc.title}</h3>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-[#3473d4]">
                        {previewDoc.docType}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Код оборудования: <span className="text-[#3473d4] font-semibold">{previewDoc.equipmentCode}</span> | Файл: {previewDoc.fileName} ({previewDoc.fileSize})
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewDoc.storagePath ? `/api/files/preview?path=${encodeURIComponent(previewDoc.storagePath)}` : `/api/files/download?id=${previewDoc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition"
                    title="Открыть документ в новой вкладке браузера"
                  >
                    <ExternalLink size={12} className="text-[#3473d4]" />
                    <span>В новом окне</span>
                  </a>
                  <a
                    href={`/api/files/download?id=${previewDoc.id}`}
                    download
                    className="flex items-center gap-1 rounded-lg bg-[#2f74df] px-3 py-1.5 text-[10px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] transition"
                  >
                    <Download size={12} />
                    <span>Скачать</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(null)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 ml-1 transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Toolbar & Page Navigation */}
              <div className="flex items-center justify-between bg-slate-50 px-4 py-2 rounded-lg border border-slate-100 text-xs">
                <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                  <span className="font-semibold text-slate-700">Просмотр страниц:</span>
                  <span className="text-slate-400">Используйте навигатор ниже или встроенную панель PDF</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewPage((prev) => Math.max(1, prev - 1))}
                    disabled={previewPage <= 1}
                    className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ChevronLeft size={12} /> Назад
                  </button>
                  <span className="text-[10px] font-semibold text-slate-700 font-mono px-1">
                    Стр. {previewPage}
                  </span>
                  <button
                    onClick={() => setPreviewPage((prev) => prev + 1)}
                    className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Вперед <ChevronRight size={12} />
                  </button>
                </div>
              </div>

              {/* Embedded Document Viewer / Iframe */}
              <div className="flex-1 bg-slate-800 border border-slate-200 rounded-xl overflow-hidden min-h-[420px] max-h-[600px] flex flex-col relative">
                {previewDoc.fileName.toLowerCase().endsWith(".pdf") || previewDoc.storagePath?.toLowerCase().endsWith(".pdf") ? (
                  <iframe
                    src={`${previewDoc.storagePath ? `/api/files/preview?path=${encodeURIComponent(previewDoc.storagePath)}` : `/api/files/download?id=${previewDoc.id}`}#page=${previewPage}`}
                    className="w-full h-full min-h-[420px] border-0"
                    title={previewDoc.title}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-900 text-slate-300 space-y-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-blue-400 border border-slate-700 shadow-md">
                      <FileText size={32} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">{previewDoc.title}</h4>
                      <p className="text-xs text-slate-400 font-mono">{previewDoc.fileName} ({previewDoc.fileSize})</p>
                      <p className="text-[11px] text-slate-500 max-w-md pt-2">
                        Отображается страница <span className="text-blue-400 font-semibold">{previewPage}</span>. Вы можете открыть файл во внешней программе или скачать оригинал.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <a
                        href={previewDoc.storagePath ? `/api/files/preview?path=${encodeURIComponent(previewDoc.storagePath)}` : `/api/files/download?id=${previewDoc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition"
                      >
                        <ExternalLink size={14} /> Открыть в новом окне
                      </a>
                      <a
                        href={`/api/files/download?id=${previewDoc.id}`}
                        download
                        className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                      >
                        <Download size={14} /> Скачать оригинальный файл
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                <span>Версия документа: v{previewDoc.version || 1}</span>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
  );
}

