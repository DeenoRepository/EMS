"use client";

import { useState, useEffect, useMemo } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  Box,
  AlertTriangle,
  RefreshCw,
  Plus,
  QrCode,
  MapPin,
  Send,
  FileSpreadsheet,
  CheckSquare,
  ArrowLeftRight,
  UserCheck,
  Wrench,
  ShieldAlert,
  Bell,
  CheckCircle,
  XCircle,
  Trash2,
  ChevronDown,
  Eye,
  Tag,
  Truck,
  History,
  DollarSign,
  Layers
} from "lucide-react";
import {
  PageHeader,
  KpiGrid,
  Modal,
  ModalHeader,
  FilterToolbar,
  DataTable,
  StatusBadge,
  SearchableSelect
} from "@/components/ui";
import { BarcodeLabelModal } from "@/components/wms/barcode-label-modal";

interface StorageCell {
  id: string;
  code: string;
}

interface Warehouse {
  id: string;
  name: string;
  responsibleUser: string;
  storageCells: StorageCell[];
}

interface WmsItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  type: string;
  unit: string;
  warehouse: string;
  zone?: string;
  cell?: string;
  batchNumber?: string;
  serialNumber?: string;
  quantity: number;
  minQuantity: number;
  maxQuantity: number;
  reservedQuantity: number;
  unitPrice: number;
  currency: string;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "OVERSTOCKED";
  isEps: boolean;
  supplier?: string;
  description?: string;
  barcode?: string;
}

interface RequisitionItem {
  id?: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  quantity: number;
}

interface WmsRequisition {
  id: string;
  requisitionNumber: string;
  fromWarehouse: string;
  toWarehouse: string;
  requestedBy: string;
  status: "DRAFT" | "REQUESTED" | "APPROVED" | "IN_TRANSIT" | "COMPLETED" | "REJECTED";
  note?: string;
  createdAt: string;
  items: RequisitionItem[];
}

