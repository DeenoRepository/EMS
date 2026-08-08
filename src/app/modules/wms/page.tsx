"use client";

import { useState, useEffect, useMemo } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  Warehouse as WarehouseIcon,
  Box,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Plus,
  ChevronRight,
  Layers,
  CheckCircle2,
  AlertCircle,
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft
} from "lucide-react";
import Link from "next/link";
import {
  PageHeader,
  KpiGrid,
  Modal,
  ModalHeader,
  FilterToolbar,
  DataTable,
  StatusBadge,
} from "@/components/ui";

interface WmsItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  warehouse: string;
  cell: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  unitPrice: number;
  currency: string;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "OVERSTOCKED";
}

interface WmsMovement {
  id: string;
  itemSku: string;
  itemName: string;
  type: string;
  quantity: number;
  fromLocation: string | null;
  toLocation: string | null;
  performedBy: string;
  createdAt: string;
}

export default function WmsDashboardPage() {
  const [items, setItems] = useState<WmsItem[]>([]);
  const [movements, setMovements] = useState<WmsMovement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/modules/wms/items").then((res) => (res.ok ? res.json() : { items: [] })),
      fetch("/api/modules/wms/movements").then((res) => (res.ok ? res.json() : { movements: [] }))
    ])
      .then(([itemsData, movData]) => {
        setItems(itemsData.items || []);
        setMovements(movData.movements || []);
      })
      .catch((err) => console.error("Failed to load WMS data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const kpiStats = useMemo(() => {
    const totalPositions = items.length;
    const totalUnits = items.reduce((acc, i) => acc + i.quantity, 0);
    const lowStockCount = items.filter((i) => i.status === "LOW_STOCK" || i.quantity <= i.minQuantity).length;
    const totalValue = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
    return { totalPositions, totalUnits, lowStockCount, totalValue };
  }, [items]);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Page Header matching EPS style */}
        <PageHeader
          title="Дашборд Склада WMS"
          description="Оперативный складской учет ТМЦ, мониторинг остатков и контрольные показатели"
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учет" },
          ]}
          actions={
            <>
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
              </button>
              <Link
                href="/modules/wms/items"
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
              >
                <Box size={14} /> Каталог ТМЦ
              </Link>
            </>
          }
        />

        {/* Quick KPI Summary Cards matching EPS style */}
        <KpiGrid
          items={[
            {
              label: "Всего наименований",
              value: kpiStats.totalPositions,
              icon: <Box size={14} />,
              iconColor: "blue",
              sub: "Артикулов в каталоге",
            },
            {
              label: "Суммарный остаток",
              value: kpiStats.totalUnits,
              icon: <WarehouseIcon size={14} />,
              iconColor: "emerald",
              sub: "Единиц на хранении",
              subColor: "emerald",
            },
            {
              label: "Дефицитные позиции",
              value: kpiStats.lowStockCount,
              icon: <AlertTriangle size={14} />,
              iconColor: "amber",
              sub: "Требуют пополнения",
              subColor: "amber",
            },
            {
              label: "Оценка запасов",
              value: `${kpiStats.totalValue.toLocaleString("ru-RU")} ₽`,
              icon: <TrendingUp size={14} />,
              iconColor: "indigo",
              sub: "Балансовая стоимость",
            },
          ]}
        />

        {/* Catalog Preview Table matching EPS DataTable design */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-bold text-[#17243a]">Последние складские операции</h3>
              <p className="text-[11px] text-slate-400">История регистраций, списаний и перемещений ТМЦ</p>
            </div>
            <Link
              href="/modules/wms/movements"
              className="text-[11px] font-semibold text-[#3473d4] hover:text-blue-700"
            >
              Все движения <ChevronRight size={11} className="inline" />
            </Link>
          </div>

          <DataTable
            keyExtractor={(row) => row.id}
            data={movements.slice(0, 5)}
            columns={[
              {
                key: "itemSku",
                header: "Артикул (SKU)",
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
                cell: (row) => <span className="text-[11px] font-semibold text-slate-700">{row.quantity}</span>,
              },
              {
                key: "fromLocation",
                header: "Локация / Ячейка",
                cell: (row) => <span className="text-[11px] text-slate-600">{row.fromLocation || "Основная"}</span>,
              },
              {
                key: "performedBy",
                header: "Ответственный",
                cell: (row) => <span className="text-[11px] text-slate-500">{row.performedBy}</span>,
              },
            ]}
          />
        </div>
      </main>
    </ShellLayout>
  );
}
