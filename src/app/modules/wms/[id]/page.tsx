"use client";

import { useState, useEffect, use } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { WmsItem, WmsMovement } from "@/lib/modules/wms-store";
import {
  ChevronRight,
  Box,
  Printer,
  History,
  Building2,
  Tag,
  Edit,
  Download,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import WmsItemForm from "@/components/wms/wms-item-form";
import {
  PageHeader,
  KpiGrid,
  TabNav,
  StatusBadge,
  Modal,
  ModalHeader,
  DataTable,
} from "@/components/ui";

function WmsItemDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const itemId = resolvedParams.id;

  const [items, setItems] = useState<WmsItem[]>([]);
  const [movements, setMovements] = useState<WmsMovement[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"passport" | "movements">("passport");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isSubscribed = true;
    Promise.all([
      fetch("/api/modules/wms/items"),
      fetch("/api/modules/wms/movements"),
    ])
      .then(async ([resItems, resMov]) => {
        if (!isSubscribed) return;
        if (resItems.ok) {
          const dItems = await resItems.json();
          if (dItems.items) setItems(dItems.items);
        }
        if (resMov.ok) {
          const dMov = await resMov.json();
          if (dMov.movements) setMovements(dMov.movements);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isSubscribed) setLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  const fetchItems = () => {
    fetch("/api/modules/wms/items")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setItems(data.items || []))
      .catch(() => {});
  };

  const item = items.find((i) => i.id === itemId);
  const itemMovements = movements.filter((m) => m.itemSku === item?.sku || m.itemName === item?.name);

  if (loading) {
    return (
      <ShellLayout>
        <main className="w-full px-5 py-6 md:px-8 text-center text-slate-400">
          Загрузка карточки ТМЦ…
        </main>
      </ShellLayout>
    );
  }

  if (!item) {
    return (
      <ShellLayout>
        <main className="w-full px-5 py-6 md:px-8 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-[12px] text-slate-400 space-y-3">
            <AlertCircle size={36} className="mx-auto text-slate-300" />
            <p className="font-semibold text-slate-700 text-sm">Карточка ТМЦ не найдена</p>
            <p className="text-slate-500">Проверьте корректность SKU или вернитесь в реестр.</p>
            <div className="pt-2">
              <Link
                href="/modules/wms"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                <ArrowLeft size={13} /> Вернуться в реестр WMS
              </Link>
            </div>
          </div>
        </main>
      </ShellLayout>
    );
  }

  const wmsColorMap = {
    IN_STOCK: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
    LOW_STOCK: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
    OUT_OF_STOCK: { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
    OVERSTOCKED: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-400", dot: "bg-[#3473d4]" },
  };

  const wmsStatusLabels: Record<string, string> = {
    IN_STOCK: "В наличии",
    LOW_STOCK: "Дефицит",
    OUT_OF_STOCK: "Отсутствует",
    OVERSTOCKED: "Избыток",
  };

  const movementColumns = [
    {
      key: "timestamp",
      header: "Дата",
      cell: (m: WmsMovement) => <span className="font-mono text-slate-700 dark:text-slate-300">{new Date(m.timestamp).toLocaleString("ru-RU")}</span>,
    },
    {
      key: "type",
      header: "Тип",
      cell: (m: WmsMovement) => <StatusBadge status={m.type} label={m.type} />,
    },
    {
      key: "quantity",
      header: "Количество",
      cell: (m: WmsMovement) => (
        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
          {m.type === "INCOMING" ? "+" : m.type === "OUTGOING" ? "-" : ""}
          {m.quantity} {(m as any).unit || "ед."}
        </span>
      ),
    },
    {
      key: "performedBy",
      header: "Исполнитель",
      cell: (m: WmsMovement) => <span className="text-slate-600 dark:text-slate-400">{m.performedBy}</span>,
    },
  ];

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title={item.name}
          description={`SKU: ${item.sku} • Склад: ${item.warehouse} (Ячейка ${item.cell || "—"})`}
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учёт", href: "/modules/wms" },
            { title: item.sku },
          ]}
          actions={
            <>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Printer size={13} /> Печать этикетки
              </button>
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white hover:bg-[#2565c8]"
              >
                <Edit size={13} /> Редактировать ТМЦ
              </button>
            </>
          }
        />

        <KpiGrid
          items={[
            { label: "Текущий остаток", value: `${item.quantity} ${item.unit}`, icon: <Box size={14} />, iconColor: "blue", sub: "Фактический баланс" },
            { label: "Зарезервировано", value: `${item.reservedQuantity} ${item.unit}`, icon: <History size={14} />, iconColor: "amber", sub: "Под наряды / ремонт", subColor: "amber" },
            { label: "Цена за единицу", value: `${item.unitPrice.toLocaleString("ru-RU")} ₽`, icon: <Tag size={14} />, iconColor: "emerald", sub: "Балансовая стоимость" },
            { label: "Общая стоимость", value: `${(item.quantity * item.unitPrice).toLocaleString("ru-RU")} ₽`, icon: <Building2 size={14} />, iconColor: "indigo", sub: "Сумма по номенклатуре" },
          ]}
        />

        <TabNav
          items={[
            { id: "passport", label: "Паспорт & Спецификация" },
            { id: "movements", label: "Движения по позиции", badge: itemMovements.length },
          ]}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as "passport" | "movements")}
        />

        {activeTab === "passport" ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Параметры хранения и статус</h3>
              <StatusBadge status={item.status} label={wmsStatusLabels[item.status]} colorMap={wmsColorMap} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block">МОЛ / Ответственный:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{item.responsibleUser}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Поставщик:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{item.supplier || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Минимальный остаток:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{item.minQuantity} {item.unit}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Максимальный остаток:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{item.maxQuantity} {item.unit}</span>
              </div>
            </div>

            {item.description && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block text-xs">Описание & Примечание:</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{item.description}</p>
              </div>
            )}
          </div>
        ) : (
          <DataTable
            columns={movementColumns}
            data={itemMovements}
            keyExtractor={(m) => m.id}
            emptyText="Движений по данной номенклатуре пока не зафиксировано."
          />
        )}

        <Modal open={showEditModal} onClose={() => setShowEditModal(false)} size="lg">
          <ModalHeader
            icon={<Box size={16} />}
            title="Редактирование ТМЦ"
            subtitle={`SKU: ${item.sku}`}
            onClose={() => setShowEditModal(false)}
          />
          <WmsItemForm
            initialData={item}
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            onSubmitSuccess={() => {
              setShowEditModal(false);
              fetchItems();
            }}
            existingItems={items}
          />
        </Modal>
      </main>
    </ShellLayout>
  );
}

export default WmsItemDetailContent;
