"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { MOCK_WMS_MOVEMENTS, MOCK_WMS_ITEMS, WmsMovement, WmsItem, WmsTransferRequest } from "@/lib/modules/wms-store";
import { useShell } from "@/components/layout/shell-context";
import {
  History,
  Search,
  Plus,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCcw,
  Download,
  RefreshCw,
  UserCheck,
  X,
  SlidersHorizontal,
  RotateCcw,
  CheckCircle2,
  Clock,
  Check,
  Eye,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import WmsOperationModal from "@/components/wms/wms-operation-modal";
import WmsTransferRequestModal from "@/components/wms/wms-transfer-request-modal";
import { useItemSelection } from "@/lib/hooks/use-item-selection";

function WmsMovementsContent() {
  const { currentUser, refreshPendingWmsTransfers } = useShell();

  const [movements, setMovements] = useState<WmsMovement[]>(MOCK_WMS_MOVEMENTS);
  const [items, setItems] = useState<WmsItem[]>(MOCK_WMS_ITEMS);
  const [transferRequests, setTransferRequests] = useState<WmsTransferRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"JOURNAL" | "REQUESTS">("JOURNAL");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [datePreset, setDatePreset] = useState<"ALL" | "TODAY" | "WEEK" | "MONTH">("ALL");

  // Modals state
  const [showOpModal, setShowOpModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [opModalDefaultType, setOpModalDefaultType] = useState<WmsMovement["type"]>("INCOMING");
  const [selectedMovementDetails, setSelectedMovementDetails] = useState<WmsMovement | null>(null);

  const {
    selectedIds: selectedItemIds,
    toggleSelectAll,
    toggleSelectItem,
  } = useItemSelection(items);

  // Transfer requests filters
  const [requestQuery, setRequestQuery] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>("ALL");

  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchItemsAndMovements = useCallback(async () => {
    setLoading(true);
    try {
      const [resItems, resMovements, resRequests] = await Promise.all([
        fetch("/api/modules/wms/items"),
        fetch(`/api/modules/wms/movements?query=${encodeURIComponent(query)}&type=${typeFilter}`),
        fetch("/api/modules/wms/transfer-requests")
      ]);
      if (resItems.ok) {
        const dataItems = await resItems.json();
        if (dataItems.items) setItems(dataItems.items);
      }
      if (resMovements.ok) {
        const dataMov = await resMovements.json();
        if (dataMov.movements) setMovements(dataMov.movements);
      }
      if (resRequests.ok) {
        const dataReq = await resRequests.json();
        if (dataReq.requests) setTransferRequests(dataReq.requests);
      }
    } catch {
      // Fallback to mock
    } finally {
      setLoading(false);
    }
  }, [query, typeFilter]);

  useEffect(() => {
    fetchItemsAndMovements();
  }, [fetchItemsAndMovements]);

  // Date filtering logic
  const filteredMovements = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return movements.filter((m) => {
      // Type Filter
      if (typeFilter !== "ALL" && m.type !== typeFilter) return false;

      // Date Filter
      if (datePreset !== "ALL") {
        const mDate = new Date(m.timestamp);
        if (datePreset === "TODAY" && mDate < startOfToday) return false;
        if (datePreset === "WEEK" && mDate < sevenDaysAgo) return false;
        if (datePreset === "MONTH" && mDate < thirtyDaysAgo) return false;
      }

      // Search Query
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          m.itemName.toLowerCase().includes(q) ||
          m.itemSku.toLowerCase().includes(q) ||
          m.performedBy.toLowerCase().includes(q) ||
          (m.recipientUser && m.recipientUser.toLowerCase().includes(q)) ||
          (m.reason && m.reason.toLowerCase().includes(q)) ||
          (m.relatedOrderOrEq && m.relatedOrderOrEq.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [movements, query, typeFilter, datePreset]);

  // Filtered Transfer Requests
  const filteredTransferRequests = useMemo(() => {
    return transferRequests.filter((req) => {
      if (requestStatusFilter !== "ALL" && req.status !== requestStatusFilter) return false;
      if (requestQuery.trim()) {
        const q = requestQuery.toLowerCase();
        return (
          req.itemName.toLowerCase().includes(q) ||
          req.itemSku.toLowerCase().includes(q) ||
          req.requestedBy.toLowerCase().includes(q) ||
          req.targetMolUser.toLowerCase().includes(q) ||
          (req.reason && req.reason.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [transferRequests, requestQuery, requestStatusFilter]);

  // KPI Statistics matching EPS 4-card grid standard
  const kpiStats = useMemo(() => {
    const totalOps = movements.length;

    const incoming = movements.filter((m) => m.type === "INCOMING");
    const incomingQty = incoming.reduce((sum, m) => sum + m.quantity, 0);

    const outgoing = movements.filter((m) => m.type === "OUTGOING" || m.type === "PERSONAL_CARD");
    const outgoingQty = outgoing.reduce((sum, m) => sum + m.quantity, 0);

    const pendingRequestsCount = transferRequests.filter((r) => r.status === "PENDING").length;

    return {
      totalOps,
      incomingOpsCount: incoming.length,
      incomingQty,
      outgoingOpsCount: outgoing.length,
      outgoingQty,
      pendingRequestsCount
    };
  }, [movements, transferRequests]);

  const getTypeBadge = (type: WmsMovement["type"]) => {
    switch (type) {
      case "INCOMING":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Приход / Поступление
          </span>
        );
      case "OUTGOING":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Расход / Списание
          </span>
        );
      case "TRANSFER":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-[#3473d4]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3473d4]" /> Перемещение
          </span>
        );
      case "PERSONAL_CARD":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2 py-0.5 text-[9px] font-semibold text-purple-700">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" /> Выдача на карточку
          </span>
        );
      case "RESERVE":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-semibold text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> Резерв
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-700">
            {type}
          </span>
        );
    }
  };

  const handleApproveRequest = async (requestId: string, action: "APPROVE" | "REJECT") => {
    setProcessingId(requestId);
    try {
      const res = await fetch(`/api/modules/wms/transfer-requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          approvedBy: currentUser?.displayName || "Кладовщик МОЛ",
        }),
      });

      if (res.ok) {
        fetchItemsAndMovements();
        refreshPendingWmsTransfers();
      }
    } catch {
      // Ignore error
    } finally {
      setProcessingId(null);
    }
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!filteredMovements.length) return;

    const headers = ["Дата и Время", "Тип Операции", "Артикул", "Наименование ТМЦ", "Количество", "Откуда", "Куда", "Ответственный МОЛ", "Получатель", "Основание / Заказ"];

    const csvRows = filteredMovements.map((m) => {
      const dateStr = new Date(m.timestamp).toLocaleString("ru-RU").replace(",", "");
      const typeStr =
        m.type === "INCOMING"
          ? "Приход"
          : m.type === "OUTGOING"
          ? "Списание"
          : m.type === "TRANSFER"
          ? "Перемещение"
          : m.type === "PERSONAL_CARD"
          ? "Выдача на карточку"
          : m.type;

      const qtyStr = m.type === "OUTGOING" || m.type === "PERSONAL_CARD" ? `-${m.quantity}` : `+${m.quantity}`;

      return [
        `"${dateStr}"`,
        `"${typeStr}"`,
        `"${m.itemSku}"`,
        `"${m.itemName.replace(/"/g, '""')}"`,
        `"${qtyStr}"`,
        `"${(m.fromLocation || "—").replace(/"/g, '""')}"`,
        `"${(m.toLocation || "—").replace(/"/g, '""')}"`,
        `"${(m.performedBy || "").replace(/"/g, '""')}"`,
        `"${(m.recipientUser || "—").replace(/"/g, '""')}"`,
        `"${(m.reason || "").replace(/"/g, '""')} ${m.relatedOrderOrEq ? "[" + m.relatedOrderOrEq + "]" : ""}"`
      ].join(";");
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `wms_movements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="w-full px-5 py-6 md:px-8 space-y-6">
      {/* Breadcrumbs & Title Block aligned exactly with EPS Standard */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
            <Link href="/" className="hover:text-slate-600">Главная</Link>
            <ChevronRight size={12} />
            <Link href="/modules/wms" className="hover:text-slate-600">WMS Складской учёт</Link>
            <ChevronRight size={12} />
            <span className="text-[#3473d4]">Движения ТМЦ</span>
          </div>
          <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
            Проведение операций и Журнал движений ТМЦ
          </h1>
          <p className="mt-1 text-[12px] text-slate-500">
            Выполнение складских операций прихода, списания, выдачи на личные карточки и согласование межскладских перемещений (всего {filteredMovements.length} из {movements.length} операций).
          </p>
        </div>

        {/* Action Button Group matching EPS Standard */}
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            disabled={filteredMovements.length === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={13} /> Экспорт CSV
          </button>
          <button
            onClick={fetchItemsAndMovements}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            title="Обновить данные"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
          </button>
          <button
            onClick={() => {
              setOpModalDefaultType("INCOMING");
              setShowOpModal(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
          >
            <Plus size={14} /> Выполнить операцию
          </button>
        </div>
      </div>

      {/* Quick KPI Summary Cards matching EPS 4-card standard */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
              Всего операций
            </span>
            <div className="rounded-md bg-blue-50 p-1.5 text-[#3473d4]">
              <Layers size={14} />
            </div>
          </div>
          <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
            {kpiStats.totalOps}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">в журнале движений</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
              Приход (Поставки)
            </span>
            <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-600">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
            +{kpiStats.incomingQty} <span className="text-xs font-normal text-slate-500">ед.</span>
          </div>
          <div className="mt-1 text-[10px] text-emerald-600 font-semibold">{kpiStats.incomingOpsCount} операций прихода</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
              Списание & Выдача
            </span>
            <div className="rounded-md bg-amber-50 p-1.5 text-amber-600">
              <AlertCircle size={14} />
            </div>
          </div>
          <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
            -{kpiStats.outgoingQty} <span className="text-xs font-normal text-slate-500">ед.</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400">{kpiStats.outgoingOpsCount} операций расхода</div>
        </div>

        <button
          onClick={() => setActiveTab("REQUESTS")}
          className="text-left rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)] hover:border-slate-300 transition cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
              На согласовании
            </span>
            <div className="rounded-md bg-purple-50 p-1.5 text-purple-600">
              <Clock size={14} />
            </div>
          </div>
          <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a] flex items-center gap-2">
            {kpiStats.pendingRequestsCount}
            {kpiStats.pendingRequestsCount > 0 && (
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">Запросы перемещения →</div>
        </button>
      </div>

      {/* Navigation Tabs matching EPS style */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("JOURNAL")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition cursor-pointer ${
            activeTab === "JOURNAL"
              ? "border-[#3473d4] text-[#3473d4]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <History size={15} /> Журнал операций ({movements.length})
        </button>
        <button
          onClick={() => setActiveTab("REQUESTS")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition cursor-pointer ${
            activeTab === "REQUESTS"
              ? "border-[#3473d4] text-[#3473d4]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <RefreshCcw size={15} /> Запросы на перемещение ТМЦ
          {kpiStats.pendingRequestsCount > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs animate-pulse">
              {kpiStats.pendingRequestsCount} на согласование
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Journal of Movements */}
      {activeTab === "JOURNAL" && (
        <div className="space-y-4">
          {/* Enhanced Filter Toolbar matching EPS standard */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
              {/* Search Input */}
              <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
                <div className="relative w-full">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Поиск по ТМЦ, артикулу, сотруднику, заказ-наряду…"
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

                {/* Operation Type Dropdown */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className={`h-8 rounded-lg border px-2.5 text-[10px] outline-none transition ${
                    typeFilter !== "ALL"
                      ? "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold"
                      : "border-slate-200 bg-[#f8fafc] text-slate-600 focus:border-[#3c82ed]"
                  }`}
                >
                  <option value="ALL">Все типы операций</option>
                  <option value="INCOMING">Приход / Поступление</option>
                  <option value="OUTGOING">Расход / Списание</option>
                  <option value="TRANSFER">Перемещение</option>
                  <option value="PERSONAL_CARD">Выдача на личную карточку</option>
                </select>

                {/* Date Preset Selector */}
                <select
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value as any)}
                  className={`h-8 rounded-lg border px-2.5 text-[10px] outline-none transition ${
                    datePreset !== "ALL"
                      ? "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold"
                      : "border-slate-200 bg-[#f8fafc] text-slate-600 focus:border-[#3c82ed]"
                  }`}
                >
                  <option value="ALL">Все время</option>
                  <option value="TODAY">Сегодня</option>
                  <option value="WEEK">За 7 дней</option>
                  <option value="MONTH">За 30 дней</option>
                </select>
              </div>
            </div>

            {/* Active Filter Chips */}
            {(query || typeFilter !== "ALL" || datePreset !== "ALL") && (
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

                {typeFilter !== "ALL" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100">
                    Операция: {typeFilter}
                    <button onClick={() => setTypeFilter("ALL")} className="hover:text-blue-800">
                      <X size={11} />
                    </button>
                  </span>
                )}

                {datePreset !== "ALL" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100">
                    Период: {datePreset === "TODAY" ? "Сегодня" : datePreset === "WEEK" ? "За 7 дней" : "За 30 дней"}
                    <button onClick={() => setDatePreset("ALL")} className="hover:text-blue-800">
                      <X size={11} />
                    </button>
                  </span>
                )}

                <button
                  onClick={() => {
                    setQuery("");
                    setTypeFilter("ALL");
                    setDatePreset("ALL");
                  }}
                  className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700 ml-1 cursor-pointer"
                >
                  <RotateCcw size={10} /> Сбросить все
                </button>
              </div>
            )}
          </div>
      {/* Movements Table matching EPS standard */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedItemIds.length === items.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-400 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3">Дата & Время</th>
                <th className="px-5 py-3">Тип операции</th>
                <th className="px-5 py-3">Артикул / Наименование ТМЦ</th>
                <th className="px-5 py-3 text-right">Кол-во</th>
                <th className="px-5 py-3">Откуда → Куда</th>
                <th className="px-5 py-3">Ответственный МОЛ</th>
                <th className="px-5 py-3">Основание / Объект</th>
                <th className="px-5 py-3 text-center">Инфо</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <History size={32} className="text-slate-300" />
                      <p className="text-sm font-medium text-slate-500">Операций движения не найдено</p>
                      <p className="text-xs text-slate-400">Попробуйте изменить параметры поиска или сбросить фильтры.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const isIncoming = m.type === "INCOMING";
                  const isOutgoing = m.type === "OUTGOING" || m.type === "PERSONAL_CARD";
                  const isRowSelected = selectedItemIds.includes(m.itemId);

                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedMovementDetails(m)}
                      className={`hover:bg-slate-50/50 transition-colors cursor-pointer group ${
                        isRowSelected ? "bg-blue-50/40" : ""
                      }`}
                    >
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => toggleSelectItem(m.itemId)}
                          className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-400 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(m.timestamp).toLocaleString("ru-RU")}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">{getTypeBadge(m.type)}</td>
                      <td className="px-5 py-3.5 font-medium text-[#17243a]">
                        <div className="font-mono text-[11px] font-bold text-[#3473d4] group-hover:underline">
                          {m.itemSku}
                        </div>
                        <div className="text-[11px] text-[#17243a] font-semibold line-clamp-1">
                          {m.itemName}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold whitespace-nowrap">
                        <span
                          className={`text-[12px] font-mono ${
                            isIncoming
                              ? "text-emerald-600"
                              : isOutgoing
                              ? "text-amber-600"
                              : "text-[#17243a]"
                          }`}
                        >
                          {isIncoming ? "+" : isOutgoing ? "-" : ""}
                          {m.quantity} ед.
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-500">{m.fromLocation || "—"}</span>
                          <ArrowRight size={11} className="text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-800">{m.toLocation || "—"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 font-medium whitespace-nowrap">
                        {m.performedBy}
                        {m.recipientUser && (
                          <div className="text-[10px] text-purple-700 font-normal">
                            Получатель: <span className="font-semibold">{m.recipientUser}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                        <div>{m.reason}</div>
                        {m.relatedOrderOrEq && (
                          <span className="inline-block font-mono text-[#3473d4] font-semibold text-[10px] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 mt-0.5">
                            {m.relatedOrderOrEq}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMovementDetails(m);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-[#3473d4] hover:bg-slate-100 transition"
                          title="Просмотр деталей"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

      {/* Tab 2: Inter-warehouse Transfer Requests */}
      {activeTab === "REQUESTS" && (
        <div className="space-y-4">
          {/* Requests Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
              <div className="relative w-full">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Поиск по запросам, ТМЦ, заявителю или МОЛ…"
                  value={requestQuery}
                  onChange={(e) => setRequestQuery(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-[#f8fafc] pl-9 pr-8 text-[11px] outline-none placeholder:text-slate-400 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                />
                {requestQuery && (
                  <button onClick={() => setRequestQuery("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <select
                value={requestStatusFilter}
                onChange={(e) => setRequestStatusFilter(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-[#f8fafc] px-2.5 text-[10px] outline-none text-slate-600 focus:border-[#3c82ed]"
              >
                <option value="ALL">Все статусы</option>
                <option value="PENDING">Ожидает согласования</option>
                <option value="APPROVED">Согласовано</option>
                <option value="REJECTED">Отклонено</option>
              </select>

              <button
                onClick={() => setShowTransferModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
              >
                <Plus size={14} /> Новый запрос
              </button>
            </div>
          </div>

          {/* Requests Table matching EPS standard */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Дата запроса</th>
                    <th className="px-5 py-3">Статус</th>
                    <th className="px-5 py-3">Артикул / ТМЦ</th>
                    <th className="px-5 py-3 text-right">Кол-во</th>
                    <th className="px-5 py-3">Маршрут перемещения</th>
                    <th className="px-5 py-3">Запросил</th>
                    <th className="px-5 py-3">Адресат (МОЛ склада)</th>
                    <th className="px-5 py-3 text-right">Согласование</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransferRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCcw size={32} className="text-slate-300" />
                          <p className="text-sm font-medium text-slate-500">Запросов на перемещение не найдено</p>
                          <p className="text-xs text-slate-400">Создайте новый запрос на межскладское перемещение ТМЦ.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTransferRequests.map((req) => {
                      const isPending = req.status === "PENDING";
                      const isApproved = req.status === "APPROVED";
                      const isRejected = req.status === "REJECTED";

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(req.createdAt).toLocaleString("ru-RU")}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {isPending && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Ожидает согласования
                              </span>
                            )}
                            {isApproved && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Согласовано
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-semibold text-rose-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Отклонено
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-medium text-[#17243a]">
                            <div className="font-mono text-[11px] font-bold text-[#3473d4]">{req.itemSku}</div>
                            <div className="text-[11px] text-[#17243a] font-semibold">{req.itemName}</div>
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-[#17243a] whitespace-nowrap">
                            {req.quantity} ед.
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-amber-800 font-semibold">{req.fromWarehouse}</span>
                              <ArrowRight size={11} className="text-slate-400 shrink-0" />
                              <span className="text-emerald-800 font-semibold">{req.toWarehouse}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-slate-700 font-medium">
                            {req.requestedBy}
                          </td>
                          <td className="px-5 py-3.5 text-slate-700 font-medium">
                            {req.targetMolUser}
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleApproveRequest(req.id, "APPROVE")}
                                  disabled={processingId === req.id}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
                                >
                                  <Check size={12} /> Согласовать
                                </button>
                                <button
                                  onClick={() => handleApproveRequest(req.id, "REJECT")}
                                  disabled={processingId === req.id}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
                                >
                                  <X size={12} /> Отклонить
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">{req.comment || "Завершено"}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Movement Details Modal Dialog */}
      {/* Ultra Detailed Movement & Item Card Modal Dialog */}
      {selectedMovementDetails && (() => {
        const itemObj = items.find((i) => i.id === selectedMovementDetails.itemId || i.sku === selectedMovementDetails.itemSku);
        const unitPrice = itemObj?.unitPrice || 1500;
        const totalAmount = selectedMovementDetails.quantity * unitPrice;
        const isIncoming = selectedMovementDetails.type === "INCOMING";
        const isOutgoing = selectedMovementDetails.type === "OUTGOING" || selectedMovementDetails.type === "PERSONAL_CARD";

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 max-h-[92vh] flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <span>ТРАНЗАКЦИЯ #{selectedMovementDetails.id}</span>
                    <span>•</span>
                    <span>{new Date(selectedMovementDetails.timestamp).toLocaleString("ru-RU")}</span>
                  </div>
                  <h3 className="text-lg font-bold text-[#17243a] mt-1 flex items-center gap-2">
                    Карточка операции движения ТМЦ
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedMovementDetails(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 space-y-4 pr-1 text-xs text-slate-600">
                {/* Status Bar */}
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="font-semibold text-slate-500">Тип проводимой операции:</span>
                  <div>{getTypeBadge(selectedMovementDetails.type)}</div>
                </div>

                {/* Primary Nomenclature Card */}
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#3473d4]">
                      {selectedMovementDetails.itemSku}
                    </span>
                    {itemObj?.category && (
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-[#3473d4]">
                        {itemObj.category}
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-[#17243a] text-base leading-tight">
                    {selectedMovementDetails.itemName}
                  </div>
                  {itemObj?.description && (
                    <p className="text-[11px] text-slate-500 italic">{itemObj.description}</p>
                  )}
                </div>

                {/* Quick Financial & Volume Stats Grid */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="text-[10px] font-semibold uppercase text-slate-400">Объем операции</div>
                    <div className={`mt-1 font-mono text-base font-bold ${isIncoming ? "text-emerald-600" : isOutgoing ? "text-amber-600" : "text-[#17243a]"}`}>
                      {isIncoming ? "+" : isOutgoing ? "-" : ""}{selectedMovementDetails.quantity} {itemObj?.unit || "ед."}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="text-[10px] font-semibold uppercase text-slate-400">Цена за единицу</div>
                    <div className="mt-1 font-mono text-base font-bold text-slate-800">
                      {unitPrice.toLocaleString("ru-RU")} ₽
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="text-[10px] font-semibold uppercase text-slate-400">Сумма операции</div>
                    <div className="mt-1 font-mono text-base font-bold text-[#3473d4]">
                      {totalAmount.toLocaleString("ru-RU")} ₽
                    </div>
                  </div>
                </div>

                {/* Route Section */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Склад-отправитель (Откуда)</div>
                    <div className="font-bold text-slate-800 mt-1">
                      {selectedMovementDetails.fromLocation || "Внешний поставщик / Покупка"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Склад-получатель (Куда)</div>
                    <div className="font-bold text-slate-800 mt-1">
                      {selectedMovementDetails.toLocation || "Списание / Выдача"}
                    </div>
                  </div>
                </div>

                {/* Audit & Accounting Info Table */}
                <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5 bg-white">
                  <div className="font-bold text-[#17243a] text-xs border-b border-slate-100 pb-2">
                    Учётные данные и Основание проведения
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500 font-medium">Ответственный МОЛ склада:</span>
                      <span className="font-semibold text-slate-800">{selectedMovementDetails.performedBy}</span>
                    </div>
                    {selectedMovementDetails.recipientUser && (
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500 font-medium">Получатель (Сотрудник / Карточка):</span>
                        <span className="font-semibold text-purple-700">{selectedMovementDetails.recipientUser}</span>
                      </div>
                    )}
                    {selectedMovementDetails.reason && (
                      <div className="flex items-start justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500 font-medium shrink-0">Основание / Причина / Документ:</span>
                        <span className="font-semibold text-slate-800 text-right ml-4">
                          {selectedMovementDetails.reason}
                        </span>
                      </div>
                    )}
                    {selectedMovementDetails.relatedOrderOrEq && (
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500 font-medium">Связанный заказ / Оборудование EPS:</span>
                        <span className="font-mono font-bold text-[#3473d4]">
                          {selectedMovementDetails.relatedOrderOrEq}
                        </span>
                      </div>
                    )}
                    {itemObj && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-500 font-medium">Текущий остаток на складе WMS:</span>
                        <span className="font-bold text-slate-900">
                          {itemObj.quantity} {itemObj.unit} (мин: {itemObj.minQuantity})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <Link
                  href={`/modules/wms?query=${encodeURIComponent(selectedMovementDetails.itemSku)}`}
                  className="text-xs font-semibold text-[#3473d4] hover:underline"
                >
                  Перейти в карточку ТМЦ в реестре →
                </Link>
                <button
                  onClick={() => setSelectedMovementDetails(null)}
                  className="rounded-lg bg-[#17243a] px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <WmsOperationModal
        isOpen={showOpModal}
        defaultType={opModalDefaultType}
        onClose={() => setShowOpModal(false)}
        items={items}
        onSubmitSuccess={(newMov, updatedItems, newItem) => {
          setMovements((prev) => [newMov, ...prev]);
          if (newItem) {
            setItems((prev) => [newItem, ...prev]);
          }
          if (updatedItems && updatedItems.length > 0) {
            setItems((prev) =>
              prev.map((i) => {
                const match = updatedItems.find((u) => u.id === i.id);
                return match ? { ...i, ...match } : i;
              })
            );
          }
        }}
      />

      {/* Transfer Request Creation Modal */}
      <WmsTransferRequestModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        selectedItems={items.slice(0, 1)}
        onSubmitSuccess={fetchItemsAndMovements}
      />
    </main>
  );
}

export default function WmsMovementsPage() {
  return (
    <ShellLayout>
      <WmsMovementsContent />
    </ShellLayout>
  );
}
