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
  Pencil,
  Tag,
  Truck,
  History,
  DollarSign,
  Layers,
  Lock
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

import { useShell } from "@/components/layout/shell-context";

export default function WmsMainCatalogPage() {
  return (
    <ShellLayout>
      <WmsMainCatalogPageContent />
    </ShellLayout>
  );
}

function WmsMainCatalogPageContent() {
  const { currentUser } = useShell();
  const userRoles = currentUser?.roles || [];
  const canEdit = userRoles.includes("ADMIN") || userRoles.includes("STOREKEEPER");

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

  // Edit Modal State
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WmsItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    sku: "",
    category: "Запчасти & Механика",
    type: "ZIP",
    warehouse: "",
    zone: "",
    cell: "",
    quantity: 0,
    minQuantity: 0,
    maxQuantity: 100,
    unit: "шт",
    unitPrice: 0,
    isEps: false,
    supplier: "",
    batchNumber: "",
    serialNumber: "",
    description: ""
  });

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
    isPreselected?: boolean;
  }

  const [reqItemsRows, setReqItemsRows] = useState<ReqRow[]>([
    { id: "1", selectedItemId: "", quantity: 1, isPreselected: false }
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
      { id: Date.now().toString(), selectedItemId: defaultItemId, quantity: 1, isPreselected: false }
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
        quantity: 1,
        isPreselected: true
      }));
      setReqItemsRows(selectedRows);
    } else if (items.length > 0) {
      setReqItemsRows([{ id: "1", selectedItemId: items[0].id, quantity: 1, isPreselected: false }]);
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

  interface EquipmentOption {
    id: string;
    equipmentCode: string;
    name: string;
  }
  const [equipments, setEquipments] = useState<EquipmentOption[]>([]);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/modules/wms/items?query=${encodeURIComponent(query)}`).then((r) => (r.ok ? r.json() : { items: [] })),
      fetch("/api/modules/wms/warehouses").then((r) => (r.ok ? r.json() : { warehouses: [] })),
      fetch("/api/modules/wms/requisitions").then((r) => (r.ok ? r.json() : { requisitions: [] })),
      fetch("/api/modules/eps/equipment").then((r) => (r.ok ? r.json() : { equipment: [] }))
    ])
      .then(([itemsData, whData, reqsData, eqData]) => {
        const loadedItems = itemsData.items || [];
        setItems(loadedItems);
        const whs = whData.warehouses || [];
        setWarehousesList(whs);
        setRequisitions(reqsData.requisitions || []);
        const eqList = (eqData.equipment || []).map((e: any) => ({
          id: e.id,
          equipmentCode: e.equipmentCode,
          name: e.name
        }));
        setEquipments(eqList);

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

  // Open Edit Modal for TMC Item
  const openEditModal = (item: WmsItem) => {
    setEditingItem(item);
    setEditFormData({
      name: item.name,
      sku: item.sku,
      category: item.category,
      type: item.type,
      warehouse: item.warehouse,
      zone: item.zone || "",
      cell: item.cell || "",
      quantity: item.quantity,
      minQuantity: item.minQuantity,
      maxQuantity: item.maxQuantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      isEps: item.isEps,
      supplier: item.supplier || "",
      batchNumber: item.batchNumber || "",
      serialNumber: item.serialNumber || "",
      description: item.description || ""
    });
    setShowEditItemModal(true);
  };

  // Edit Item Submit Handler
  const handleEditItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const res = await fetch(`/api/modules/wms/items/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData)
      });
      if (res.ok) {
        setShowEditItemModal(false);
        setEditingItem(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при обновлении позиции ТМЦ");
      }
    } catch (err) {
      console.error("Failed to edit TMC item:", err);
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
              {canEdit && (
                <>
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
                        <div className="absolute right-0 top-full mt-2 z-20 w-64 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-2xl space-y-1 ring-1 ring-slate-900/5">
                          <button
                            onClick={() => {
                              setActionMenuOpen(false);
                              setShowCreateItemModal(true);
                            }}
                            className="group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all duration-150 hover:bg-blue-50/70"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-2xs group-hover:scale-105 transition-transform">
                              <Plus size={16} />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Оформить Приход</div>
                              <div className="text-[10px] text-slate-500 font-medium">Поступление / Создание ТМЦ</div>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              setActionMenuOpen(false);
                              openTransferModalWithSelected();
                            }}
                            className="group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all duration-150 hover:bg-indigo-50/70"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform">
                              <ArrowLeftRight size={16} />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">Перемещение ТМЦ</div>
                              <div className="text-[10px] text-slate-500 font-medium">Трансфер между складами</div>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              setActionMenuOpen(false);
                              setShowWriteOffModal(true);
                            }}
                            className="group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all duration-150 hover:bg-rose-50/70"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 shadow-2xs group-hover:scale-105 transition-transform">
                              <FileSpreadsheet size={16} />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800 group-hover:text-rose-700">Списать ТМЦ</div>
                              <div className="text-[10px] text-slate-500 font-medium">Акт списания / Ремонт оборудования</div>
                            </div>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
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
                      onClick={() => openEditModal(row)}
                      title="Редактировать позицию ТМЦ / Место хранения"
                      className="rounded p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                    >
                      <Pencil size={15} />
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
            subtitle="Формирование официальной заявки МОЛ для межскладского перемещения номенклатуры"
            onClose={() => setShowRequisitionModal(false)}
          />
          <form onSubmit={handleCreateRequisition} className="p-6 space-y-5">
            {/* WAREHOUSE TRANSFER FLOW CONTAINER */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
                <div className="md:col-span-5 space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <MapPin size={12} className="text-[#2f74df]" /> Склад-Получатель (Заказчик) *
                  </label>
                  <select
                    value={reqHeader.fromWarehouse}
                    onChange={(e) => setReqHeader({ ...reqHeader, fromWarehouse: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                  >
                    {warehousesList.map((w) => (
                      <option key={w.id} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div className="hidden md:flex md:col-span-1 items-center justify-center pt-5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-[#2f74df] shadow-2xs">
                    <ArrowLeftRight size={13} />
                  </div>
                </div>

                <div className="md:col-span-5 space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Truck size={12} className="text-[#2f74df]" /> Склад-Поставщик (Отправитель) *
                  </label>
                  <select
                    value={reqHeader.toWarehouse}
                    onChange={(e) => setReqHeader({ ...reqHeader, toWarehouse: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                  >
                    {warehousesList.map((w) => (
                      <option key={w.id} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* REQUESTED ITEMS SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#17243a] uppercase tracking-wide">Запрашиваемые позиции ТМЦ</span>
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#2f74df] border border-blue-100">
                    {reqItemsRows.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addReqRow}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#2f74df] transition-colors shadow-2xs active:scale-98 cursor-pointer"
                >
                  <Plus size={13} /> Добавить позицию
                </button>
              </div>

              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {reqItemsRows.map((row, idx) => {
                  const selectedItem = items.find((i) => i.id === row.selectedItemId);
                  return (
                    <div
                      key={row.id}
                      className="group relative rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      <div className="grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-12 md:col-span-8 space-y-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-600">
                              {idx + 1}
                            </span>
                            <label className="text-xs font-semibold text-[#17243a]">
                              {row.isPreselected ? "Выбранная позиция ТМЦ (Фиксированная)" : "Выберите ТМЦ *"}
                            </label>
                          </div>
                          {row.isPreselected ? (
                            <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-100/80 px-3.5 py-2 text-xs font-medium text-slate-800">
                              <Lock size={14} className="text-slate-400 shrink-0" />
                              <div className="truncate flex items-center gap-2">
                                <span className="font-bold text-slate-900">{selectedItem?.name || "Номенклатура"}</span>
                                {selectedItem?.sku && (
                                  <span className="font-mono text-[11px] text-[#2f74df] font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                    {selectedItem.sku}
                                  </span>
                                )}
                                {selectedItem?.category && (
                                  <span className="text-[10px] text-slate-500 font-normal">
                                    ({selectedItem.category})
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <SearchableSelect
                              items={items}
                              selectedId={row.selectedItemId}
                              onSelect={(selectedItem) => {
                                setReqItemsRows(
                                  reqItemsRows.map((r) => (r.id === row.id ? { ...r, selectedItemId: selectedItem.id } : r))
                                );
                              }}
                              placeholder="Поиск по названию, SKU или категории..."
                            />
                          )}
                        </div>

                      <div className="col-span-9 md:col-span-3 space-y-1">
                        <label className="block text-xs font-semibold text-[#17243a] mb-1">Количество *</label>
                        <input
                          required
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setReqItemsRows(
                              reqItemsRows.map((r) => (r.id === row.id ? { ...r, quantity: val } : r))
                            );
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors"
                        />
                      </div>

                      <div className="col-span-3 md:col-span-1 flex items-center justify-center pt-5">
                        <button
                          type="button"
                          disabled={reqItemsRows.length <= 1}
                          onClick={() => removeReqRow(row.id)}
                          title="Удалить позицию"
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>

            {/* NOTE / REASON FIELD */}
            <div className="space-y-1 pt-1">
              <label className="block text-xs font-semibold text-[#17243a]">Обоснование / Примечание к запросу</label>
              <input
                type="text"
                value={reqHeader.note}
                onChange={(e) => setReqHeader({ ...reqHeader, note: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                placeholder="Например: Для аварийного ремонта насосной станции НПС-02"
              />
            </div>

            {/* FOOTER ACTIONS */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80">
              <button
                type="button"
                onClick={() => setShowRequisitionModal(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-200 hover:from-indigo-700 hover:to-blue-700 active:scale-98 transition-all"
              >
                <Send size={14} /> Отправить запрос кладовщику
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL: DIRECT TRANSFER BETWEEN WAREHOUSES */}
        <Modal open={showTransferModal} onClose={() => setShowTransferModal(false)} size="lg">
          <ModalHeader
            icon={<ArrowLeftRight size={16} />}
            title="Перемещение ТМЦ между складами"
            subtitle="Прямой трансфер товарно-материальных ценностей ответственным МОЛ"
            onClose={() => setShowTransferModal(false)}
          />
          <form onSubmit={handleTransferBatchSubmit} className="space-y-4 p-6">
            {/* WAREHOUSE TRANSFER FLOW CONTAINER */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
                <div className="md:col-span-5 space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Truck size={12} className="text-[#2f74df]" /> Склад-Отправитель (МОЛ) *
                  </label>
                  <select
                    value={transferHeader.fromWarehouse}
                    onChange={(e) => setTransferHeader({ ...transferHeader, fromWarehouse: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                  >
                    {warehousesList.map((w) => (
                      <option key={w.id} value={w.name}>{w.name} (МОЛ: {w.responsibleUser})</option>
                    ))}
                  </select>
                </div>

                <div className="hidden md:flex md:col-span-1 items-center justify-center pt-5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-[#2f74df] shadow-2xs">
                    <ArrowLeftRight size={13} />
                  </div>
                </div>

                <div className="md:col-span-5 space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <MapPin size={12} className="text-[#2f74df]" /> Склад-Получатель (МОЛ) *
                  </label>
                  <select
                    value={transferHeader.toWarehouse}
                    onChange={(e) => setTransferHeader({ ...transferHeader, toWarehouse: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                  >
                    {warehousesList.map((w) => (
                      <option key={w.id} value={w.name}>{w.name} (МОЛ: {w.responsibleUser})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* TRANSFER ITEMS LIST */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#17243a] uppercase tracking-wide">Перемещаемые позиции ТМЦ</span>
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#2f74df] border border-blue-100">
                    {transferRows.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addTransferRow}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#2f74df] transition-colors shadow-2xs active:scale-98 cursor-pointer"
                >
                  <Plus size={13} /> Добавить позицию
                </button>
              </div>

              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                {transferRows.map((row, idx) => (
                  <div
                    key={row.id}
                    className="group relative rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    <div className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-12 md:col-span-8 space-y-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-600">
                            {idx + 1}
                          </span>
                          <label className="text-xs font-semibold text-[#17243a]">Выберите ТМЦ *</label>
                        </div>
                        <SearchableSelect
                          items={items}
                          selectedId={row.itemId}
                          onSelect={(selectedItem) => {
                            setTransferRows(
                              transferRows.map((r) => (r.id === row.id ? { ...r, itemId: selectedItem.id } : r))
                            );
                          }}
                          placeholder="Поиск по названию или SKU..."
                        />
                      </div>

                      <div className="col-span-9 md:col-span-3 space-y-1">
                        <label className="block text-xs font-semibold text-[#17243a] mb-1">Количество *</label>
                        <input
                          required
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setTransferRows(
                              transferRows.map((r) => (r.id === row.id ? { ...r, quantity: val } : r))
                            );
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors"
                        />
                      </div>

                      <div className="col-span-3 md:col-span-1 flex items-center justify-center pt-5">
                        <button
                          type="button"
                          disabled={transferRows.length <= 1}
                          onClick={() => removeTransferRow(row.id)}
                          title="Удалить позицию"
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <label className="block text-xs font-semibold text-[#17243a]">Обоснование / Примечание</label>
              <input
                type="text"
                value={transferHeader.reason}
                onChange={(e) => setTransferHeader({ ...transferHeader, reason: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                placeholder="Плановое перераспределение запасов между складами"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#2565c8] transition-colors cursor-pointer"
              >
                <ArrowLeftRight size={14} /> Провести Перемещение
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL: CREATE ITEM / INBOUND */}
        <Modal open={showCreateItemModal} onClose={() => setShowCreateItemModal(false)} size="lg">
          <ModalHeader
            icon={<Plus size={16} />}
            title="Приход товара & Новый ТМЦ"
            subtitle="Оформление первичного поступления товара с присвоением склада и ячейки хранения"
            onClose={() => setShowCreateItemModal(false)}
          />
          <form onSubmit={handleCreateItem} className="p-6 space-y-4">
            {/* INBOUND TOP BANNER */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#17243a] mb-1">Оборудование-Основание (EPS)</label>
                  <select
                    onChange={(e) => {
                      const selectedEq = equipments.find((eq) => eq.id === e.target.value);
                      if (selectedEq) {
                        setItemFormData({
                          ...itemFormData,
                          name: `Ремкомплект / ЗИП для ${selectedEq.name}`,
                          sku: `ZIP-${selectedEq.equipmentCode}-${Math.floor(100 + Math.random() * 900)}`,
                          category: "Запчасти & Механика",
                          description: `Запасная часть для обслуживания оборудования: ${selectedEq.name} (Код: ${selectedEq.equipmentCode})`,
                          isEps: true
                        });
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                  >
                    <option value="">-- Автозаполнение по объекту (опционально) --</option>
                    {equipments.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} ({eq.equipmentCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17243a] mb-1">Категория ТМЦ *</label>
                  <select
                    value={itemFormData.category}
                    onChange={(e) => setItemFormData({ ...itemFormData, category: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                  >
                    <option value="Запчасти & Механика">Запчасти & Механика</option>
                    <option value="Электрооборудование">Электрооборудование</option>
                    <option value="Гидравлика & Пневматика">Гидравлика & Пневматика</option>
                    <option value="Расходные материалы">Расходные материалы</option>
                    <option value="Критический ЗИП">Критический ЗИП</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#17243a] mb-1">Наименование ТМЦ *</label>
                <input
                  required
                  type="text"
                  value={itemFormData.name}
                  onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                  placeholder="Сальник коленчатого вала 45х65"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#17243a] mb-1">Артикул (SKU) *</label>
                <input
                  required
                  type="text"
                  value={itemFormData.sku}
                  onChange={(e) => setItemFormData({ ...itemFormData, sku: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                  placeholder="ZIP-ENG-0544"
                />
              </div>
            </div>

            {/* LOCATION BOX */}
            <div className="p-3.5 bg-blue-50/40 rounded-xl border border-blue-100 space-y-2.5">
              <div className="text-[11px] font-semibold text-[#17243a] flex items-center gap-1.5">
                <MapPin size={13} className="text-[#2f74df]" /> Месторасположение и ячейка хранения
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Склад *</label>
                  <select
                    value={itemFormData.warehouse}
                    onChange={(e) => setItemFormData({ ...itemFormData, warehouse: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#2f74df] focus:outline-hidden"
                  >
                    {warehousesList.map((w) => (
                      <option key={w.id} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Зона</label>
                  <input
                    type="text"
                    value={itemFormData.zone}
                    onChange={(e) => setItemFormData({ ...itemFormData, zone: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono focus:border-[#2f74df] focus:outline-hidden bg-white"
                    placeholder="А1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Ячейка</label>
                  <input
                    type="text"
                    value={itemFormData.cell}
                    onChange={(e) => setItemFormData({ ...itemFormData, cell: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono focus:border-[#2f74df] focus:outline-hidden bg-white"
                    placeholder="Яч-01-B"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#17243a] mb-1">Количество *</label>
                <input
                  type="number"
                  value={itemFormData.quantity}
                  onChange={(e) => setItemFormData({ ...itemFormData, quantity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#2f74df] focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#17243a] mb-1">Мин. остаток (Min)</label>
                <input
                  type="number"
                  value={itemFormData.minQuantity}
                  onChange={(e) => setItemFormData({ ...itemFormData, minQuantity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#2f74df] focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#17243a] mb-1">Ед. измерения *</label>
                <input
                  type="text"
                  value={itemFormData.unit}
                  onChange={(e) => setItemFormData({ ...itemFormData, unit: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#2f74df] focus:outline-hidden"
                  placeholder="шт / компл / м"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#17243a] mb-1">Поставщик / Производитель</label>
              <input
                type="text"
                value={itemFormData.supplier}
                onChange={(e) => setItemFormData({ ...itemFormData, supplier: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#2f74df] focus:outline-hidden"
                placeholder="ООО Grundfos Россия / ООО Резиотех"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#17243a] mb-1">Описание / Привязка к оборудованию</label>
              <textarea
                rows={2}
                value={itemFormData.description}
                onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#2f74df] focus:outline-hidden"
                placeholder="Предназначен для ремонта насосных агрегатов Grundfos CR32..."
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isEpsCheckCatalog"
                checked={itemFormData.isEps}
                onChange={(e) => setItemFormData({ ...itemFormData, isEps: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-[#2f74df] focus:ring-[#2f74df]"
              />
              <label htmlFor="isEpsCheckCatalog" className="text-xs font-medium text-slate-800 cursor-pointer">
                Входит в минимальный перечень аварийного ЗИП (EPS Safety Stock)
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateItemModal(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#2565c8] transition-colors cursor-pointer"
              >
                <Plus size={14} /> Сохранить Приход
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL: WRITE OFF */}
        <Modal open={showWriteOffModal} onClose={() => setShowWriteOffModal(false)} size="lg">
          <ModalHeader
            icon={<FileSpreadsheet size={16} />}
            title="Списание ТМЦ на оборудование"
            subtitle="Оформление официального акта списания запчасти или неликвида"
            onClose={() => setShowWriteOffModal(false)}
          />
          <form onSubmit={handleCreateWriteOff} className="p-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#17243a] mb-1">Причина списания *</label>
                  <select
                    value={writeOffFormData.reason}
                    onChange={(e) => setWriteOffFormData({ ...writeOffFormData, reason: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                  >
                    <option value="EQUIPMENT_REPAIR">Ремонт оборудования</option>
                    <option value="SCRAP">Брак / Поломка</option>
                    <option value="NON_LIQUID">Неликвид</option>
                    <option value="EXPIRED">Истек срок годности</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17243a] mb-1">Наименование Оборудования / Объекта</label>
                  <input
                    type="text"
                    value={writeOffFormData.equipmentName}
                    onChange={(e) => setWriteOffFormData({ ...writeOffFormData, equipmentName: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                    placeholder="Например: Насосный агрегат НПС-01"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4 items-center">
              <div className="col-span-8">
                <label className="block text-xs font-semibold text-[#17243a] mb-1">Списываемый ТМЦ *</label>
                <select
                  value={writeOffFormData.itemId}
                  onChange={(e) => setWriteOffFormData({ ...writeOffFormData, itemId: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.sku}) — Доступный остаток: {it.quantity} {it.unit} [{it.warehouse}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-4">
                <label className="block text-xs font-semibold text-[#17243a] mb-1">Количество *</label>
                <input
                  type="number"
                  min="1"
                  value={writeOffFormData.quantity}
                  onChange={(e) => setWriteOffFormData({ ...writeOffFormData, quantity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowWriteOffModal(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 transition-colors cursor-pointer"
              >
                <FileSpreadsheet size={14} /> Провести Списание
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
            <div className="p-4 space-y-3 text-xs">
              {/* Top Item Summary Card */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 flex items-start justify-between">
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

        {/* MODAL: EDIT TMC ITEM & LOCATION */}
        {editingItem && (
          <Modal open={showEditItemModal} onClose={() => setShowEditItemModal(false)} size="lg">
            <ModalHeader
              icon={<Pencil size={16} />}
              title="Редактирование позиции ТМЦ"
              subtitle={`Артикул: ${editingItem.sku} | Редактирование параметров номенклатуры и места хранения`}
              onClose={() => setShowEditItemModal(false)}
            />
            <form onSubmit={handleEditItemSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#17243a] mb-1">Наименование ТМЦ *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17243a] mb-1">Артикул (SKU) *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.sku}
                    onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#17243a] mb-1">Категория</label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17243a] mb-1">Тип позиции</label>
                  <select
                    value={editFormData.type}
                    onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                  >
                    <option value="ZIP">ЗИП / Запчасти</option>
                    <option value="CONSUMABLE">Расходные материалы</option>
                    <option value="TOOL">Инструмент</option>
                    <option value="EQUIPMENT_PART">Узел оборудования</option>
                    <option value="PPE">СИЗ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17243a] mb-1">Единица измерения</label>
                  <input
                    type="text"
                    value={editFormData.unit}
                    onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#2f74df] focus:ring-2 focus:ring-[#2f74df]/15 focus:outline-hidden transition-colors shadow-2xs"
                  />
                </div>
              </div>

              {/* STORAGE LOCATION FIELDS (Склад & Зона & Ячейка) */}
              <div className="p-3.5 bg-blue-50/40 rounded-xl border border-blue-100 space-y-2.5">
                <div className="text-[11px] font-semibold text-[#17243a] flex items-center gap-1.5">
                  <MapPin size={13} className="text-[#2f74df]" /> Месторасположение и позиция хранения (Кладовщик)
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Склад *</label>
                    <select
                      required
                      value={editFormData.warehouse}
                      onChange={(e) => setEditFormData({ ...editFormData, warehouse: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#2f74df] focus:outline-hidden"
                    >
                      {warehousesList.map((wh) => (
                        <option key={wh.id} value={wh.name}>{wh.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Зона хранения</label>
                    <input
                      type="text"
                      placeholder="например, А1"
                      value={editFormData.zone}
                      onChange={(e) => setEditFormData({ ...editFormData, zone: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono focus:border-[#2f74df] focus:outline-hidden bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Ячейка хранения</label>
                    <input
                      type="text"
                      placeholder="например, Яч-04"
                      value={editFormData.cell}
                      onChange={(e) => setEditFormData({ ...editFormData, cell: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono focus:border-[#2f74df] focus:outline-hidden bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#17243a] mb-1">Текущий остаток</label>
                  <input
                    type="number"
                    disabled
                    value={editFormData.quantity}
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 cursor-not-allowed focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17243a] mb-1">Мин. остаток (Low Stock)</label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.minQuantity}
                    onChange={(e) => setEditFormData({ ...editFormData, minQuantity: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#2f74df] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17243a] mb-1">Макс. остаток</label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.maxQuantity}
                    onChange={(e) => setEditFormData({ ...editFormData, maxQuantity: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#2f74df] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#17243a] mb-1">Партия (Batch №)</label>
                  <input
                    type="text"
                    value={editFormData.batchNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, batchNumber: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono focus:border-[#2f74df] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17243a] mb-1">Серийный номер (S/N)</label>
                  <input
                    type="text"
                    value={editFormData.serialNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, serialNumber: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono focus:border-[#2f74df] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#17243a] mb-1">Поставщик</label>
                  <input
                    type="text"
                    value={editFormData.supplier}
                    onChange={(e) => setEditFormData({ ...editFormData, supplier: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#2f74df] focus:outline-hidden"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.isEps}
                      onChange={(e) => setEditFormData({ ...editFormData, isEps: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-[#2f74df] focus:ring-[#2f74df]"
                    />
                    <span>Критический неснижаемый запас (EPS)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17243a] mb-1">Примечание / Описание</label>
                <textarea
                  rows={2}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#2f74df] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditItemModal(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#2565c8] transition-colors cursor-pointer"
                >
                  <Pencil size={14} /> Сохранить изменения
                </button>
              </div>
            </form>
          </Modal>
        )}
      </main>
  );
}
