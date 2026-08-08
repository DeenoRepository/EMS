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
  XCircle
} from "lucide-react";
import {
  PageHeader,
  KpiGrid,
  Modal,
  ModalHeader,
  FilterToolbar,
  DataTable,
  StatusBadge
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
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedLabelItem, setSelectedLabelItem] = useState<WmsItem | null>(null);

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

  const [reqFormData, setReqFormData] = useState({
    fromWarehouse: "",
    toWarehouse: "",
    requestedBy: "Кладовщик Идеалов",
    note: "",
    selectedItemId: "",
    quantity: 1
  });

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
          setReqFormData((prev) => ({
            ...prev,
            fromWarehouse: prev.fromWarehouse || whs[0].name,
            toWarehouse: prev.toWarehouse || (whs[1]?.name || whs[0].name)
          }));
        }

        if (loadedItems.length > 0) {
          setWriteOffFormData((prev) => ({ ...prev, itemId: loadedItems[0].id }));
          setReqFormData((prev) => ({ ...prev, selectedItemId: loadedItems[0].id }));
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
    return { totalPositions, totalUnits, lowStockCount, epsCount };
  }, [items]);

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

  // Requisition Submit
  const handleCreateRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    const selItem = items.find((i) => i.id === reqFormData.selectedItemId);
    if (!selItem) return;

    try {
      const res = await fetch("/api/modules/wms/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWarehouse: reqFormData.fromWarehouse,
          toWarehouse: reqFormData.toWarehouse,
          requestedBy: reqFormData.requestedBy,
          note: reqFormData.note,
          items: [
            {
              itemId: selItem.id,
              itemSku: selItem.sku,
              itemName: selItem.name,
              quantity: reqFormData.quantity
            }
          ]
        })
      });
      if (res.ok) {
        setShowRequisitionModal(false);
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
          title="Остатки ТМЦ & Операции склада"
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
                onClick={() => setShowRequisitionModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
              >
                <Send size={14} /> Запросить со склада
              </button>
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
                        setReqFormData((prev) => ({ ...prev, selectedItemId: row.id }));
                        setShowRequisitionModal(true);
                      }}
                      title="Запросить со склада"
                      className="rounded p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    >
                      <Send size={15} />
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
                    <button
                      onClick={() => {
                        setWriteOffFormData((prev) => ({ ...prev, itemId: row.id }));
                        setShowWriteOffModal(true);
                      }}
                      title="Списать на оборудование"
                      className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    >
                      <FileSpreadsheet size={15} />
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
        <Modal open={showRequisitionModal} onClose={() => setShowRequisitionModal(false)} size="md">
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
                  value={reqFormData.fromWarehouse}
                  onChange={(e) => setReqFormData({ ...reqFormData, fromWarehouse: e.target.value })}
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
                  value={reqFormData.toWarehouse}
                  onChange={(e) => setReqFormData({ ...reqFormData, toWarehouse: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  {warehousesList.map((w) => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Запрашиваемый ТМЦ *</label>
              <select
                value={reqFormData.selectedItemId}
                onChange={(e) => setReqFormData({ ...reqFormData, selectedItemId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.sku}) - Доступно: {it.quantity} {it.unit}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Запрашиваемое количество *</label>
              <input
                type="number"
                value={reqFormData.quantity}
                onChange={(e) => setReqFormData({ ...reqFormData, quantity: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Примечание / Обоснование</label>
              <input
                type="text"
                value={reqFormData.note}
                onChange={(e) => setReqFormData({ ...reqFormData, note: e.target.value })}
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
