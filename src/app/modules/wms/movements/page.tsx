"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  History,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  RefreshCw,
  Server,
  UserCheck,
  RotateCcw,
  CheckCircle2,
  XCircle,
  QrCode,
  FileSpreadsheet,
  ChevronDown
} from "lucide-react";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Modal,
  ModalHeader,
  TabNav
} from "@/components/ui";
import { BarcodeLabelModal } from "@/components/wms/barcode-label-modal";

interface WmsMovement {
  id: string;
  itemSku: string;
  itemName: string;
  type: "INCOMING" | "OUTGOING" | "TRANSFER" | "PERSONAL_CARD";
  quantity: number;
  fromLocation: string | null;
  toLocation: string | null;
  performedBy: string;
  reason: string | null;
  relatedOrderOrEq: string | null;
  createdAt: string;
}

interface WmsTransferRequest {
  id: string;
  itemSku: string;
  itemName: string;
  quantity: number;
  fromWarehouse: string;
  toWarehouse: string;
  requestedBy: string;
  targetMolUser: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  createdAt: string;
}

interface WmsPersonalCard {
  id: string;
  itemSku: string;
  itemName: string;
  employeeName: string;
  employeePosition: string | null;
  department: string | null;
  issuedQuantity: number;
  issuedAt: string;
  returnedAt: string | null;
  returnCondition: string | null;
  notes: string | null;
}

interface Warehouse {
  id: string;
  name: string;
  responsibleUser: string;
}

interface WmsItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  warehouse: string;
}

interface EquipmentOption {
  id: string;
  equipmentCode: string;
  name: string;
}

