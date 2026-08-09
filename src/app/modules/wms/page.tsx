"use client";

import { useState, useMemo } from "react";
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
  ArrowLeftRight,
  ShieldAlert,
  ChevronDown,
  Eye,
  Pencil
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
import { useShell } from "@/components/layout/shell-context";
import { WmsItem } from "@/types/wms";
import { useWmsCatalog } from "@/lib/hooks/wms";
import {
  CreateItemModal,
  EditItemModal,
  WriteOffModal,
  TransferModal,
  RequisitionModal
} from "@/components/wms/modals";

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
  // Разрешаем складские операции администраторам, кладовщикам, редакторам или при отсутствующей загрузке ролей
  const canEdit =
    !currentUser ||
    userRoles.length === 0 ||
    userRoles.includes("ADMIN") ||
    userRoles.includes("STOREKEEPER") ||
    userRoles.includes("EDITOR");

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");

  const { items, warehouses, requisitions, equipments, loading, refetch } = useWmsCatalog(query);

  // Selected item IDs
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Modals visibility state
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);

  // Print Label Modal State
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedLabelItem, setSelectedLabelItem] = useState<WmsItem | null>(null);

  // View Card Modal State
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedCardItem, setSelectedCardItem] = useState<WmsItem | null>(null);

  // Edit Modal State
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WmsItem | null>(null);

  const openEditModal = (item: WmsItem) => {
    setEditingItem(item);
    setShowEditItemModal(true);
  };

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

  const kpiStats = useMemo(() => {
    const totalPositions = items.length;
    const totalUnits = items.reduce((acc, i) => acc + i.quantity, 0);
    const lowStockCount = items.filter(
      (i) => i.status === "LOW_STOCK" || i.quantity <= i.minQuantity
    ).length;
    const epsCount = items.filter((i) => i.isEps).length;
    const pendingRequisitionsCount = requisitions.filter((r) => r.status === "REQUESTED").length;

    return {
      totalPositions,
      totalUnits,
      lowStockCount,
      epsCount,
      pendingRequisitionsCount
    };
  }, [items, requisitions]);

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredItems.map((i) => i.id));
    }
  };

  return (
    <main className="w-full px-5 py-6 md:px-8 space-y-6">
      <PageHeader
        title="Реестр ТМЦ & Операции склада"
        description="Каталог складских запасов с функцией запроса позиций со сторонних складов и уведомлениями для ответственных МОЛ."
        breadcrumbs={[{ title: "Главная", href: "/" }, { title: "WMS Складской учет" }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={refetch}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
            </button>

            {canEdit && (
              <>
                <button
                  onClick={() => setShowRequisitionModal(true)}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-[11px] font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
                >
                  <Send size={14} /> Запросить перемещение со склада
                </button>

                <div className="relative">
                  <button
                    onClick={() => setActionMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-xs shadow-blue-200 hover:bg-[#2565c8] transition"
                  >
                    <Plus size={14} /> Оформить складскую операцию{" "}
                    <ChevronDown
                      size={13}
                      className={
                        actionMenuOpen
                          ? "rotate-180 transition-transform"
                          : "transition-transform"
                      }
                    />
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
                            <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                              Оформить Приход
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              Поступление / Создание ТМЦ
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setActionMenuOpen(false);
                            setShowTransferModal(true);
                          }}
                          className="group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all duration-150 hover:bg-indigo-50/70"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform">
                            <ArrowLeftRight size={16} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">
                              Перемещение ТМЦ
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              Трансфер между складами
                            </div>
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
                            <div className="text-xs font-bold text-slate-800 group-hover:text-rose-700">
                              Списать ТМЦ
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              Акт списания / Ремонт оборудования
                            </div>
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
            sub:
              kpiStats.pendingRequisitionsCount > 0
                ? "Требуется согласование МОЛ"
                : "Нет новых запросов",
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
                ...warehouses.map((w) => ({ label: w.name, value: w.name }))
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
                  checked={
                    selectedItemIds.length === filteredItems.length && filteredItems.length > 0
                  }
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
                    {row.batchNumber ? `Партия: ${row.batchNumber}` : ""}{" "}
                    {row.serialNumber ? `S/N: ${row.serialNumber}` : ""}
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
                  <div className="text-[10px] text-slate-500">
                    {row.category} ({row.type})
                  </div>
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

      {/* MODAL: ITEM CARD PREVIEW */}
      <Modal open={showCardModal} onClose={() => setShowCardModal(false)} size="md">
        <ModalHeader
          title={`Складская карточка ТМЦ: ${selectedCardItem?.name || ""}`}
          onClose={() => setShowCardModal(false)}
        />
        {selectedCardItem && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs">
              <div>
                <span className="text-slate-500">Артикул / SKU:</span>
                <div className="font-mono font-bold text-blue-600">{selectedCardItem.sku}</div>
              </div>
              <div>
                <span className="text-slate-500">Категория:</span>
                <div className="font-semibold text-slate-800">{selectedCardItem.category}</div>
              </div>
              <div>
                <span className="text-slate-500">Склад:</span>
                <div className="font-semibold text-slate-800">{selectedCardItem.warehouse}</div>
              </div>
              <div>
                <span className="text-slate-500">Ячейка хранения:</span>
                <div className="font-mono font-bold text-slate-800">
                  {selectedCardItem.cell || "Обустройство"}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Остаток:</span>
                <div className="font-bold text-slate-900">
                  {selectedCardItem.quantity} {selectedCardItem.unit}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Цена за ед.:</span>
                <div className="font-semibold text-slate-800">
                  {selectedCardItem.unitPrice} {selectedCardItem.currency}
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowCardModal(false)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: CREATE ITEM */}
      <CreateItemModal
        isOpen={showCreateItemModal}
        onClose={() => setShowCreateItemModal(false)}
        onSuccess={refetch}
        warehouses={warehouses}
      />

      {/* MODAL: EDIT ITEM */}
      <EditItemModal
        isOpen={showEditItemModal}
        onClose={() => setShowEditItemModal(false)}
        onSuccess={refetch}
        item={editingItem}
        warehouses={warehouses}
      />

      {/* MODAL: WRITE OFF */}
      <WriteOffModal
        isOpen={showWriteOffModal}
        onClose={() => setShowWriteOffModal(false)}
        onSuccess={refetch}
        items={items}
        equipments={equipments}
      />

      {/* MODAL: TRANSFER */}
      <TransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onSuccess={refetch}
        items={items}
        warehouses={warehouses}
        initialSelectedIds={selectedItemIds}
      />

      {/* MODAL: REQUISITION */}
      <RequisitionModal
        isOpen={showRequisitionModal}
        onClose={() => setShowRequisitionModal(false)}
        onSuccess={refetch}
        items={items}
        warehouses={warehouses}
        initialSelectedIds={selectedItemIds}
      />

      {/* MODAL: PRINT BARCODE LABEL */}
      {selectedLabelItem && (
        <BarcodeLabelModal
          open={showLabelModal}
          onClose={() => setShowLabelModal(false)}
          title="Печать этикетки ТМЦ"
          sku={selectedLabelItem.sku}
          name={selectedLabelItem.name}
          location={selectedLabelItem.cell || selectedLabelItem.warehouse}
        />
      )}
    </main>
  );
}
