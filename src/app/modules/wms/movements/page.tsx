"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { MOCK_WMS_MOVEMENTS, MOCK_WMS_ITEMS, WmsMovement, WmsItem, WmsTransferRequest } from "@/lib/modules/wms-store";
import { useShell } from "@/components/layout/shell-context";
import {
  History,
  Search,
  Plus,
  Filter,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCcw,
  Archive,
  Download,
  Calendar,
  UserCheck,
  X,
  SlidersHorizontal,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Check,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import WmsOperationModal from "@/components/wms/wms-operation-modal";
import WmsSubNav from "@/components/wms/wms-sub-nav";

function WmsMovementsContent() {
  const { currentUser } = useShell();

  const [movements, setMovements] = useState<WmsMovement[]>(MOCK_WMS_MOVEMENTS);
  const [items, setItems] = useState<WmsItem[]>(MOCK_WMS_ITEMS);
  const [transferRequests, setTransferRequests] = useState<WmsTransferRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"JOURNAL" | "REQUESTS">("JOURNAL");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [showOpModal, setShowOpModal] = useState(false);
  const [opModalDefaultType, setOpModalDefaultType] = useState<WmsMovement["type"]>("INCOMING");
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

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (typeFilter !== "ALL" && m.type !== typeFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          m.itemName.toLowerCase().includes(q) ||
          m.itemSku.toLowerCase().includes(q) ||
          m.performedBy.toLowerCase().includes(q) ||
          (m.reason && m.reason.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [movements, query, typeFilter]);

  const getTypeBadge = (type: WmsMovement["type"]) => {
    switch (type) {
      case "INCOMING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-100">
            <ArrowDownLeft size={10} /> Приход / Поступление
          </span>
        );
      case "OUTGOING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-100">
            <ArrowUpRight size={10} /> Расход / Списание
          </span>
        );
      case "TRANSFER":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100">
            <RefreshCcw size={10} /> Перемещение
          </span>
        );
      case "PERSONAL_CARD":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-100">
            <UserCheck size={10} /> Личная карточка
          </span>
        );
      default:
        return null;
    }
  };

  const openOperationWithType = (type: WmsMovement["type"]) => {
    setOpModalDefaultType(type);
    setShowOpModal(true);
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
      }
    } catch {
      // Игнорируем
    } finally {
      setProcessingId(null);
    }
  };

  const pendingRequestsCount = useMemo(() => {
    return transferRequests.filter((r) => r.status === "PENDING").length;
  }, [transferRequests]);

  return (
    <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Breadcrumbs & Title Block aligned with EPS Standard */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
              <Link href="/" className="hover:text-slate-600">Главная</Link>
              <ChevronRight size={12} />
              <Link href="/modules/wms" className="hover:text-slate-600">WMS Складской учёт</Link>
              <ChevronRight size={12} />
              <span className="text-[#3473d4] font-semibold">Движения ТМЦ</span>
            </div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Проведение операций и Журнал движений ТМЦ
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Выполнение складских операций прихода, списания, выдачи на личные карточки и согласование межскладских перемещений.
            </p>
          </div>

          {/* All Warehouse Operations Buttons aggregated here */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openOperationWithType("INCOMING")}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
            >
              <ArrowDownLeft size={13} /> Оформить приход
            </button>
            <button
              onClick={() => openOperationWithType("OUTGOING")}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-[11px] font-semibold text-white shadow-xs hover:bg-amber-700 transition cursor-pointer"
            >
              <ArrowUpRight size={13} /> Оформить списание
            </button>
            <button
              onClick={() => openOperationWithType("TRANSFER")}
              className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-3 py-2 text-[11px] font-semibold text-white shadow-xs hover:bg-[#2565c8] transition cursor-pointer"
            >
              <RefreshCcw size={13} /> Прямое перемещение
            </button>
            <button
              onClick={() => openOperationWithType("PERSONAL_CARD")}
              className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-[11px] font-semibold text-white shadow-xs hover:bg-purple-700 transition cursor-pointer"
            >
              <UserCheck size={13} /> Выдача на карточку
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
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
            {pendingRequestsCount > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs animate-pulse">
                {pendingRequestsCount} на согласование
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Journal of Movements */}
        {activeTab === "JOURNAL" && (
          <>
            {/* Filter Toolbar aligned with EPS Standard */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
                {/* Search Input */}
                <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
                  <div className="relative w-full">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Поиск по ТМЦ, артикулу, сотруднику, причине..."
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
                </div>
              </div>

              {/* Active Filter Chips */}
              {(query || typeFilter !== "ALL") && (
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

                  <button
                    onClick={() => {
                      setQuery("");
                      setTypeFilter("ALL");
                    }}
                    className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700 ml-1"
                  >
                    <RotateCcw size={10} /> Сбросить все
                  </button>
                </div>
              )}
            </div>

            {/* Movements Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Дата & Время</th>
                    <th className="px-5 py-3">Тип операции</th>
                    <th className="px-5 py-3">Артикул / Наименование ТМЦ</th>
                    <th className="px-5 py-3 text-right">Кол-во</th>
                    <th className="px-5 py-3">Откуда → Куда</th>
                    <th className="px-5 py-3">Ответственный</th>
                    <th className="px-5 py-3">Основание / Объект</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                        Операций движения за выбранный период не найдено.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(m.timestamp).toLocaleString("ru-RU")}
                        </td>
                        <td className="px-5 py-3.5">{getTypeBadge(m.type)}</td>
                        <td className="px-5 py-3.5 font-medium text-[#17243a]">
                          <div className="font-mono text-[11px] font-bold text-[#3473d4]">{m.itemSku}</div>
                          <div className="text-[11px] text-[#17243a] font-semibold">{m.itemName}</div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-[#17243a] whitespace-nowrap">
                          {m.type === "OUTGOING" ? "-" : "+"}{m.quantity} ед.
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                          {m.fromLocation || "—"} → <span className="font-semibold text-slate-700">{m.toLocation || "—"}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 font-medium">{m.performedBy}</td>
                        <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                          {m.reason}
                          {m.relatedOrderOrEq && (
                            <span className="block font-mono text-[#3473d4] font-semibold">{m.relatedOrderOrEq}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Tab 2: Inter-warehouse Transfer Requests */}
        {activeTab === "REQUESTS" && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
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
                  {transferRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                        Запросов на перемещение ТМЦ между складами пока не создано.
                      </td>
                    </tr>
                  ) : (
                    transferRequests.map((req) => {
                      const isPending = req.status === "PENDING";
                      const isApproved = req.status === "APPROVED";
                      const isRejected = req.status === "REJECTED";

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(req.createdAt).toLocaleString("ru-RU")}
                          </td>
                          <td className="px-5 py-3.5">
                            {isPending && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                                <Clock size={11} /> Ожидает согласования
                              </span>
                            )}
                            {isApproved && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={11} /> Согласовано
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200">
                                <XCircle size={11} /> Отклонено
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-medium text-[#17243a]">
                            <div className="font-mono text-[11px] font-bold text-[#3473d4]">{req.itemSku}</div>
                            <div className="text-[11px] text-[#17243a] font-semibold">{req.itemName}</div>
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-[#17243a]">
                            {req.quantity} ед.
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                            <span className="text-amber-700 font-semibold">{req.fromWarehouse}</span>
                            <span className="mx-1">→</span>
                            <span className="text-emerald-700 font-semibold">{req.toWarehouse}</span>
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
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700 shadow-xs transition cursor-pointer"
                                >
                                  <Check size={12} /> Согласовать
                                </button>
                                <button
                                  onClick={() => handleApproveRequest(req.id, "REJECT")}
                                  disabled={processingId === req.id}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
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
        )}

        {/* Modal Operation WMS */}
        <WmsOperationModal
          isOpen={showOpModal}
          onClose={() => setShowOpModal(false)}
          items={items}
          onSubmitSuccess={(newMov, updatedItems) => {
            setMovements((prev) => [newMov, ...prev]);
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
