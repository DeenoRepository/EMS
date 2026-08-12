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
  ChevronDown,
  Eye,
  Pencil,
  Warehouse,
} from "lucide-react";
import {
  PageHeader,
  KpiGrid,
  FilterToolbar,
  DataTable,
  StatusBadge,
  Button,
  Badge,
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
  RequisitionModal,
  ItemCardDetailsModal,
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
  const canEdit =
    Boolean(currentUser) &&
    (userRoles.includes("ADMIN") || userRoles.includes("STOREKEEPER"));

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");

  const { items, warehouses, requisitions, equipments, loading, refetch } = useWmsCatalog(query);

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);

  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedLabelItem, setSelectedLabelItem] = useState<WmsItem | null>(null);

  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedCardItem, setSelectedCardItem] = useState<WmsItem | null>(null);

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
      pendingRequisitionsCount,
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
    <div className="w-full px-4 py-6 md:px-8 space-y-6">
      <PageHeader
        title="Реестр ТМЦ & Операции склада"
        description="Каталог складских запасов с функцией запроса позиций со сторонних складов и уведомлениями для ответственных МОЛ."
        breadcrumbs={[{ title: "Главная", href: "/" }, { title: "WMS Складской учет" }]}
        icon={<Warehouse className="h-5 w-5" aria-hidden="true" />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              disabled={loading}
              loading={loading}
              loadingText="Обновление..."
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Обновить
            </Button>

            {canEdit && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowRequisitionModal(true)}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Запросить перемещение
                </Button>

                <div className="relative">
                  <Button
                    size="sm"
                    onClick={() => setActionMenuOpen((prev) => !prev)}
                    aria-expanded={actionMenuOpen}
                    aria-haspopup="menu"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Оформить операцию
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${actionMenuOpen ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </Button>

                  {actionMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-[var(--z-dropdown)]"
                        onClick={() => setActionMenuOpen(false)}
                        aria-hidden="true"
                      />
                      <div
                        role="menu"
                        className="absolute right-0 top-full mt-2 z-[var(--z-popover)] w-64 rounded-xl border border-border bg-card p-2 shadow-xl space-y-1"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setActionMenuOpen(false);
                            setShowCreateItemModal(true);
                          }}
                          className="group flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Plus className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              Оформить Приход
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Поступление / Создание ТМЦ
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setActionMenuOpen(false);
                            setShowTransferModal(true);
                          }}
                          className="group flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              Перемещение ТМЦ
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Трансфер между складами
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setActionMenuOpen(false);
                            setShowWriteOffModal(true);
                          }}
                          className="group flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              Списать ТМЦ
                            </div>
                            <div className="text-xs text-muted-foreground">
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
            icon: <Box className="h-4 w-4" aria-hidden="true" />,
            iconColor: "blue",
          },
          {
            label: "Дефицитные позиции",
            value: kpiStats.lowStockCount,
            sub: kpiStats.lowStockCount > 0 ? "Требуется заказ снабжению" : "Запасы в норме",
            subColor: kpiStats.lowStockCount > 0 ? "rose" : "emerald",
            icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
            iconColor: kpiStats.lowStockCount > 0 ? "rose" : "emerald",
          },
          {
            label: "Неснижаемый ЗИП (EPS)",
            value: kpiStats.epsCount,
            sub: "Контроль критических запчастей",
            subColor: "emerald",
            icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
            iconColor: "emerald",
          },
          {
            label: "Запросы на перемещение",
            value: kpiStats.pendingRequisitionsCount,
            sub:
              kpiStats.pendingRequisitionsCount > 0
                ? "Требуется согласование МОЛ"
                : "Нет новых запросов",
            subColor: kpiStats.pendingRequisitionsCount > 0 ? "amber" : "slate",
            icon: <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />,
            iconColor: kpiStats.pendingRequisitionsCount > 0 ? "amber" : "blue",
          },
        ]}
      />

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
              ...categories.map((c) => ({ label: c, value: c })),
            ],
            onChange: setCategoryFilter,
          },
          {
            key: "warehouse",
            label: "Склад",
            value: warehouseFilter,
            options: [
              { label: "Все склады", value: "ALL" },
              ...warehouses.map((w) => ({ label: w.name, value: w.name })),
            ],
            onChange: setWarehouseFilter,
          },
        ]}
      />

      <DataTable
        selectable
        selectedIds={selectedItemIds}
        onSelectionChange={(ids) => setSelectedItemIds(ids.map(String))}
        columns={[
          {
            key: "sku",
            header: "Артикул / Партия",
            sortable: true,
            cell: (row: WmsItem) => (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-primary">
                  {row.sku}
                  {row.isEps && (
                    <Badge variant="warning" className="text-[10px]">
                      EPS
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.batchNumber ? `Партия: ${row.batchNumber}` : ""}{" "}
                  {row.serialNumber ? `S/N: ${row.serialNumber}` : ""}
                </div>
              </div>
            ),
          },
          {
            key: "name",
            header: "Наименование ТМЦ",
            sortable: true,
            cell: (row: WmsItem) => (
              <div>
                <div className="font-semibold text-sm text-foreground">{row.name}</div>
                <div className="text-xs text-muted-foreground">
                  {row.category} ({row.type})
                </div>
              </div>
            ),
          },
          {
            key: "location",
            header: "Склад & Ячейка",
            cell: (row: WmsItem) => (
              <div className="flex items-center gap-1 text-sm font-mono text-foreground">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <span>{row.warehouse}</span>
                <span className="text-muted-foreground font-bold">/</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                  {row.cell || "Обустройство"}
                </span>
              </div>
            ),
          },
          {
            key: "quantity",
            header: "Остаток / Запас",
            cell: (row: WmsItem) => (
              <div>
                <div className="font-bold text-sm text-foreground">
                  {row.quantity} {row.unit}
                  {row.reservedQuantity > 0 && (
                    <span className="ml-1 text-xs text-warning font-medium">
                      (Резерв: {row.reservedQuantity})
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Min: {row.minQuantity}</div>
              </div>
            ),
          },
          {
            key: "status",
            header: "Статус",
            cell: (row: WmsItem) => {
              const isLow = row.quantity <= row.minQuantity;
              return (
                <StatusBadge
                  status={isLow ? "LOW_STOCK" : "IN_STOCK"}
                  label={isLow ? "Низкий остаток" : "В наличии"}
                />
              );
            },
          },
          {
            key: "actions",
            header: "Действия",
            align: "right",
            cell: (row: WmsItem) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setSelectedCardItem(row);
                    setShowCardModal(true);
                  }}
                  title="Карточка ТМЦ"
                  aria-label="Просмотр карточки"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                </Button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEditModal(row)}
                    title="Редактировать"
                    aria-label="Редактировать позицию"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setSelectedLabelItem(row);
                    setShowLabelModal(true);
                  }}
                  title="Печать этикетки"
                  aria-label="Печать этикетки"
                >
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ),
          },
        ]}
        data={filteredItems}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyText="ТМЦ не найдены"
        emptyDescription="Попробуйте изменить параметры фильтрации или добавьте новые позиции"
        emptyVariant="no-data"
      />

      {/* MODAL: ITEM CARD PREVIEW */}
      <ItemCardDetailsModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        item={selectedCardItem}
        onEdit={openEditModal}
      />

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
    </div>
  );
}
