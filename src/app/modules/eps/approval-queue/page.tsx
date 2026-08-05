"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import ShellLayout from "@/components/layout/shell-layout";
import { ApprovalItem } from "@/lib/modules/eps-advanced-store";
import { EquipmentItem } from "@/lib/modules/eps-store";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  Server,
  X,
  ChevronRight,
  ClipboardCheck,
  Search,
  SlidersHorizontal,
  Columns3,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Layers,
  User,
  Calendar,
} from "lucide-react";

export interface ApprovalColumnVisibility {
  code: boolean;
  title: boolean;
  requestedBy: boolean;
  submittedAt: boolean;
  status: boolean;
  actions: boolean;
}

const DEFAULT_COLUMNS: ApprovalColumnVisibility = {
  code: true,
  title: true,
  requestedBy: true,
  submittedAt: true,
  status: true,
  actions: true,
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [targetCodeFilter, setTargetCodeFilter] = useState<string>("ALL");

  // Form state for creating approval request
  const [targetCode, setTargetCode] = useState("");
  const [title, setTitle] = useState("");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Column visibility state with localStorage persistence
  const [columns, setColumns] = useState<ApprovalColumnVisibility>(DEFAULT_COLUMNS);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("eps_approvals_columns");
      if (saved) {
        const parsed = JSON.parse(saved);
        setColumns({ ...DEFAULT_COLUMNS, ...parsed });
      }
    } catch {
      // Игнорируем ошибки чтения localStorage
    }
  }, []);

  const toggleColumn = (key: keyof ApprovalColumnVisibility) => {
    setColumns((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("eps_approvals_columns", JSON.stringify(updated));
      } catch {
        // Игнорируем
      }
      return updated;
    });
  };

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const [apprRes, eqRes] = await Promise.all([
        fetch("/api/modules/eps/approvals"),
        fetch("/api/modules/eps/equipment"),
      ]);

      if (apprRes.ok) {
        const data = await apprRes.json();
        setApprovals(data.items || []);
      }

      if (eqRes.ok) {
        const eqData = await eqRes.json();
        const items = eqData.items || [];
        setEquipmentList(items);
        if (items.length > 0) {
          setTargetCode(items[0].equipmentCode);
        }
      }
    } catch {
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleAction = async (id: string, actionStatus: "APPROVED" | "REJECTED") => {
    try {
      const res = await fetch("/api/modules/eps/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionStatus, id }),
      });
      if (res.ok) fetchApprovals();
    } catch {
      alert("Ошибка при изменении статуса");
    }
  };

  const handleCreateApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCode || !title) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/modules/eps/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE",
          targetCode,
          title,
          comments,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setTitle("");
        setComments("");
        fetchApprovals();
      }
    } catch {
      alert("Ошибка создания запроса");
    } finally {
      setSubmitting(false);
    }
  };

  // KPI Statistics
  const kpiStats = useMemo(() => {
    const total = approvals.length;
    const pending = approvals.filter((a) => a.status === "PENDING").length;
    const approved = approvals.filter((a) => a.status === "APPROVED").length;
    const rejected = approvals.filter((a) => a.status === "REJECTED").length;
    return { total, pending, approved, rejected };
  }, [approvals]);

  // Filtered approvals list
  const filteredApprovals = useMemo(() => {
    return approvals.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        item.targetCode.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.requestedBy.toLowerCase().includes(q) ||
        (item.comments && item.comments.toLowerCase().includes(q));

      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
      const matchesCode = targetCodeFilter === "ALL" || item.targetCode === targetCodeFilter;

      return matchesQuery && matchesStatus && matchesCode;
    });
  }, [approvals, searchQuery, statusFilter, targetCodeFilter]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim() !== "") count++;
    if (statusFilter !== "ALL") count++;
    if (targetCodeFilter !== "ALL") count++;
    return count;
  }, [searchQuery, statusFilter, targetCodeFilter]);

  const resetAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setTargetCodeFilter("ALL");
  };

  // Dynamic grid template calculation based on visible columns
  const gridTemplateClass = useMemo(() => {
    const parts: string[] = [];
    if (columns.code) parts.push("1.2fr");
    if (columns.title) parts.push("2.5fr");
    if (columns.requestedBy) parts.push("1.5fr");
    if (columns.submittedAt) parts.push("1.2fr");
    if (columns.status) parts.push("1.2fr");
    if (columns.actions) parts.push("1.5fr");

    if (parts.length === 0) return "1fr";
    return parts.join(" ");
  }, [columns]);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Breadcrumbs & Page Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
              <Link href="/" className="hover:text-slate-600">Главная</Link>
              <ChevronRight size={12} />
              <Link href="/modules/eps" className="hover:text-slate-600">EPS Паспортизация</Link>
              <ChevronRight size={12} />
              <span className="text-[#3473d4]">Очередь согласований</span>
            </div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Очередь согласований
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Утверждение изменений параметров оборудования с привязкой к технике из реестра (найдено {filteredApprovals.length} из {approvals.length} заявок).
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchApprovals}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
            </button>
          </div>
        </div>

        {/* Quick KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Всего заявок
              </span>
              <div className="rounded-md bg-blue-50 p-1.5 text-[#3473d4]">
                <Layers size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
              {kpiStats.total}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">В журнале согласований</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                На рассмотрении
              </span>
              <div className="rounded-md bg-amber-50 p-1.5 text-amber-600">
                <Clock size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
              {kpiStats.pending}
            </div>
            <div className="mt-1 text-[10px] text-amber-600 font-semibold">Ожидают решения</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Утверждено
              </span>
              <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-600">
                <CheckCircle2 size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
              {kpiStats.approved}
            </div>
            <div className="mt-1 text-[10px] text-emerald-600 font-semibold">Успешно визировано</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Отклонено
              </span>
              <div className="rounded-md bg-rose-50 p-1.5 text-rose-600">
                <AlertCircle size={14} />
              </div>
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
              {kpiStats.rejected}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Требуют доработки</div>
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
                  placeholder="Поиск по теме, коду техники или инициатору…"
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
                <option value="PENDING">На рассмотрении</option>
                <option value="APPROVED">Утверждено</option>
                <option value="REJECTED">Отклонено</option>
              </select>

              {/* Equipment Code Select */}
              <select
                value={targetCodeFilter}
                onChange={(e) => setTargetCodeFilter(e.target.value)}
                className={`h-8 rounded-lg border px-2.5 text-[10px] outline-none transition ${
                  targetCodeFilter !== "ALL"
                    ? "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold font-mono"
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
                        <span>Код техники</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={columns.title}
                          onChange={() => toggleColumn("title")}
                          className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                        />
                        <span>Тема и обоснование</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={columns.requestedBy}
                          onChange={() => toggleColumn("requestedBy")}
                          className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                        />
                        <span>Инициатор</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={columns.submittedAt}
                          onChange={() => toggleColumn("submittedAt")}
                          className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-200"
                        />
                        <span>Дата подачи</span>
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
                        <span>Решение</span>
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
                  Поиск: "{searchQuery}"
                  <button onClick={() => setSearchQuery("")} className="hover:text-blue-800">
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

              {targetCodeFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100 font-mono">
                  Техника: {targetCodeFilter}
                  <button onClick={() => setTargetCodeFilter("ALL")} className="hover:text-blue-800">
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

        {/* Modal Create Approval Request */}
        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
            onClick={() => setShowCreateModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef5ff] text-[#3473d4]">
                    <ClipboardCheck size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#17243a]">Подать заявку на согласование</h3>
                    <p className="text-[11px] text-slate-400">Утверждение изменений параметров оборудования или технической документации</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateApproval} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 flex items-center gap-1.5 text-[11px]">
                      <Server size={13} className="text-[#3473d4]" /> Техника из реестра <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={targetCode}
                      onChange={(e) => setTargetCode(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-xs outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono font-semibold text-[#17243a]"
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
                    <label className="font-semibold text-slate-700 text-[11px]">
                      Объект согласования <span className="text-red-500">*</span>
                    </label>
                    <select
                      defaultValue="EQUIPMENT_VERSION"
                      className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-xs outline-none focus:border-[#3c82ed]"
                    >
                      <option value="EQUIPMENT_VERSION">Версия техпаспорта техники</option>
                      <option value="DOCUMENT_VERSION">Электронный документ / Схема</option>
                      <option value="STATUS_CHANGE">Смена статуса оборудования</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 text-[11px]">Тема / Название заявки <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Например: Утверждение изменений параметров шпиндельного узла"
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3.5 py-2 text-xs outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 text-[11px]">Обоснование и комментарий инициатора</label>
                  <textarea
                    rows={3}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Укажите подробную причину изменений, ссылки на регламент или акты..."
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3.5 py-2 text-xs outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-[11px] text-slate-600 flex items-start gap-2">
                  <div className="rounded-md bg-blue-100 p-1 text-[#3473d4] mt-0.5">
                    <ClipboardCheck size={12} />
                  </div>
                  <div>
                    <span className="font-semibold text-[#17243a]">Процесс утверждения:</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Заявка поступит ответственным сотрудникам и техническим экспертам для проверки соответствия нормативам EPS.
                    </p>
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !title.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4.5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] disabled:opacity-50"
                  >
                    {submitting ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                    {submitting ? "Отправка..." : "Отправить на согласование"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Approval Queue Table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
          <div
            className="hidden gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 md:grid"
            style={{ gridTemplateColumns: gridTemplateClass }}
          >
            {columns.code && <span>Код техники</span>}
            {columns.title && <span>Тема и обоснование</span>}
            {columns.requestedBy && <span>Инициатор</span>}
            {columns.submittedAt && <span>Дата подачи</span>}
            {columns.status && <span>Статус</span>}
            {columns.actions && <span className="text-right">Решение</span>}
          </div>

          {filteredApprovals.length === 0 ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400 space-y-2">
              <p>Заявки на согласование по заданным критериям не найдены.</p>
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
            filteredApprovals.map((item) => (
              <div
                key={item.id}
                className="grid gap-2 border-b border-slate-100 px-5 py-3.5 last:border-0 hover:bg-slate-50/50 md:items-center md:gap-4 transition text-xs"
                style={{ gridTemplateColumns: gridTemplateClass }}
              >
                {columns.code && (
                  <div>
                    <Link
                      href={`/modules/eps/${item.targetCode}`}
                      className="text-[11px] font-bold text-[#3473d4] hover:underline font-mono"
                    >
                      {item.targetCode}
                    </Link>
                  </div>
                )}

                {columns.title && (
                  <div>
                    <span className="block font-semibold text-[#17243a] text-[12px]">{item.title}</span>
                    {item.comments && (
                      <span className="block text-[10px] text-slate-400 mt-0.5 line-clamp-1">{item.comments}</span>
                    )}
                  </div>
                )}

                {columns.requestedBy && (
                  <div className="text-[10px] text-slate-600 flex items-center gap-1.5">
                    <User size={12} className="text-slate-400" />
                    <span className="font-semibold">{item.requestedBy}</span>
                  </div>
                )}

                {columns.submittedAt && (
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                    <Calendar size={12} className="text-slate-400" />
                    {new Date(item.submittedAt).toLocaleDateString("ru-RU")}
                  </div>
                )}

                {columns.status && (
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-bold border ${
                        item.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : item.status === "REJECTED"
                          ? "bg-rose-50 text-rose-600 border-rose-100"
                          : "bg-amber-50 text-amber-600 border-amber-100"
                      }`}
                    >
                      {item.status === "APPROVED" ? (
                        <>
                          <CheckCircle2 size={10} /> Утверждено
                        </>
                      ) : item.status === "REJECTED" ? (
                        <>
                          <AlertCircle size={10} /> Отклонено
                        </>
                      ) : (
                        <>
                          <Clock size={10} className="animate-spin" /> На рассмотрении
                        </>
                      )}
                    </span>
                  </div>
                )}

                {columns.actions && (
                  <div className="flex items-center justify-end gap-1.5">
                    {item.status === "PENDING" ? (
                      <>
                        <button
                          onClick={() => handleAction(item.id, "APPROVED")}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 text-[10px] font-bold text-emerald-600 hover:bg-emerald-100 shadow-2xs"
                        >
                          <CheckCircle size={12} /> Утвердить
                        </button>
                        <button
                          onClick={() => handleAction(item.id, "REJECTED")}
                          className="flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200/80 px-2.5 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-100 shadow-2xs"
                        >
                          <XCircle size={12} /> Отклонить
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400 font-mono">
                        {item.status}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </main>
    </ShellLayout>
  );
}