export default function ConsolidatedWmsOperationsPage() {
  const [activeTab, setActiveTab] = useState<string>("movements");
  const [movements, setMovements] = useState<WmsMovement[]>([]);
  const [transfers, setTransfers] = useState<WmsTransferRequest[]>([]);
  const [cards, setCards] = useState<WmsPersonalCard[]>([]);
  const [items, setItems] = useState<WmsItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [equipments, setEquipments] = useState<EquipmentOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [showMovModal, setShowMovModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<WmsPersonalCard | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Label Printing state
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printItemData, setPrintItemData] = useState<{ sku: string; name: string; location?: string; category?: string } | null>(null);

  // Forms data
  const [inboundFormData, setInboundFormData] = useState({
    name: "",
    sku: "",
    category: "Запчасти & Механика",
    type: "ZIP",
    warehouse: "",
    cell: "Яч-01",
    quantity: 10,
    minQuantity: 2,
    unit: "шт",
    unitPrice: 1500,
    batchNumber: "",
    serialNumber: ""
  });
  const [movFormData, setMovFormData] = useState({
    itemId: "",
    type: "OUTGOING",
    quantity: 1,
    reason: "Плановое обслуживание / ремонт",
    relatedOrderOrEq: "",
    performedBy: "Кладовщик",
  });

  const [transferFormData, setTransferFormData] = useState({
    itemId: "",
    quantity: 1,
    toWarehouse: "",
    reason: "Производственная необходимость",
  });

  const [cardFormData, setCardFormData] = useState({
    itemId: "",
    employeeName: "",
    employeePosition: "Инженер-механик",
    department: "Цех №1",
    quantity: 1,
    notes: "Выдача СИЗ/инструмента под расписку",
  });

  const [returnFormData, setReturnFormData] = useState({ returnCondition: "GOOD" });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/modules/wms/movements").then((res) => (res.ok ? res.json() : { movements: [] })),
      fetch("/api/modules/wms/transfers").then((res) => (res.ok ? res.json() : { requests: [] })),
      fetch("/api/modules/wms/personal-cards").then((res) => (res.ok ? res.json() : { cards: [] })),
      fetch("/api/modules/wms/items").then((res) => (res.ok ? res.json() : { items: [] })),
      fetch("/api/modules/wms/warehouses").then((res) => (res.ok ? res.json() : { warehouses: [] })),
      fetch("/api/modules/eps/equipment").then((res) => (res.ok ? res.json() : { items: [] }))
    ])
      .then(([movData, transData, cardsData, itemsData, whData, eqData]) => {
        setMovements(movData.movements || []);
        setTransfers(transData.requests || []);
        setCards(cardsData.cards || []);
        const itemList = itemsData.items || [];
        setItems(itemList);
        const whList = whData.warehouses || [];
        setWarehouses(whList);
        setEquipments(eqData.items || []);

        if (itemList.length > 0) {
          setMovFormData((prev) => ({ ...prev, itemId: itemList[0].id }));
          setCardFormData((prev) => ({ ...prev, itemId: itemList[0].id }));
          setTransferFormData((prev) => ({
            ...prev,
            itemId: itemList[0].id,
            toWarehouse: whList.find((w: Warehouse) => w.name !== itemList[0].warehouse)?.name || whList[0]?.name || ""
          }));
        }
      })
      .catch((err) => console.error("Failed to load WMS operations data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const targetTransferWarehouseObj = warehouses.find((w) => w.name === transferFormData.toWarehouse);
  const selectedTransferItem = items.find((i) => i.id === transferFormData.itemId);
  const availableTargetWarehouses = warehouses.filter((w) => w.name !== selectedTransferItem?.warehouse);

  // Submit Handlers
  const handleInboundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...inboundFormData,
          warehouse: inboundFormData.warehouse || warehouses[0]?.name || "Главный склад"
        })
      });
      if (res.ok) {
        setShowInboundModal(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при оформлении прихода");
      }
    } catch (err) {
      console.error("Inbound submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(movFormData)
      });
      if (res.ok) {
        setShowMovModal(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка проведения складской операции");
      }
    } catch (err) {
      console.error("Movement submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...transferFormData,
          targetMolUser: targetTransferWarehouseObj?.responsibleUser || ""
        })
      });
      if (res.ok) {
        setShowTransferModal(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка создания запроса на перемещение");
      }
    } catch (err) {
      console.error("Transfer submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/personal-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cardFormData)
      });
      if (res.ok) {
        setShowCardModal(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка выдачи имущества");
      }
    } catch (err) {
      console.error("Card submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/personal-cards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: selectedCard.id,
          returnCondition: returnFormData.returnCondition
        })
      });
      if (res.ok) {
        setShowReturnModal(false);
        setSelectedCard(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка возврата");
      }
    } catch (err) {
      console.error("Return submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferAction = async (requestId: string, action: "APPROVE" | "REJECT") => {
    try {
      const res = await fetch("/api/modules/wms/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, requestId })
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка обработки заявки");
      }
    } catch (err) {
      console.error("Transfer action error:", err);
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Движения ТМЦ"
          description="Единый центр управления журналами движений, акцептами МОЛ и личными карточками выдачи СИЗ"
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учет", href: "/modules/wms" },
            { title: "Движения ТМЦ" },
          ]}
          actions={
            <div className="flex items-center gap-2 relative">
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
              </button>

              {/* Unified Action Dropdown Button */}
              <div className="relative">
                <button
                  onClick={() => setActionMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] transition"
                >
                  <Plus size={14} /> Оформить складскую операцию <ChevronDown size={13} className={actionMenuOpen ? "rotate-180 transition-transform" : "transition-transform"} />
                </button>

                {actionMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setActionMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl space-y-0.5">
                      <button
                        onClick={() => {
                          setActionMenuOpen(false);
                          setShowInboundModal(true);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition"
                      >
                        <div className="rounded p-1 bg-blue-100 text-blue-600">
                          <Plus size={14} />
                        </div>
                        <div>
                          <div>Оформить Приход</div>
                          <div className="text-[10px] font-normal text-slate-400">Поступление новой партии</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setActionMenuOpen(false);
                          setShowCardModal(true);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition"
                      >
                        <div className="rounded p-1 bg-emerald-100 text-emerald-600">
                          <UserCheck size={14} />
                        </div>
                        <div>
                          <div>Выдать сотруднику</div>
                          <div className="text-[10px] font-normal text-slate-400">Выдача СИЗ / Личная карточка</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setActionMenuOpen(false);
                          setShowTransferModal(true);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
                      >
                        <div className="rounded p-1 bg-indigo-100 text-indigo-600">
                          <ArrowRightLeft size={14} />
                        </div>
                        <div>
                          <div>Переместить ТМЦ</div>
                          <div className="text-[10px] font-normal text-slate-400">Трансфер другому МОЛ</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setActionMenuOpen(false);
                          setShowMovModal(true);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition"
                      >
                        <div className="rounded p-1 bg-rose-100 text-rose-600">
                          <FileSpreadsheet size={14} />
                        </div>
                        <div>
                          <div>Списать ТМЦ</div>
                          <div className="text-[10px] font-normal text-slate-400">Акт списания / Ремонт</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          }
        />

        {/* TabNav Header Controls */}
        <TabNav
          items={[
            { id: "movements", label: "История движений & Списание EPS", icon: <History size={14} /> },
            { id: "transfers", label: "Межскладские перемещения МОЛ", icon: <ArrowRightLeft size={14} />, badge: transfers.filter(t => t.status === "PENDING").length || undefined },
            { id: "cards", label: "Личные карточки СИЗ", icon: <UserCheck size={14} /> },
          ]}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id)}
        />

        {/* TAB 1: MOVEMENTS */}
        {activeTab === "movements" && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <DataTable
              keyExtractor={(row) => row.id}
              data={movements}
              columns={[
                {
                  key: "createdAt",
                  header: "Дата / Время",
                  cell: (row) => <span className="text-[11px] text-slate-500">{new Date(row.createdAt).toLocaleString("ru-RU")}</span>,
                },
                {
                  key: "itemSku",
                  header: "Артикул / ТМЦ",
                  cell: (row) => (
                    <div className="font-mono">
                      <span className="block text-[11px] font-bold text-[#3473d4]">{row.itemName}</span>
                      <span className="block text-[10px] text-slate-400">SKU: {row.itemSku}</span>
                    </div>
                  ),
                },
                {
                  key: "type",
                  header: "Тип операции",
                  cell: (row) => {
                    if (row.type === "INCOMING") return <StatusBadge status="ACTIVE" label="Приход (+)" />;
                    if (row.type === "OUTGOING" || row.type === "PERSONAL_CARD") return <StatusBadge status="DECOMMISSIONED" label="Списание (-)" />;
                    return <StatusBadge status="INACTIVE" label="Перемещение" />;
                  },
                },
                {
                  key: "quantity",
                  header: "Количество",
                  cell: (row) => <span className="text-[11px] font-bold text-slate-800">{row.quantity}</span>,
                },
                {
                  key: "reason",
                  header: "Причина / Оборудование (EPS)",
                  cell: (row) => (
                    <div>
                      <div className="text-[11px] text-slate-700">{row.reason || "Запланированное движение"}</div>
                      {row.relatedOrderOrEq && (
                        <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[#3473d4]">
                          <Server size={10} /> {row.relatedOrderOrEq}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: "performedBy",
                  header: "Ответственный",
                  cell: (row) => <span className="text-[11px] text-slate-500">{row.performedBy}</span>,
                },
              ]}
            />
          </div>
        )}

        {/* TAB 2: MOL TRANSFERS */}
        {activeTab === "transfers" && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <DataTable
              keyExtractor={(row) => row.id}
              data={transfers}
              columns={[
                {
                  key: "itemSku",
                  header: "Артикул / ТМЦ",
                  cell: (row) => (
                    <div className="font-mono">
                      <span className="block text-[11px] font-bold text-[#3473d4]">{row.itemName}</span>
                      <span className="block text-[10px] text-slate-400">SKU: {row.itemSku}</span>
                    </div>
                  ),
                },
                {
                  key: "fromWarehouse",
                  header: "Отправитель -> Получатель",
                  cell: (row) => (
                    <div className="text-[11px] text-slate-700 font-semibold flex items-center gap-1.5">
                      <span>{row.fromWarehouse}</span>
                      <ArrowRightLeft size={12} className="text-slate-400" />
                      <span className="text-[#3473d4]">{row.toWarehouse}</span>
                    </div>
                  ),
                },
                {
                  key: "quantity",
                  header: "Количество",
                  cell: (row) => <span className="text-[11px] font-bold text-slate-800">{row.quantity}</span>,
                },
                {
                  key: "targetMolUser",
                  header: "Ответственные МОЛ",
                  cell: (row) => (
                    <div>
                      <span className="block text-[11px] font-medium text-slate-700">Инициатор: {row.requestedBy}</span>
                      <span className="block text-[10px] text-blue-600">Приемщик МОЛ: {row.targetMolUser}</span>
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "Статус",
                  cell: (row) => {
                    if (row.status === "APPROVED") return <StatusBadge status="ACTIVE" label="Принято МОЛ" />;
                    if (row.status === "REJECTED") return <StatusBadge status="REJECTED" label="Отклонено" />;
                    return <StatusBadge status="DRAFT" label="Ожидает приемки" />;
                  },
                },
                {
                  key: "actions",
                  header: "Действия МОЛ",
                  className: "text-right",
                  cell: (row) => (
                    <div className="flex items-center justify-end gap-2">
                      {row.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => handleTransferAction(row.id, "APPROVE")}
                            className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-500"
                          >
                            <CheckCircle2 size={11} /> Принять на склад
                          </button>
                          <button
                            onClick={() => handleTransferAction(row.id, "REJECT")}
                            className="flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-rose-500"
                          >
                            <XCircle size={11} /> Отклонить
                          </button>
                        </>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}

        {/* TAB 3: PERSONAL CARDS */}
        {activeTab === "cards" && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <DataTable
              keyExtractor={(row) => row.id}
              data={cards}
              columns={[
                {
                  key: "employeeName",
                  header: "Сотрудник / Подразделение",
                  cell: (row) => (
                    <div>
                      <span className="block text-[11px] font-bold text-[#17243a]">{row.employeeName}</span>
                      <span className="block text-[10px] text-slate-400">{row.employeePosition} ({row.department || "Цех"})</span>
                    </div>
                  ),
                },
                {
                  key: "itemSku",
                  header: "Выданное имущество / Артикул",
                  cell: (row) => (
                    <div className="font-mono">
                      <span className="block text-[11px] font-bold text-[#3473d4]">{row.itemName}</span>
                      <span className="block text-[10px] text-slate-400">SKU: {row.itemSku}</span>
                    </div>
                  ),
                },
                {
                  key: "issuedQuantity",
                  header: "Выдано ед.",
                  cell: (row) => <span className="text-[11px] font-bold text-slate-800">{row.issuedQuantity} ед.</span>,
                },
                {
                  key: "issuedAt",
                  header: "Дата выдачи",
                  cell: (row) => <span className="text-[11px] text-slate-500">{new Date(row.issuedAt).toLocaleDateString("ru-RU")}</span>,
                },
                {
                  key: "returnedAt",
                  header: "Статус возврата",
                  cell: (row) => {
                    if (row.returnedAt) {
                      if (row.returnCondition === "GOOD") return <StatusBadge status="ACTIVE" label="Возвращено (Исправно)" />;
                      if (row.returnCondition === "REPAIR") return <StatusBadge status="DRAFT" label="На ремонте" />;
                      return <StatusBadge status="DECOMMISSIONED" label="Списано в утиль" />;
                    }
                    return <StatusBadge status="INACTIVE" label="На руках у сотрудника" />;
                  },
                },
                {
                  key: "actions",
                  header: "Действия",
                  className: "text-right",
                  cell: (row) => (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setPrintItemData({
                            sku: row.itemSku,
                            name: row.itemName,
                            category: "Личная карточка"
                          });
                          setPrintModalOpen(true);
                        }}
                        title="Печать этикетки / QR-кода"
                        className="rounded bg-slate-100 p-1 text-slate-600 hover:bg-slate-200"
                      >
                        <QrCode size={13} />
                      </button>

                      {!row.returnedAt && (
                        <button
                          onClick={() => {
                            setSelectedCard(row);
                            setShowReturnModal(true);
                          }}
                          className="flex items-center gap-1 rounded bg-[#2f74df] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#2565c8]"
                        >
                          <RotateCcw size={11} /> Оформить возврат
                        </button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}

        {/* Modal 1: New Movement */}
        <Modal open={showMovModal} onClose={() => setShowMovModal(false)} size="lg">
          <ModalHeader
            icon={<History size={16} />}
            title="Регистрация движения / Списания ТМЦ"
            subtitle="Выберите позицию ТМЦ и основание выполнения операции"
            onClose={() => setShowMovModal(false)}
          />
          <form onSubmit={handleMovementSubmit} className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Выберите позицию ТМЦ *</label>
              <select
                required
                value={movFormData.itemId}
                onChange={(e) => setMovFormData({ ...movFormData, itemId: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} (SKU: {i.sku}) — Склад: {i.warehouse} (Остаток: {i.quantity} {i.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Тип операции *</label>
                <select
                  value={movFormData.type}
                  onChange={(e) => setMovFormData({ ...movFormData, type: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="INCOMING">Приход на склад (+)</option>
                  <option value="OUTGOING">Списание со склада (-)</option>
                  <option value="ADJUSTMENT">Корректировка остатка</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Количество *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={movFormData.quantity}
                  onChange={(e) => setMovFormData({ ...movFormData, quantity: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Привязать к оборудованию EPS (необязательно)
              </label>
              <select
                value={movFormData.relatedOrderOrEq}
                onChange={(e) => setMovFormData({ ...movFormData, relatedOrderOrEq: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="">-- Без привязки к оборудованию --</option>
                {equipments.map((eq) => (
                  <option key={eq.id} value={`${eq.name} (${eq.equipmentCode})`}>
                    {eq.name} [{eq.equipmentCode}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Причина / Основание</label>
              <input
                value={movFormData.reason}
                onChange={(e) => setMovFormData({ ...movFormData, reason: e.target.value })}
                placeholder="Плановое обслуживание / Аварийная замена"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowMovModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8] disabled:opacity-50"
              >
                {submitting ? "Проведение..." : "Провести операцию"}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal 2: New Transfer Request */}
        <Modal open={showTransferModal} onClose={() => setShowTransferModal(false)} size="lg">
          <ModalHeader
            icon={<ArrowRightLeft size={16} />}
            title="Запрос на межскладское перемещение"
            subtitle="Выберите позицию ТМЦ и целевой склад (МОЛ подтянется автоматически)"
            onClose={() => setShowTransferModal(false)}
          />
          <form onSubmit={handleTransferSubmit} className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Выберите позицию ТМЦ со своего склада *</label>
              <select
                required
                value={transferFormData.itemId}
                onChange={(e) => {
                  const newId = e.target.value;
                  const itemObj = items.find((i) => i.id === newId);
                  const validTargetWh = warehouses.find((w) => w.name !== itemObj?.warehouse)?.name || "";
                  setTransferFormData({ ...transferFormData, itemId: newId, toWarehouse: validTargetWh });
                }}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} (SKU: {i.sku}) — Исходный Склад: {i.warehouse} (Доступно: {i.quantity})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Количество для передачи *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferFormData.quantity}
                  onChange={(e) => setTransferFormData({ ...transferFormData, quantity: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Склад назначения (Получатель) *</label>
                <select
                  required
                  value={transferFormData.toWarehouse}
                  onChange={(e) => setTransferFormData({ ...transferFormData, toWarehouse: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {availableTargetWarehouses.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.name} (МОЛ: {w.responsibleUser})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {targetTransferWarehouseObj && (
              <div className="rounded-lg bg-blue-50/60 p-2.5 border border-blue-100 text-xs text-blue-900">
                <span>Автоматически определен МОЛ-приемщик: </span>
                <strong className="text-blue-700">{targetTransferWarehouseObj.responsibleUser}</strong>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Причина / Основание передачи</label>
              <input
                value={transferFormData.reason}
                onChange={(e) => setTransferFormData({ ...transferFormData, reason: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8] disabled:opacity-50"
              >
                {submitting ? "Отправка..." : "Отправить запрос МОЛ"}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal 3: Issue Personal Card */}
        <Modal open={showCardModal} onClose={() => setShowCardModal(false)} size="lg">
          <ModalHeader
            icon={<UserCheck size={16} />}
            title="Выдача ТМЦ / СИЗ в личную карточку"
            subtitle="Укажите сотрудника и позицию ТМЦ"
            onClose={() => setShowCardModal(false)}
          />
          <form onSubmit={handleCardSubmit} className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">ФИО Сотрудника *</label>
              <input
                required
                value={cardFormData.employeeName}
                onChange={(e) => setCardFormData({ ...cardFormData, employeeName: e.target.value })}
                placeholder="Петров Алексей Сергеевич"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Должность</label>
                <input
                  value={cardFormData.employeePosition}
                  onChange={(e) => setCardFormData({ ...cardFormData, employeePosition: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Цех / Подразделение</label>
                <input
                  value={cardFormData.department}
                  onChange={(e) => setCardFormData({ ...cardFormData, department: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Выберите позицию ТМЦ / СИЗ *</label>
                <select
                  required
                  value={cardFormData.itemId}
                  onChange={(e) => setCardFormData({ ...cardFormData, itemId: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (SKU: {i.sku}) — Склад: {i.warehouse} (Остаток: {i.quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Количество ед. *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={cardFormData.quantity}
                  onChange={(e) => setCardFormData({ ...cardFormData, quantity: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowCardModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8] disabled:opacity-50"
              >
                {submitting ? "Выдача..." : "Оформить выдачу"}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal 4: Return Asset */}
        <Modal open={showReturnModal} onClose={() => setShowReturnModal(false)} size="md">
          <ModalHeader
            icon={<RotateCcw size={16} />}
            title="Оформление возврата имущества"
            subtitle={selectedCard ? `${selectedCard.itemName} от ${selectedCard.employeeName}` : ""}
            onClose={() => setShowReturnModal(false)}
          />
          <form onSubmit={handleReturnSubmit} className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Техническое состояние имущества при возврате *</label>
              <select
                value={returnFormData.returnCondition}
                onChange={(e) => setReturnFormData({ returnCondition: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="GOOD">Исправно — вернуть остаток на склад</option>
                <option value="REPAIR">Требует ремонта — направить в ТОиР</option>
                <option value="SCRAPPED">Списано в утиль / Непригодно</option>
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8] disabled:opacity-50"
              >
                {submitting ? "Сохранение..." : "Подтвердить возврат"}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal 5: Inbound Receiving */}
        <Modal open={showInboundModal} onClose={() => setShowInboundModal(false)} size="lg">
          <ModalHeader
            icon={<Plus size={16} />}
            title="Оформление Прихода товара"
            subtitle="Поступление новой партии или позиций ТМЦ на склад"
            onClose={() => setShowInboundModal(false)}
          />
          <form onSubmit={handleInboundSubmit} className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Наименование ТМЦ *</label>
                <input
                  required
                  value={inboundFormData.name}
                  onChange={(e) => setInboundFormData({ ...inboundFormData, name: e.target.value })}
                  placeholder="Манжета гидравлическая 50х70"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Артикул (SKU) *</label>
                <input
                  required
                  value={inboundFormData.sku}
                  onChange={(e) => setInboundFormData({ ...inboundFormData, sku: e.target.value })}
                  placeholder="ZIP-HYD-0099"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Склад *</label>
                <select
                  value={inboundFormData.warehouse}
                  onChange={(e) => setInboundFormData({ ...inboundFormData, warehouse: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Ячейка</label>
                <input
                  value={inboundFormData.cell}
                  onChange={(e) => setInboundFormData({ ...inboundFormData, cell: e.target.value })}
                  placeholder="Яч-01-A"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Количество *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={inboundFormData.quantity}
                  onChange={(e) => setInboundFormData({ ...inboundFormData, quantity: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowInboundModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8] disabled:opacity-50"
              >
                {submitting ? "Сохранение..." : "Сохранить Приход"}
              </button>
            </div>
          </form>
        </Modal>

        {/* Barcode Label Modal Printer */}
        {printItemData && (
          <BarcodeLabelModal
            open={printModalOpen}
            onClose={() => setPrintModalOpen(false)}
            title="Печать этикетки СИЗ / Имущества"
            sku={printItemData.sku}
            name={printItemData.name}
            location={printItemData.location}
            category={printItemData.category}
          />
        )}
      </main>
    </ShellLayout>
  );
}
