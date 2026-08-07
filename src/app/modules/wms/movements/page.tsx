"use client";

import { useState, useMemo, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { WmsMovement, WmsItem, WmsTransferRequest } from "@/lib/modules/wms-store";
import { useShell } from "@/components/layout/shell-context";
import {
  History,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCcw,
  Download,
  RefreshCw,
  Clock,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import WmsOperationModal from "@/components/wms/wms-operation-modal";
import WmsTransferRequestModal from "@/components/wms/wms-transfer-request-modal";
import WmsSubNav from "@/components/wms/wms-sub-nav";
import {
  PageHeader,
  KpiGrid,
  FilterToolbar,
  DataTable,
  StatusBadge,
  TabNav,
  Modal,
  ModalHeader,
  ModalFooter,
} from "@/components/ui";

function WmsMovementsContent() {
  const { currentUser, refreshPendingWmsTransfers } = useShell();

  const [movements, setMovements] = useState<WmsMovement[]>([]);
  const [items, setItems] = useState<WmsItem[]>([]);
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

  // Transfer requests filters
  const [requestQuery, setRequestQuery] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>("ALL");

  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;
    Promise.all([
      fetch("/api/modules/wms/items"),
      fetch(`/api/modules/wms/movements?query=${encodeURIComponent(query)}&type=${typeFilter}`),
      fetch("/api/modules/wms/transfer-requests")
    ])
      .then(async ([resItems, resMovements, resRequests]) => {
        if (!isSubscribed) return;
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
      })
      .catch(() => {})
      .finally(() => {
        if (isSubscribed) setLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [query, typeFilter]);

  const fetchItemsAndMovements = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/modules/wms/items"),
      fetch(`/api/modules/wms/movements?query=${encodeURIComponent(query)}&type=${typeFilter}`),
      fetch("/api/modules/wms/transfer-requests")
    ])
      .then(async ([resItems, resMovements, resRequests]) => {
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
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // Date filtering logic
  const filteredMovements = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return movements.filter((m) => {
      if (typeFilter !== "ALL" && m.type !== typeFilter) return false;
      if (datePreset !== "ALL") {
        const mDate = new Date(m.timestamp);
        if (datePreset === "TODAY" && mDate < startOfToday) return false;
        if (datePreset === "WEEK" && mDate < sevenDaysAgo) return false;
        if (datePreset === "MONTH" && mDate < thirtyDaysAgo) return false;
      }
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

  const kpiStats = useMemo(() => {
    const totalOps = filteredMovements.length;
    const incomingCount = filteredMovements.filter((m) => m.type === "INCOMING").length;
    const outgoingCount = filteredMovements.filter((m) => m.type === "OUTGOING").length;
    const transferCount = filteredMovements.filter((m) => m.type === "TRANSFER").length;
    const pendingTransfers = transferRequests.filter((r) => r.status === "PENDING").length;

    return { totalOps, incomingCount, outgoingCount, transferCount, pendingTransfers };
  }, [filteredMovements, transferRequests]);

  const openBulkOperation = (type: WmsMovement["type"]) => {
    setOpModalDefaultType(type);
    setShowOpModal(true);
  };

  const handleApproveRequest = async (req: WmsTransferRequest) => {
    setProcessingId(req.id);
    try {
      const res = await fetch(`/api/modules/wms/transfer-requests/${req.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          performedBy: currentUser?.fullName || "Складской оператор",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Ошибка при согласовании запроса");
        return;
      }

      await fetchItemsAndMovements();
      await refreshPendingWmsTransfers();
    } catch {
      alert("Ошибка при вызове сервера");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectRequest = async (req: WmsTransferRequest) => {
    const reasonPrompt = prompt("Укажите причину отклонения запроса:", "Нет свободного остатка на складе");
    if (reasonPrompt === null) return;

    setProcessingId(req.id);
    try {
      const res = await fetch(`/api/modules/wms/transfer-requests/${req.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reasonPrompt,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Ошибка при отклонении запроса");
        return;
      }

      await fetchItemsAndMovements();
      await refreshPendingWmsTransfers();
    } catch {
      alert("Ошибка при вызове сервера");
    } finally {
      setProcessingId(null);
    }
  };

  const activeChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (activeTab === "JOURNAL") {
      if (query) chips.push({ id: "q", label: `Поиск: "${query}"`, onRemove: () => setQuery("") });
      if (typeFilter !== "ALL") chips.push({ id: "t", label: `Тип: ${typeFilter}`, onRemove: () => setTypeFilter("ALL") });
      if (datePreset !== "ALL") chips.push({ id: "d", label: `Период: ${datePreset}`, onRemove: () => setDatePreset("ALL") });
    } else {
      if (requestQuery) chips.push({ id: "rq", label: `Поиск: "${requestQuery}"`, onRemove: () => setRequestQuery("") });
      if (requestStatusFilter !== "ALL") chips.push({ id: "rs", label: `Статус: ${requestStatusFilter}`, onRemove: () => setRequestStatusFilter("ALL") });
    }
    return chips;
  }, [activeTab, query, typeFilter, datePreset, requestQuery, requestStatusFilter]);

  const movementColorMap = {
    INCOMING: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
    OUTGOING: { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
    TRANSFER: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-400", dot: "bg-[#3473d4]" },
    ADJUSTMENT: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  };

  const movementTypeLabels: Record<string, string> = {
    INCOMING: "Приход ТМЦ",
    OUTGOING: "Расход / Списание",
    TRANSFER: "Перемещение",
    ADJUSTMENT: "Корректировка",
  };

  const journalColumns = [
    {
      key: "timestamp",
      header: "Дата / Время",
      cell: (m: WmsMovement) => (
        <div className="font-mono">
          <span className="block text-[11px] font-bold text-slate-800 dark:text-slate-200">
            {new Date(m.timestamp).toLocaleDateString("ru-RU")}
          </span>
          <span className="block text-[9px] text-slate-400">
            {new Date(m.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Тип операции",
      cell: (m: WmsMovement) => (
        <StatusBadge status={m.type} label={movementTypeLabels[m.type]} colorMap={movementColorMap} />
      ),
    },
    {
      key: "item",
      header: "Номенклатура ТМЦ",
      cell: (m: WmsMovement) => (
        <div>
          <span className="block text-[11px] font-semibold text-[#17243a] dark:text-slate-200">{m.itemName}</span>
          <span className="block text-[10px] text-[#3473d4] font-mono">{m.itemSku}</span>
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Количество",
      cell: (m: WmsMovement) => (
        <div className="font-mono">
          <span
            className={`block text-[11px] font-bold ${
              m.type === "INCOMING"
                ? "text-emerald-600 dark:text-emerald-400"
                : m.type === "OUTGOING"
                ? "text-rose-600 dark:text-rose-400"
                : "text-blue-600 dark:text-blue-400"
            }`}
          >
            {m.type === "INCOMING" ? "+" : m.type === "OUTGOING" ? "-" : ""}
            {m.quantity} {m.unit}
          </span>
          {m.unitPrice ? (
            <span className="block text-[9px] text-slate-400">{(m.quantity * m.unitPrice).toLocaleString("ru-RU")} ₽</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "route",
      header: "Маршрут складов",
      cell: (m: WmsMovement) => (
        <div className="text-[11px]">
          {m.fromWarehouse && <span className="text-slate-500">{m.fromWarehouse} ➔ </span>}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{m.toWarehouse || m.fromWarehouse || "Основной склад"}</span>
        </div>
      ),
    },
    {
      key: "user",
      header: "Исполнитель / Получатель",
      cell: (m: WmsMovement) => (
        <div>
          <span className="block text-[11px] font-medium text-slate-700 dark:text-slate-300">{m.performedBy}</span>
          {m.recipientUser && <span className="block text-[9px] text-slate-400">Получатель: {m.recipientUser}</span>}
        </div>
      ),
    },
    {
      key: "actions",
      header: <span className="text-right block">Подробно</span>,
      cell: (m: WmsMovement) => (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setSelectedMovementDetails(m)}
            className="text-[10px] font-semibold text-[#3473d4] hover:underline"
          >
            Инфо ℹ️
          </button>
        </div>
      ),
    },
  ];

  return (
    <main className="w-full px-5 py-6 md:px-8 space-y-6">
      <PageHeader
        title="Журнал движений и операций ТМЦ"
        description="Полная история поступлений, выбытий, перемещений и запросов на передачу ТМЦ между складами предприяти."
        breadcrumbs={[
          { title: "Главная", href: "/" },
          { title: "WMS Складской учёт", href: "/modules/wms" },
          { title: "Движения ТМЦ" },
        ]}
        actions={
          <>
            <a
              href="/api/modules/wms/movements/export"
              download
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <Download size={13} /> Экспорт CSV
            </a>
            <button
              onClick={fetchItemsAndMovements}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
            </button>
            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
            >
              <RefreshCcw size={14} /> Создать запрос на перемещение
            </button>
          </>
        }
      />

      <WmsSubNav lowStockCount={0} />

      <KpiGrid
        items={[
          {
            label: "Всего операций",
            value: kpiStats.totalOps,
            icon: <Layers size={14} />,
            iconColor: "blue",
            sub: "Зафиксировано в истории",
          },
          {
            label: "Приход ТМЦ",
            value: kpiStats.incomingCount,
            icon: <ArrowDownLeft size={14} />,
            iconColor: "emerald",
            sub: "Поступления на склады",
            subColor: "emerald",
          },
          {
            label: "Расход / Списание",
            value: kpiStats.outgoingCount,
            icon: <ArrowUpRight size={14} />,
            iconColor: "rose",
            sub: "Выдача в цеха / Ремонт",
            subColor: "rose",
          },
          {
            label: "Запросы в очереди",
            value: kpiStats.pendingTransfers,
            icon: <Clock size={14} />,
            iconColor: "amber",
            sub: "Требуют согласования МОЛ",
            subColor: "amber",
          },
        ]}
      />

      {/* Tabs navigation for Journal vs Requests */}
      <TabNav
        items={[
          { id: "JOURNAL", label: "Журнал транзакций WMS", icon: <History size={14} />, badge: filteredMovements.length },
          {
            id: "REQUESTS",
            label: "Запросы на перемещение",
            icon: <FileSpreadsheet size={14} />,
            badge: kpiStats.pendingTransfers > 0 ? kpiStats.pendingTransfers : null,
            badgeColor: "bg-amber-100 text-amber-700 font-bold",
          },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as "JOURNAL" | "REQUESTS")}
      />

      {activeTab === "JOURNAL" ? (
        <>
          <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openBulkOperation("INCOMING")}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 transition"
              >
                <ArrowDownLeft size={13} /> Оформить приход
              </button>
              <button
                type="button"
                onClick={() => openBulkOperation("OUTGOING")}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700 transition"
              >
                <ArrowUpRight size={13} /> Оформить расход
              </button>
            </div>
          </div>

          <FilterToolbar
            searchQuery={query}
            onSearchChange={setQuery}
            searchPlaceholder="Поиск по ТМЦ, артикулу, МОЛ или получателю…"
            filters={[
              {
                key: "type",
                label: "Тип",
                value: typeFilter,
                onChange: setTypeFilter,
                options: [
                  { value: "ALL", label: "Все типы операций" },
                  { value: "INCOMING", label: "Приход ТМЦ" },
                  { value: "OUTGOING", label: "Расход / Списание" },
                  { value: "TRANSFER", label: "Перемещение" },
                  { value: "ADJUSTMENT", label: "Корректировка" },
                ],
              },
              {
                key: "date",
                label: "Период",
                value: datePreset,
                onChange: (v) => setDatePreset(v as "ALL" | "TODAY" | "WEEK" | "MONTH"),
                options: [
                  { value: "ALL", label: "За весь период" },
                  { value: "TODAY", label: "Сегодня" },
                  { value: "WEEK", label: "За 7 дней" },
                  { value: "MONTH", label: "За 30 дней" },
                ],
              },
            ]}
            activeChips={activeChips}
            onResetAll={() => {
              setQuery("");
              setTypeFilter("ALL");
              setDatePreset("ALL");
            }}
          />

          <DataTable
            columns={journalColumns}
            data={filteredMovements}
            keyExtractor={(m) => m.id}
            loading={loading}
            emptyText="Операции по выбранным критериям не найдены."
          />
        </>
      ) : (
        <>
          <FilterToolbar
            searchQuery={requestQuery}
            onSearchChange={setRequestQuery}
            searchPlaceholder="Поиск запроса по ТМЦ, заявителю или МОЛ…"
            filters={[
              {
                key: "status",
                label: "Статус",
                value: requestStatusFilter,
                onChange: setRequestStatusFilter,
                options: [
                  { value: "ALL", label: "Все статусы" },
                  { value: "PENDING", label: "В ожидании МОЛ" },
                  { value: "APPROVED", label: "Согласовано" },
                  { value: "REJECTED", label: "Отклонено" },
                ],
              },
            ]}
            activeChips={activeChips}
            onResetAll={() => {
              setRequestQuery("");
              setRequestStatusFilter("ALL");
            }}
          />

          <div className="space-y-3">
            {filteredTransferRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={req.status}
                      label={req.status === "PENDING" ? "Ожидает МОЛ" : req.status === "APPROVED" ? "Согласовано" : "Отклонено"}
                    />
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{req.itemName}</span>
                    <span className="text-[10px] font-mono text-[#3473d4]">{req.itemSku}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(req.createdAt).toLocaleString("ru-RU")}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="block text-[9px] text-slate-400 uppercase">Маршрут:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {req.fromWarehouse} ➔ {req.toWarehouse}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-400 uppercase">Объём:</span>
                    <span className="font-bold text-[#3473d4]">
                      {req.quantity} ед.
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-400 uppercase">Заявитель / Цель:</span>
                    <span className="text-slate-700 dark:text-slate-300">{req.requestedBy} ({req.reason || "Производственная потребность"})</span>
                  </div>
                </div>

                {req.status === "PENDING" && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={processingId === req.id}
                      onClick={() => handleRejectRequest(req)}
                      className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition disabled:opacity-50"
                    >
                      Отклонить
                    </button>
                    <button
                      type="button"
                      disabled={processingId === req.id}
                      onClick={() => handleApproveRequest(req)}
                      className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 transition shadow-2xs disabled:opacity-50"
                    >
                      {processingId === req.id ? "Обработка…" : "Согласовать перемещение"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <WmsOperationModal
        isOpen={showOpModal}
        onClose={() => setShowOpModal(false)}
        onSubmitSuccess={() => fetchItemsAndMovements()}
        selectedItems={items}
        allRegistryItems={items}
        defaultType={opModalDefaultType}
      />

      <WmsTransferRequestModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onSubmitSuccess={() => fetchItemsAndMovements()}
        selectedItems={items}
        allRegistryItems={items}
        currentUser={currentUser}
      />

      <Modal open={Boolean(selectedMovementDetails)} onClose={() => setSelectedMovementDetails(null)} size="md">
        <ModalHeader
          icon={<History size={16} />}
          title="Детализация операции WMS"
          subtitle={`ID транзакции: ${selectedMovementDetails?.id || ""}`}
          onClose={() => setSelectedMovementDetails(null)}
        />
        {selectedMovementDetails && (
          <div className="py-2 space-y-3 text-xs">
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Наименование:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedMovementDetails.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Артикул / SKU:</span>
                <span className="font-mono text-[#3473d4]">{selectedMovementDetails.itemSku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Количество:</span>
                <span className="font-bold">{selectedMovementDetails.quantity} {selectedMovementDetails.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Причина / Обоснование:</span>
                <span>{selectedMovementDetails.reason || "—"}</span>
              </div>
            </div>
          </div>
        )}
        <ModalFooter onCancel={() => setSelectedMovementDetails(null)} cancelLabel="Закрыть" />
      </Modal>
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