export default function WmsMainCatalogPage() {
  const [items, setItems] = useState<WmsItem[]>([]);
  const [warehousesList, setWarehousesList] = useState<Warehouse[]>([]);
  const [requisitions, setRequisitions] = useState<WmsRequisition[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // Selected item IDs
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Modals state
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedLabelItem, setSelectedLabelItem] = useState<WmsItem | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedCardItem, setSelectedCardItem] = useState<WmsItem | null>(null);

  // Forms data
  const [itemFormData, setItemFormData] = useState({
    name: "",
    sku: "",
    category: "Запчасти & Механика",
    type: "ZIP",
    warehouse: "",
    zone: "А1",
    cell: "Яч-01",
    batchNumber: "",
    serialNumber: "",
    quantity: 10,
    minQuantity: 2,
    maxQuantity: 100,
    unit: "шт",
    unitPrice: 1500,
    isEps: false,
    supplier: "",
    description: ""
  });

  const [writeOffFormData, setWriteOffFormData] = useState({
    itemId: "",
    quantity: 1,
    reason: "EQUIPMENT_REPAIR",
    equipmentName: "Насосный агрегат НПС-01",
    performedBy: "Петров А.В. (Инженер)",
    comments: "Замена изношенной детали"
  });

  interface ReqRow {
    id: string;
    selectedItemId: string;
    quantity: number;
  }

  const [reqItemsRows, setReqItemsRows] = useState<ReqRow[]>([
    { id: "1", selectedItemId: "", quantity: 1 }
  ]);

  const [reqHeader, setReqHeader] = useState({
    fromWarehouse: "",
    toWarehouse: "",
    requestedBy: "Инженер Редактор (editor)",
    note: ""
  });

  const addReqRow = () => {
    const defaultItemId = items[0]?.id || "";
    setReqItemsRows((prev) => [
      ...prev,
      { id: Date.now().toString(), selectedItemId: defaultItemId, quantity: 1 }
    ]);
  };

  const removeReqRow = (id: string) => {
    if (reqItemsRows.length <= 1) return;
    setReqItemsRows((prev) => prev.filter((r) => r.id !== id));
  };

  const openRequisitionModalWithSelected = () => {
    if (selectedItemIds.length > 0) {
      const selectedRows = selectedItemIds.map((id, index) => ({
        id: String(index + 1),
        selectedItemId: id,
        quantity: 1
      }));
      setReqItemsRows(selectedRows);
    } else if (items.length > 0) {
      setReqItemsRows([{ id: "1", selectedItemId: items[0].id, quantity: 1 }]);
    }
    setShowRequisitionModal(true);
  };

  interface TransferRow {
    id: string;
    itemId: string;
    quantity: number;
  }

  const [transferHeader, setTransferHeader] = useState({
    fromWarehouse: "",
    toWarehouse: "",
    reason: "Перемещение ТМЦ между складами МОЛ"
  });

  const [transferRows, setTransferRows] = useState<TransferRow[]>([
    { id: "1", itemId: "", quantity: 1 }
  ]);

  const openTransferModalWithSelected = () => {
    if (selectedItemIds.length > 0) {
      const selectedRows = selectedItemIds.map((id, index) => ({
        id: String(index + 1),
        itemId: id,
        quantity: 1
      }));
      setTransferRows(selectedRows);
    } else if (items.length > 0) {
      setTransferRows([{ id: "1", itemId: items[0].id, quantity: 1 }]);
    }
    setShowTransferModal(true);
  };

  const addTransferRow = () => {
    const defaultItemId = items[0]?.id || "";
    setTransferRows((prev) => [...prev, { id: Date.now().toString(), itemId: defaultItemId, quantity: 1 }]);
  };

  const removeTransferRow = (id: string) => {
    if (transferRows.length <= 1) return;
    setTransferRows((prev) => prev.filter((r) => r.id !== id));
  };

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/modules/wms/items?query=${encodeURIComponent(query)}`).then((r) => (r.ok ? r.json() : { items: [] })),
      fetch("/api/modules/wms/warehouses").then((r) => (r.ok ? r.json() : { warehouses: [] })),
      fetch("/api/modules/wms/requisitions").then((r) => (r.ok ? r.json() : { requisitions: [] }))
    ])
      .then(([itemsData, whData, reqsData]) => {
        const loadedItems = itemsData.items || [];
        setItems(loadedItems);
        const whs = whData.warehouses || [];
        setWarehousesList(whs);
        setRequisitions(reqsData.requisitions || []);

        if (whs.length > 0) {
          setItemFormData((prev) => ({ ...prev, warehouse: prev.warehouse || whs[0].name }));
          setReqHeader((prev) => ({
            ...prev,
            fromWarehouse: prev.fromWarehouse || whs[0].name,
            toWarehouse: prev.toWarehouse || (whs[1]?.name || whs[0].name)
          }));
        }

        if (loadedItems.length > 0) {
          setWriteOffFormData((prev) => ({ ...prev, itemId: loadedItems[0].id }));
        }
      })
      .catch((err) => console.error("Failed to fetch WMS catalog:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [query]);

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.category))).filter(Boolean);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
      if (warehouseFilter !== "ALL" && item.warehouse !== warehouseFilter) return false;
      return true;
    });
  }, [items, categoryFilter, warehouseFilter]);

  // Pending requisitions notification list (requests waiting for approval)
  const pendingRequisitions = useMemo(() => {
    return requisitions.filter((r) => r.status === "REQUESTED");
  }, [requisitions]);

  const kpiStats = useMemo(() => {
    const totalPositions = items.length;
    const totalUnits = items.reduce((acc, i) => acc + i.quantity, 0);
    const lowStockCount = items.filter((i) => i.status === "LOW_STOCK" || i.quantity <= i.minQuantity).length;
    const epsCount = items.filter((i) => i.isEps).length;
    const pendingRequisitionsCount = requisitions.filter((r) => r.status === "REQUESTED").length;
    return { totalPositions, totalUnits, lowStockCount, epsCount, pendingRequisitionsCount };
  }, [items, requisitions]);

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.length === filteredItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredItems.map((i) => i.id));
    }
  };

  // Create Item / Inbound
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/modules/wms/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemFormData)
      });
      if (res.ok) {
        setShowCreateItemModal(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при приходе ТМЦ");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Write-Off Submit
  const handleCreateWriteOff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/modules/wms/write-offs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(writeOffFormData)
      });
      if (res.ok) {
        setShowWriteOffModal(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при списании ТМЦ");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Direct Transfer Submit Handler
  const handleTransferBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemsPayload = transferRows
      .map((r) => {
        const item = items.find((i) => i.id === r.itemId);
        if (!item) return null;
        return {
          itemId: item.id,
          type: "TRANSFER",
          quantity: r.quantity,
          fromLocation: transferHeader.fromWarehouse || item.warehouse,
          toLocation: transferHeader.toWarehouse,
          reason: transferHeader.reason,
          performedBy: "Кладовщик"
        };
      })
      .filter(Boolean);

    if (itemsPayload.length === 0) {
      alert("Выберите хотя бы одну позицию ТМЦ для перемещения");
      return;
    }

    try {
      const res = await fetch("/api/modules/wms/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsPayload })
      });

      if (res.ok) {
        setShowTransferModal(false);
        setSelectedItemIds([]);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка проведения перемещения ТМЦ");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Requisition Submit
  const handleCreateRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    const payloadItems = reqItemsRows
      .map((row) => {
        const item = items.find((i) => i.id === row.selectedItemId);
        if (!item) return null;
        return {
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          quantity: row.quantity
        };
      })
      .filter(Boolean);

    if (payloadItems.length === 0) {
      alert("Выберите хотя бы одну позицию ТМЦ для запроса");
      return;
    }

    try {
      const res = await fetch("/api/modules/wms/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWarehouse: reqHeader.fromWarehouse,
          toWarehouse: reqHeader.toWarehouse,
          requestedBy: reqHeader.requestedBy,
          note: reqHeader.note,
          items: payloadItems
        })
      });
      if (res.ok) {
        setShowRequisitionModal(false);
        setSelectedItemIds([]);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при создании запроса");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Approval action for incoming requisitions (1-click Approve / Reject)
  const handleRequisitionStatus = async (id: string, newStatus: "APPROVED" | "REJECTED") => {
    try {
      const res = await fetch("/api/modules/wms/requisitions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus })
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка изменения статуса");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Реестр ТМЦ & Операции склада"
          description="Каталог складских запасов с функцией запроса позиций со сторонних складов и уведомлениями для ответственных МОЛ."
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учет" },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
              </button>
              <button
                onClick={openRequisitionModalWithSelected}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
              >
                <Send size={14} /> Запросить перемещение со склада
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
                          setShowCreateItemModal(true);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition"
                      >
                        <div className="rounded p-1 bg-blue-100 text-blue-600">
                          <Plus size={14} />
                        </div>
                        <div>
                          <div>Оформить Приход</div>
                          <div className="text-[10px] font-normal text-slate-400">Поступление/Создание номенклатуры</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setActionMenuOpen(false);
                          openTransferModalWithSelected();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
                      >
                        <div className="rounded p-1 bg-indigo-100 text-indigo-600">
                          <ArrowLeftRight size={14} />
                        </div>
                        <div>
                          <div>Перемещение ТМЦ</div>
                          <div className="text-[10px] font-normal text-slate-400">Перенос номенклатуры между складами</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setActionMenuOpen(false);
                          setShowWriteOffModal(true);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition"
                      >
                        <div className="rounded p-1 bg-rose-100 text-rose-600">
                          <FileSpreadsheet size={14} />
                        </div>
                        <div>
                          <div>Списать ТМЦ</div>
                          <div className="text-[10px] font-normal text-slate-400">Акт списания на ремонт</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          }
        />



        <KpiGrid
          items={[
            {
              label: "Всего наименований ТМЦ",
              value: kpiStats.totalPositions,
              sub: `${kpiStats.totalUnits} единиц на складах`,
              subColor: "slate",
              icon: <Box size={18} />,
              iconColor: "blue"
            },
            {
              label: "Дефицитные позиции",
              value: kpiStats.lowStockCount,
              sub: kpiStats.lowStockCount > 0 ? "Требуется заказ снабжению" : "Запасы в норме",
              subColor: kpiStats.lowStockCount > 0 ? "rose" : "emerald",
              icon: <AlertTriangle size={18} />,
              iconColor: kpiStats.lowStockCount > 0 ? "rose" : "emerald"
            },
            {
              label: "Неснижаемый ЗИП (EPS)",
              value: kpiStats.epsCount,
              sub: "Контроль критических запчастей",
              subColor: "emerald",
              icon: <ShieldAlert size={18} />,
              iconColor: "emerald"
            },
            {
              label: "Запросы на перемещение",
              value: kpiStats.pendingRequisitionsCount,
              sub: kpiStats.pendingRequisitionsCount > 0 ? "Требуется согласование МОЛ" : "Нет новых запросов",
              subColor: kpiStats.pendingRequisitionsCount > 0 ? "amber" : "slate",
              icon: <ArrowLeftRight size={18} />,
              iconColor: kpiStats.pendingRequisitionsCount > 0 ? "amber" : "blue"
            }
          ]}
        />



        <div className="space-y-4">
          <FilterToolbar
            searchQuery={query}
            onSearchChange={setQuery}
            searchPlaceholder="Быстрый поиск по названию, SKU, партии, S/N, ячейке..."
            filters={[
              {
                key: "category",
                label: "Категория",
                value: categoryFilter,
                options: [
                  { label: "Все категории", value: "ALL" },
                  ...categories.map((c) => ({ label: c, value: c }))
                ],
                onChange: setCategoryFilter
              },
              {
                key: "warehouse",
                label: "Склад",
                value: warehouseFilter,
                options: [
                  { label: "Все склады", value: "ALL" },
                  ...warehousesList.map((w) => ({ label: w.name, value: w.name }))
                ],
                onChange: setWarehouseFilter
              }
            ]}
          />

          <DataTable
            columns={[
              {
                key: "select",
                header: (
                  <input
                    type="checkbox"
                    checked={selectedItemIds.length === filteredItems.length && filteredItems.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                ),
                cell: (row: WmsItem) => (
                  <input
                    type="checkbox"
                    checked={selectedItemIds.includes(row.id)}
                    onChange={() => toggleSelectItem(row.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                )
              },
              {
                key: "sku",
                header: "Артикул / Партия",
                cell: (row: WmsItem) => (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-blue-600">
                      {row.sku}
                      {row.isEps && (
                        <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-bold text-amber-800">
                          EPS
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {row.batchNumber ? `Партия: ${row.batchNumber}` : ""} {row.serialNumber ? `S/N: ${row.serialNumber}` : ""}
                    </div>
                  </div>
                )
              },
              {
                key: "name",
                header: "Наименование ТМЦ",
                cell: (row: WmsItem) => (
                  <div>
                    <div className="font-semibold text-slate-900 text-xs">{row.name}</div>
                    <div className="text-[10px] text-slate-500">{row.category} ({row.type})</div>
                  </div>
                )
              },
              {
                key: "location",
                header: "Склад & Ячейка",
                cell: (row: WmsItem) => (
                  <div className="flex items-center gap-1 text-xs font-mono text-slate-700">
                    <MapPin size={12} className="text-slate-400" />
                    <span>{row.warehouse}</span>
                    <span className="text-slate-400 font-bold">/</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-800">
                      {row.cell || "Обустройство"}
                    </span>
                  </div>
                )
              },
              {
                key: "quantity",
                header: "Остаток / Запас",
                cell: (row: WmsItem) => (
                  <div>
                    <div className="font-bold text-xs text-slate-900">
                      {row.quantity} {row.unit}
                      {row.reservedQuantity > 0 && (
                        <span className="ml-1 text-[10px] text-amber-600 font-medium">
                          (Резерв: {row.reservedQuantity})
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">Min: {row.minQuantity}</div>
                  </div>
                )
              },
              {
                key: "status",
                header: "Статус",
                cell: (row: WmsItem) => {
                  const isLow = row.quantity <= row.minQuantity;
                  return (
                    <StatusBadge
                      status={isLow ? "PENDING" : "APPROVED"}
                      label={isLow ? "Низкий остаток" : "В наличии"}
                    />
                  );
                }
              },
              {
                key: "actions",
                header: "Действия",
                cell: (row: WmsItem) => (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedCardItem(row);
                        setShowCardModal(true);
                      }}
                      title="Карточка ТМЦ"
                      className="rounded p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedLabelItem(row);
                        setShowLabelModal(true);
                      }}
                      title="Печать этикетки / QR"
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                    >
                      <QrCode size={15} />
                    </button>
                  </div>
                )
              }
            ]}
            data={filteredItems}
            keyExtractor={(row) => row.id}
          />
        </div>

        {/* MODAL: REQUISITION FROM OTHER WAREHOUSE */}
        <Modal open={showRequisitionModal} onClose={() => setShowRequisitionModal(false)} size="xl">
          <ModalHeader
            icon={<Send size={16} />}
            title="Запрос ТМЦ у другого склада"
            subtitle="Формирование заявки для ответственного кладовщика (МОЛ) склада-поставщика"
            onClose={() => setShowRequisitionModal(false)}
          />
          <form onSubmit={handleCreateRequisition} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Склад-Получатель *</label>
                <select
                  value={reqHeader.fromWarehouse}
                  onChange={(e) => setReqHeader({ ...reqHeader, fromWarehouse: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  {warehousesList.map((w) => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Склад-Поставщик *</label>
                <select
                  value={reqHeader.toWarehouse}
                  onChange={(e) => setReqHeader({ ...reqHeader, toWarehouse: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  {warehousesList.map((w) => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 pb-2 pt-2">
              <span className="text-xs font-semibold text-slate-700">Запрашиваемые позиции ТМЦ ({reqItemsRows.length}):</span>
              <button
                type="button"
                onClick={addReqRow}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                <Plus size={13} /> Добавить позицию
              </button>
            </div>

            <div className="space-y-3 p-1 overflow-visible">
              {reqItemsRows.map((row, idx) => (
                <div key={row.id} className="grid grid-cols-12 gap-3 items-center rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <div className="col-span-8">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Выберите ТМЦ #{idx + 1} *</label>
                    <SearchableSelect
                      items={items}
                      selectedId={row.selectedItemId}
                      onSelect={(selectedItem) => {
                        setReqItemsRows(reqItemsRows.map((r) => (r.id === row.id ? { ...r, selectedItemId: selectedItem.id } : r)));
                      }}
                      placeholder="Поиск по названию или SKU..."
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Количество *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setReqItemsRows(reqItemsRows.map((r) => (r.id === row.id ? { ...r, quantity: val } : r)));
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-1 flex items-center justify-center pt-4">
                    <button
                      type="button"
                      disabled={reqItemsRows.length <= 1}
                      onClick={() => removeReqRow(row.id)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Примечание / Обоснование</label>
              <input
                type="text"
                value={reqHeader.note}
                onChange={(e) => setReqHeader({ ...reqHeader, note: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                placeholder="Для закрытия аварийной заявки ТОИР"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowRequisitionModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs"
              >
                Отправить запрос кладовщику
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL: DIRECT TRANSFER BETWEEN WAREHOUSES */}
        <Modal open={showTransferModal} onClose={() => setShowTransferModal(false)} size="xl">
          <ModalHeader
            icon={<ArrowLeftRight size={16} />}
            title="Перемещение ТМЦ между складами"
            subtitle="Прямой трансфер товарно-материальных ценностей ответственным МОЛ"
            onClose={() => setShowTransferModal(false)}
          />
          <form onSubmit={handleTransferBatchSubmit} className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Склад-Отправитель *</label>
                <select
                  value={transferHeader.fromWarehouse}
                  onChange={(e) => setTransferHeader({ ...transferHeader, fromWarehouse: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  {warehousesList.map((w) => (
                    <option key={w.id} value={w.name}>{w.name} (МОЛ: {w.responsibleUser})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Склад-Получатель *</label>
                <select
                  value={transferHeader.toWarehouse}
                  onChange={(e) => setTransferHeader({ ...transferHeader, toWarehouse: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  {warehousesList.map((w) => (
                    <option key={w.id} value={w.name}>{w.name} (МОЛ: {w.responsibleUser})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-2 pt-2">
              <span className="text-xs font-semibold text-slate-700">Перемещаемые позиции ({transferRows.length}):</span>
              <button
                type="button"
                onClick={addTransferRow}
                className="flex items-center gap-1 rounded bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                <Plus size={13} /> Добавить позицию
              </button>
            </div>

            <div className="space-y-3 p-1 overflow-visible">
              {transferRows.map((row, idx) => (
                <div key={row.id} className="grid grid-cols-12 gap-3 items-center rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
                  <div className="col-span-8">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Выберите ТМЦ #{idx + 1} *</label>
                    <SearchableSelect
                      items={items}
                      selectedId={row.itemId}
                      onSelect={(selectedItem) => {
                        setTransferRows(transferRows.map((r) => (r.id === row.id ? { ...r, itemId: selectedItem.id } : r)));
                      }}
                      placeholder="Поиск по названию или SKU..."
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Количество *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTransferRows(transferRows.map((r) => (r.id === row.id ? { ...r, quantity: val } : r)));
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-1 flex justify-center pt-4">
                    <button
                      type="button"
                      disabled={transferRows.length <= 1}
                      onClick={() => removeTransferRow(row.id)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Обоснование / Примечание</label>
              <input
                type="text"
                value={transferHeader.reason}
                onChange={(e) => setTransferHeader({ ...transferHeader, reason: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                placeholder="Перемещение ТМЦ между складами"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs"
              >
                Провести Перемещение
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL: CREATE ITEM / INBOUND */}
        <Modal open={showCreateItemModal} onClose={() => setShowCreateItemModal(false)} size="lg">
          <ModalHeader
            icon={<Plus size={16} />}
            title="Приход товара & Новый ТМЦ"
            subtitle="Оформление поступления товара с присвоением ячейки и статуса ЗИП"
            onClose={() => setShowCreateItemModal(false)}
          />
          <form onSubmit={handleCreateItem} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Наименование ТМЦ *</label>
                <input
                  required
                  type="text"
                  value={itemFormData.name}
                  onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  placeholder="Сальник коленчатого вала 45х65"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Артикул (SKU) *</label>
                <input
                  required
                  type="text"
                  value={itemFormData.sku}
                  onChange={(e) => setItemFormData({ ...itemFormData, sku: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                  placeholder="ZIP-ENG-0544"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Склад *</label>
                <select
                  value={itemFormData.warehouse}
                  onChange={(e) => setItemFormData({ ...itemFormData, warehouse: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  {warehousesList.map((w) => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Зона</label>
                <input
                  type="text"
                  value={itemFormData.zone}
                  onChange={(e) => setItemFormData({ ...itemFormData, zone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                  placeholder="А1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ячейка</label>
                <input
                  type="text"
                  value={itemFormData.cell}
                  onChange={(e) => setItemFormData({ ...itemFormData, cell: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                  placeholder="Яч-01-B"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Количество *</label>
                <input
                  type="number"
                  value={itemFormData.quantity}
                  onChange={(e) => setItemFormData({ ...itemFormData, quantity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Мин. остаток (Min)</label>
                <input
                  type="number"
                  value={itemFormData.minQuantity}
                  onChange={(e) => setItemFormData({ ...itemFormData, minQuantity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Партия (Batch №)</label>
                <input
                  type="text"
                  value={itemFormData.batchNumber}
                  onChange={(e) => setItemFormData({ ...itemFormData, batchNumber: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                  placeholder="BAT-2026-09"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isEpsCheckCatalog"
                checked={itemFormData.isEps}
                onChange={(e) => setItemFormData({ ...itemFormData, isEps: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isEpsCheckCatalog" className="text-xs font-semibold text-slate-800">
                Входит в минимальный перечень ЗИП (EPS Safety Stock)
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowCreateItemModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Сохранить Приход
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL: WRITE OFF */}
        <Modal open={showWriteOffModal} onClose={() => setShowWriteOffModal(false)} size="md">
          <ModalHeader
            icon={<FileSpreadsheet size={16} />}
            title="Списание ТМЦ на оборудование"
            subtitle="Оформление акта списания запчасти или неликвида"
            onClose={() => setShowWriteOffModal(false)}
          />
          <form onSubmit={handleCreateWriteOff} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Списываемый ТМЦ *</label>
              <select
                value={writeOffFormData.itemId}
                onChange={(e) => setWriteOffFormData({ ...writeOffFormData, itemId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.sku}) - Остаток: {it.quantity} {it.unit}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Количество *</label>
                <input
                  type="number"
                  value={writeOffFormData.quantity}
                  onChange={(e) => setWriteOffFormData({ ...writeOffFormData, quantity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Причина *</label>
                <select
                  value={writeOffFormData.reason}
                  onChange={(e) => setWriteOffFormData({ ...writeOffFormData, reason: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="EQUIPMENT_REPAIR">Ремонт оборудования</option>
                  <option value="SCRAP">Брак / Поломка</option>
                  <option value="NON_LIQUID">Неликвид</option>
                  <option value="EXPIRED">Истек срок годности</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Наименование Оборудования / Объекта</label>
              <input
                type="text"
                value={writeOffFormData.equipmentName}
                onChange={(e) => setWriteOffFormData({ ...writeOffFormData, equipmentName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowWriteOffModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Провести Списание
              </button>
            </div>
          </form>
        </Modal>

        {/* ITEM CARD MODAL */}
        {selectedCardItem && (
          <Modal open={showCardModal} onClose={() => setShowCardModal(false)} size="lg">
            <ModalHeader
              icon={<Box size={16} />}
              title="Паспорт номенклатуры ТМЦ"
              subtitle={`Артикул / SKU: ${selectedCardItem.sku}`}
              onClose={() => setShowCardModal(false)}
            />
            <div className="p-6 space-y-4 text-xs">
              {/* Top Item Summary Card */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 flex items-start justify-between">
                <div className="space-y-1.5 flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-[#2f74df] bg-white px-2 py-0.5 rounded border border-blue-200">
                      {selectedCardItem.sku}
                    </span>
                    {selectedCardItem.isEps && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                        Критический ЗИП (EPS)
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{selectedCardItem.name}</h3>
                  <p className="text-[11px] text-slate-500">
                    Категория: <strong className="text-slate-700 font-medium">{selectedCardItem.category}</strong> • Тип: <strong className="text-slate-700 font-medium">{selectedCardItem.type || "ЗИП"}</strong>
                  </p>
                </div>
                <div className="text-right border-l border-blue-100 pl-4 min-w-[120px]">
                  <div className="text-[10px] font-medium text-slate-400">Текущий остаток</div>
                  <div className="text-lg font-extrabold text-slate-900 font-mono mt-0.5">
                    {selectedCardItem.quantity} <span className="text-xs font-normal text-slate-500">{selectedCardItem.unit}</span>
                  </div>
                  <div className="text-[10px] mt-1 font-medium">
                    {selectedCardItem.quantity <= selectedCardItem.minQuantity ? (
                      <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">⚠️ Ниже лимита ({selectedCardItem.minQuantity})</span>
                    ) : (
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">✓ Запас в норме</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed Specs Grid */}
              <div className="grid grid-cols-3 gap-3">
                {/* Block 1: Location & Storage */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] pb-1 border-b border-slate-100">
                    <MapPin size={13} className="text-[#2f74df]" /> Склад и Локация
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Склад:</span>
                      <span className="font-semibold text-slate-700 text-right truncate max-w-[120px]">{selectedCardItem.warehouse}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Ячейка:</span>
                      <span className="font-mono font-bold text-[#2f74df] bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">{selectedCardItem.cell || "А1-01"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Зона:</span>
                      <span className="font-medium text-slate-700">{selectedCardItem.zone || "Основная A"}</span>
                    </div>
                  </div>
                </div>

                {/* Block 2: Stock & Limits */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] pb-1 border-b border-slate-100">
                    <Layers size={13} className="text-emerald-600" /> Нормативы Запасов
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Мин. остаток:</span>
                      <span className="font-semibold text-slate-700">{selectedCardItem.minQuantity} {selectedCardItem.unit}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Макс. лимит:</span>
                      <span className="font-semibold text-slate-700">{selectedCardItem.maxQuantity || 100} {selectedCardItem.unit}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Резерв:</span>
                      <span className="font-semibold text-amber-600">{selectedCardItem.reservedQuantity || 0} {selectedCardItem.unit}</span>
                    </div>
                  </div>
                </div>

                {/* Block 3: Accounting & Economics */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] pb-1 border-b border-slate-100">
                    <DollarSign size={13} className="text-indigo-600" /> Стоимость & Партия
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Учетная цена:</span>
                      <span className="font-mono font-semibold text-slate-800">{selectedCardItem.unitPrice ? `${selectedCardItem.unitPrice.toLocaleString("ru-RU")} ₽` : "—"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Общая сумма:</span>
                      <span className="font-mono font-bold text-[#2f74df]">
                        {selectedCardItem.unitPrice ? `${(selectedCardItem.unitPrice * selectedCardItem.quantity).toLocaleString("ru-RU")} ₽` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Партия:</span>
                      <span className="font-mono text-slate-600">{selectedCardItem.batchNumber || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Technical Description & Supplier */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-slate-800 font-bold text-[11px]">
                  <span>Описание номенклатуры</span>
                  {selectedCardItem.supplier && (
                    <span className="text-[10px] text-slate-400 font-normal">Поставщик: <strong className="text-slate-700 font-medium">{selectedCardItem.supplier}</strong></span>
                  )}
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {selectedCardItem.description || "Номенклатурная позиция зарегистрирована в едином реестре WMS. Предназначена для планово-предупредительного ремонта и обслуживания оборудования."}
                </p>
              </div>

              {/* Action Buttons Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCardModal(false);
                    setSelectedLabelItem(selectedCardItem);
                    setShowLabelModal(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                >
                  <QrCode size={13} className="text-slate-500" /> Печать этикетки / QR
                </button>
                <button
                  type="button"
                  onClick={() => setShowCardModal(false)}
                  className="rounded-lg bg-[#2f74df] px-4 py-2 text-[11px] font-semibold text-white shadow-xs hover:bg-[#2565c8] transition"
                >
                  Закрыть паспорт
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* BARCODE LABEL MODAL */}
        {selectedLabelItem && (
          <BarcodeLabelModal
            open={showLabelModal}
            onClose={() => {
              setShowLabelModal(false);
              setSelectedLabelItem(null);
            }}
            title="Штрихкод / QR-код ТМЦ"
            sku={selectedLabelItem.sku}
            name={selectedLabelItem.name}
            location={`${selectedLabelItem.warehouse} (${selectedLabelItem.cell || "Обустройство"})`}
            category={selectedLabelItem.category}
          />
        )}
      </main>
    </ShellLayout>
  );
}
