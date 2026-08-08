"use client";

import { useState, useEffect, useMemo } from "react";
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
  ChevronDown,
  Trash2,
  Layers,
  Wrench,
  Check,
  BadgeCheck,
  PlusCircle,
  Search
} from "lucide-react";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Modal,
  ModalHeader,
  KpiGrid,
  FilterToolbar
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
  category?: string;
  quantity: number;
  warehouse: string;
  cell?: string;
}

interface EquipmentOption {
  id: string;
  equipmentCode: string;
  name: string;
}

// Multi-item Row Types with Nomenclature Matching State
interface InboundItemRow {
  id: string;
  selectedCatalogItemId: string; // Existing nomenclature ID if selected
  name: string;
  sku: string;
  category: string;
  warehouse: string;
  cell: string;
  quantity: number;
  isExisting: boolean;
}

interface TransferItemRow {
  id: string;
  itemId: string;
  quantity: number;
}

interface WriteOffItemRow {
  id: string;
  itemId: string;
  quantity: number;
}

export default function ConsolidatedWmsOperationsPage() {
  const [movements, setMovements] = useState<WmsMovement[]>([]);
  const [items, setItems] = useState<WmsItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [equipments, setEquipments] = useState<EquipmentOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (typeFilter !== "ALL" && m.type !== typeFilter) return false;
      if (
        warehouseFilter !== "ALL" &&
        m.fromLocation !== warehouseFilter &&
        m.toLocation !== warehouseFilter
      )
        return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          m.itemName.toLowerCase().includes(q) ||
          m.itemSku.toLowerCase().includes(q) ||
          (m.fromLocation && m.fromLocation.toLowerCase().includes(q)) ||
          (m.toLocation && m.toLocation.toLowerCase().includes(q)) ||
          (m.performedBy && m.performedBy.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [movements, query, typeFilter, warehouseFilter]);

  // KPI Statistics
  const kpiStats = useMemo(() => {
    const total = movements.length;
    const incomingCount = movements.filter((m) => m.type === "INCOMING").length;
    const transferCount = movements.filter((m) => m.type === "TRANSFER").length;
    const writeOffCount = movements.filter((m) => m.type === "OUTGOING").length;
    return { total, incomingCount, transferCount, writeOffCount };
  }, [movements]);
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Label Printing state
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printItemData, setPrintItemData] = useState<{ sku: string; name: string; location?: string; category?: string } | null>(null);

  // Multi-item Inbound Form State
  const [inboundRows, setInboundRows] = useState<InboundItemRow[]>([
    { id: "1", selectedCatalogItemId: "", name: "", sku: "", category: "Запчасти & Механика", warehouse: "", cell: "Яч-01", quantity: 1, isExisting: false }
  ]);

  // Multi-item Transfer Form State
  const [transferHeader, setTransferHeader] = useState({
    fromWarehouse: "",
    toWarehouse: "",
    reason: "Перемещение ТМЦ между складами МОЛ"
  });
  const [transferRows, setTransferRows] = useState<TransferItemRow[]>([
    { id: "1", itemId: "", quantity: 1 }
  ]);

  // Multi-item Write-Off Form State
  const [writeOffHeader, setWriteOffHeader] = useState({
    equipmentId: "",
    reason: "Плановый ремонт / обслуживание оборудования"
  });
  const [writeOffRows, setWriteOffRows] = useState<WriteOffItemRow[]>([
    { id: "1", itemId: "", quantity: 1 }
  ]);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/modules/wms/movements").then((r) => (r.ok ? r.json() : { movements: [] })),
      fetch("/api/modules/wms/items").then((r) => (r.ok ? r.json() : { items: [] })),
      fetch("/api/modules/wms/warehouses").then((r) => (r.ok ? r.json() : { warehouses: [] })),
      fetch("/api/modules/eps/equipment").then((r) => (r.ok ? r.json() : { equipment: [] }))
    ])
      .then(([movData, itemsData, whData, eqData]) => {
        setMovements(movData.movements || []);
        const loadedItems = itemsData.items || [];
        setItems(loadedItems);
        const whs = whData.warehouses || [];
        setWarehouses(whs);
        const eqList = (eqData.equipment || []).map((e: any) => ({
          id: e.id,
          equipmentCode: e.equipmentCode,
          name: e.name
        }));
        setEquipments(eqList);

        if (whs.length > 0) {
          setInboundRows((prev) => prev.map((r) => ({ ...r, warehouse: r.warehouse || whs[0].name })));
          setTransferHeader((prev) => ({
            ...prev,
            fromWarehouse: prev.fromWarehouse || whs[0].name,
            toWarehouse: prev.toWarehouse || (whs[1]?.name || whs[0].name)
          }));
        }

        if (loadedItems.length > 0) {
          setTransferRows((prev) => prev.map((r) => ({ ...r, itemId: r.itemId || loadedItems[0].id })));
          setWriteOffRows((prev) => prev.map((r) => ({ ...r, itemId: r.itemId || loadedItems[0].id })));
        }
      })
      .catch((err) => console.error("Movements fetch error:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter items available for selected source warehouse
  const sourceWarehouseItems = items.filter(
    (i) => !transferHeader.fromWarehouse || i.warehouse === transferHeader.fromWarehouse
  );

  const availableTargetWarehouses = warehouses.filter((w) => w.name !== transferHeader.fromWarehouse);
  const targetTransferWarehouseObj = warehouses.find((w) => w.name === transferHeader.toWarehouse);

  // Auto-fill nomenclature item when selected from catalog
  const handleSelectNomenclature = (rowId: string, catalogItemId: string) => {
    if (!catalogItemId) {
      setInboundRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? { ...r, selectedCatalogItemId: "", isExisting: false }
            : r
        )
      );
      return;
    }

    const catalogItem = items.find((i) => i.id === catalogItemId);
    if (catalogItem) {
      setInboundRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                selectedCatalogItemId: catalogItem.id,
                name: catalogItem.name,
                sku: catalogItem.sku,
                category: catalogItem.category || "Запчасти & Механика",
                warehouse: catalogItem.warehouse,
                cell: catalogItem.cell || "Яч-01",
                isExisting: true
              }
            : r
        )
      );
    }
  };

  // Row Adders & Removers
  const addInboundRow = () => {
    setInboundRows([
      ...inboundRows,
      { id: Date.now().toString(), selectedCatalogItemId: "", name: "", sku: "", category: "Запчасти & Механика", warehouse: warehouses[0]?.name || "", cell: "Яч-01", quantity: 1, isExisting: false }
    ]);
  };
  const removeInboundRow = (id: string) => {
    if (inboundRows.length > 1) setInboundRows(inboundRows.filter((r) => r.id !== id));
  };

  const addTransferRow = () => {
    const defaultItemId = sourceWarehouseItems[0]?.id || items[0]?.id || "";
    setTransferRows([...transferRows, { id: Date.now().toString(), itemId: defaultItemId, quantity: 1 }]);
  };
  const removeTransferRow = (id: string) => {
    if (transferRows.length > 1) setTransferRows(transferRows.filter((r) => r.id !== id));
  };

  const addWriteOffRow = () => {
    setWriteOffRows([...writeOffRows, { id: Date.now().toString(), itemId: items[0]?.id || "", quantity: 1 }]);
  };
  const removeWriteOffRow = (id: string) => {
    if (writeOffRows.length > 1) setWriteOffRows(writeOffRows.filter((r) => r.id !== id));
  };

  // Submit Handlers
  // 1. Multi-item Inbound Submit with Nomenclature Matching & Auto-creation
  const handleInboundBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const results = await Promise.all(
        inboundRows.map((r) =>
          fetch("/api/modules/wms/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: r.name,
              sku: r.sku,
              category: r.category || "Запчасти & Механика",
              type: "ZIP",
              warehouse: r.warehouse || warehouses[0]?.name || "Главный склад",
              cell: r.cell || "Яч-01",
              quantity: r.quantity,
              unit: "шт"
            })
          }).then((res) => (res.ok ? res.json() : null))
        )
      );

      if (results.every(Boolean)) {
        setShowInboundModal(false);
        setInboundRows([{ id: "1", selectedCatalogItemId: "", name: "", sku: "", category: "Запчасти & Механика", warehouse: warehouses[0]?.name || "", cell: "Яч-01", quantity: 1, isExisting: false }]);
        fetchData();
      } else {
        alert("Часть позиций не прошла обработку. Проверьте правильность заполнения полей.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Multi-item Transfer Submit
  const handleTransferBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const itemsPayload = transferRows.map((r) => ({
        itemId: r.itemId,
        type: "TRANSFER",
        quantity: r.quantity,
        fromLocation: transferHeader.fromWarehouse,
        toLocation: transferHeader.toWarehouse,
        reason: transferHeader.reason,
        performedBy: "Кладовщик"
      }));

      const res = await fetch("/api/modules/wms/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsPayload })
      });

      if (res.ok) {
        setShowTransferModal(false);
        setTransferRows([{ id: "1", itemId: items[0]?.id || "", quantity: 1 }]);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка проведения перемещения позиций");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Multi-item Write-Off Submit
  const handleWriteOffBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const selectedEqObj = equipments.find((e) => e.id === writeOffHeader.equipmentId);
      const itemsPayload = writeOffRows.map((r) => ({
        itemId: r.itemId,
        type: "OUTGOING",
        quantity: r.quantity,
        reason: writeOffHeader.reason,
        relatedOrderOrEq: selectedEqObj ? `${selectedEqObj.equipmentCode} (${selectedEqObj.name})` : writeOffHeader.equipmentId,
        performedBy: "Кладовщик"
      }));

      const res = await fetch("/api/modules/wms/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsPayload })
      });

      if (res.ok) {
        setShowWriteOffModal(false);
        setWriteOffRows([{ id: "1", itemId: items[0]?.id || "", quantity: 1 }]);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка списания позиций");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Аудит и Журнал движений ТМЦ"
          description="Полный регистрационный журнал (аудит-трейл) всех физических и системных операций с ТМЦ: приходы, перемещения, выдачи и акты списания."
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учет", href: "/modules/wms" },
            { title: "Аудит движений ТМЦ" },
          ]}
          actions={
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
            </button>
          }
        />

        <KpiGrid
          items={[
            {
              label: "Всего транзакций",
              value: kpiStats.total,
              sub: "Зафиксировано в аудит-трейле",
              subColor: "slate",
              icon: <History size={18} />,
              iconColor: "blue"
            },
            {
              label: "Приходы номенклатуры",
              value: kpiStats.incomingCount,
              sub: "Поступления на склады",
              subColor: "emerald",
              icon: <PlusCircle size={18} />,
              iconColor: "emerald"
            },
            {
              label: "Межскладские трансферы",
              value: kpiStats.transferCount,
              sub: "Перемещения между МОЛ",
              subColor: "slate",
              icon: <ArrowRightLeft size={18} />,
              iconColor: "indigo"
            },
            {
              label: "Списания по ТОИР",
              value: kpiStats.writeOffCount,
              sub: "Акты списания на ремонт",
              subColor: "rose",
              icon: <FileSpreadsheet size={18} />,
              iconColor: "rose"
            }
          ]}
        />

        <div className="space-y-4">
          <FilterToolbar
            searchQuery={query}
            onSearchChange={setQuery}
            searchPlaceholder="Поиск движений по названию ТМЦ, SKU, маршруту или ответственному..."
            filters={[
              {
                key: "type",
                label: "Тип операции",
                value: typeFilter,
                options: [
                  { label: "Все типы операций", value: "ALL" },
                  { label: "Приход номенклатуры", value: "INCOMING" },
                  { label: "Перемещение", value: "TRANSFER" },
                  { label: "Списание", value: "OUTGOING" },
                  { label: "Личная карточка", value: "PERSONAL_CARD" }
                ],
                onChange: setTypeFilter
              },
              {
                key: "warehouse",
                label: "Склад",
                value: warehouseFilter,
                options: [
                  { label: "Все склады", value: "ALL" },
                  ...warehouses.map((w) => ({ label: w.name, value: w.name }))
                ],
                onChange: setWarehouseFilter
              }
            ]}
          />

          <DataTable
            keyExtractor={(row) => row.id}
            data={filteredMovements}
            columns={[
              {
                key: "createdAt",
                header: "Дата / Время",
                cell: (row) => <span className="text-[11px] text-slate-500">{new Date(row.createdAt).toLocaleString("ru-RU")}</span>,
              },
              {
                key: "itemSku",
                header: "Артикул / Номенклатура",
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
                  if (row.type === "INCOMING") return <StatusBadge status="ACTIVE" label="Приход номенклатуры" />;
                  if (row.type === "TRANSFER") return <StatusBadge status="PENDING" label="Перемещение" />;
                  if (row.type === "PERSONAL_CARD") return <StatusBadge status="COMPLETED" label="Личная карточка" />;
                  return <StatusBadge status="DECOMMISSIONED" label="Списание" />;
                },
              },
              {
                key: "quantity",
                header: "Количество",
                cell: (row) => (
                  <span className={`text-[11px] font-bold ${row.type === "INCOMING" ? "text-emerald-600" : "text-slate-800"}`}>
                    {row.type === "INCOMING" ? `+${row.quantity}` : `-${row.quantity}`}
                  </span>
                ),
              },
              {
                key: "locations",
                header: "Маршрут (Ячейка / Оборудование)",
                cell: (row) => (
                  <div className="text-[11px] text-slate-700 font-mono">
                    {row.fromLocation && <span>Из: {row.fromLocation}</span>}
                    {row.toLocation && <span className="block text-blue-600">В: {row.toLocation}</span>}
                    {row.relatedOrderOrEq && <span className="block text-amber-600 font-semibold">Обор.: {row.relatedOrderOrEq}</span>}
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

        {/* MODAL 1: MULTI-ITEM INBOUND RECEIVING WITH NOMENCLATURE MATCHING */}
        <Modal open={showInboundModal} onClose={() => setShowInboundModal(false)} size="xl">
          <ModalHeader
            icon={<Plus size={16} />}
            title="Приход номенклатурных единиц"
            subtitle="Выбор из реестра номенклатуры (с подгрузкой данных) или авто-создание новых единиц"
            onClose={() => setShowInboundModal(false)}
          />
          <form onSubmit={handleInboundBatchSubmit} className="space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-semibold text-slate-700">
                Позиций в накладной прихода: <strong className="text-blue-600">{inboundRows.length}</strong>
              </span>
              <button
                type="button"
                onClick={addInboundRow}
                className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                <Plus size={13} /> Добавить позицию
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
              {inboundRows.map((row, idx) => (
                <div key={row.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
                  {/* Nomenclature Selector Header */}
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <div className="flex items-center gap-2 flex-1 mr-4">
                      <span className="text-xs font-bold text-slate-700"># {idx + 1}</span>
                      <select
                        value={row.selectedCatalogItemId}
                        onChange={(e) => handleSelectNomenclature(row.id, e.target.value)}
                        className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">-- Выберите существующую номенклатуру (или введите вручную) --</option>
                        {items.map((catItem) => (
                          <option key={catItem.id} value={catItem.id}>
                            {catItem.name} (SKU: {catItem.sku}) — Склад: {catItem.warehouse} (Остаток: {catItem.quantity})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      {row.isExisting ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                          <BadgeCheck size={12} /> Существующая номенклатура
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100">
                          <PlusCircle size={12} /> Новая номенклатура
                        </span>
                      )}

                      <button
                        type="button"
                        disabled={inboundRows.length <= 1}
                        onClick={() => removeInboundRow(row.id)}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Nomenclature Data Input Fields */}
                  <div className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-5">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Наименование ТМЦ *</label>
                      <input
                        required
                        type="text"
                        value={row.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInboundRows(inboundRows.map((r) => (r.id === row.id ? { ...r, name: val, selectedCatalogItemId: "", isExisting: false } : r)));
                        }}
                        placeholder="Манжета гидравлическая 50х70"
                        className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Артикул (SKU) *</label>
                      <input
                        required
                        type="text"
                        value={row.sku}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInboundRows(inboundRows.map((r) => (r.id === row.id ? { ...r, sku: val, selectedCatalogItemId: "", isExisting: false } : r)));
                        }}
                        placeholder="HYD-5070-01"
                        className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Склад *</label>
                      <select
                        value={row.warehouse}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInboundRows(inboundRows.map((r) => (r.id === row.id ? { ...r, warehouse: val } : r)));
                        }}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                      >
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.name}>{w.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Приход ед. *</label>
                      <input
                        required
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setInboundRows(inboundRows.map((r) => (r.id === row.id ? { ...r, quantity: val } : r)));
                        }}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-bold"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
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
                {submitting ? "Проведение..." : "Провести Приход номенклатуры"}
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL 2: MULTI-ITEM TRANSFER */}
        <Modal open={showTransferModal} onClose={() => setShowTransferModal(false)} size="xl">
          <ModalHeader
            icon={<ArrowRightLeft size={16} />}
            title="Мульти-позиционное Перемещение ТМЦ между складами"
            subtitle="Групповая передача товарно-материальных ценностей ответственным МОЛ"
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
                  {warehouses.map((w) => (
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
                  {availableTargetWarehouses.map((w) => (
                    <option key={w.id} value={w.name}>{w.name} (МОЛ: {w.responsibleUser})</option>
                  ))}
                </select>
              </div>
            </div>

            {targetTransferWarehouseObj && (
              <div className="rounded-lg bg-indigo-50/70 p-2.5 border border-indigo-100 text-xs text-indigo-900 flex items-center justify-between">
                <span>Автоматически определен МОЛ-приемщик: <strong className="text-indigo-700">{targetTransferWarehouseObj.responsibleUser}</strong></span>
                <span className="text-[10px] text-indigo-500">Запрос поступит на согласование</span>
              </div>
            )}

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

            <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
              {transferRows.map((row, idx) => (
                <div key={row.id} className="grid grid-cols-12 gap-3 items-center rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
                  <div className="col-span-8">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Выберите ТМЦ со склада отправителя #{idx + 1} *</label>
                    <select
                      value={row.itemId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTransferRows(transferRows.map((r) => (r.id === row.id ? { ...r, itemId: val } : r)));
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    >
                      {sourceWarehouseItems.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} (SKU: {i.sku}) — Доступно остаток: {i.quantity} {i.unit}
                        </option>
                      ))}
                    </select>
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
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? "Отправка..." : "Отправить на перемещение"}
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL 3: MULTI-ITEM WRITE-OFF / SCRAP */}
        <Modal open={showWriteOffModal} onClose={() => setShowWriteOffModal(false)} size="xl">
          <ModalHeader
            icon={<FileSpreadsheet size={16} />}
            title="Мульти-позиционное Списание ТМЦ на оборудование / Утиль"
            subtitle="Формирование акта списания позиций на техническое обслуживание и ремонт"
            onClose={() => setShowWriteOffModal(false)}
          />
          <form onSubmit={handleWriteOffBatchSubmit} className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Закрепленное оборудование ТОИР</label>
                <select
                  value={writeOffHeader.equipmentId}
                  onChange={(e) => setWriteOffHeader({ ...writeOffHeader, equipmentId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Общее списание / Без привязки к узлу --</option>
                  {equipments.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.equipmentCode} — {eq.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Основание / Причина списания</label>
                <input
                  type="text"
                  value={writeOffHeader.reason}
                  onChange={(e) => setWriteOffHeader({ ...writeOffHeader, reason: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-2 pt-2">
              <span className="text-xs font-semibold text-slate-700">Списываемые позиции ({writeOffRows.length}):</span>
              <button
                type="button"
                onClick={addWriteOffRow}
                className="flex items-center gap-1 rounded bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                <Plus size={13} /> Добавить позицию
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
              {writeOffRows.map((row, idx) => (
                <div key={row.id} className="grid grid-cols-12 gap-3 items-center rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
                  <div className="col-span-8">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Позиция ТМЦ #{idx + 1} *</label>
                    <select
                      value={row.itemId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setWriteOffRows(writeOffRows.map((r) => (r.id === row.id ? { ...r, itemId: val } : r)));
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    >
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} (SKU: {i.sku}) — Склад: {i.warehouse} (Доступно: {i.quantity} {i.unit})
                        </option>
                      ))}
                    </select>
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
                        setWriteOffRows(writeOffRows.map((r) => (r.id === row.id ? { ...r, quantity: val } : r)));
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-1 flex justify-center pt-4">
                    <button
                      type="button"
                      disabled={writeOffRows.length <= 1}
                      onClick={() => removeWriteOffRow(row.id)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
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
                disabled={submitting}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {submitting ? "Проведение..." : "Провести списание позиций"}
              </button>
            </div>
          </form>
        </Modal>

        {/* BARCODE PRINT MODAL */}
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
