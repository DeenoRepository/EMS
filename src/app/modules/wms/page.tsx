"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  Warehouse,
  Box,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  ArrowRightLeft
} from "lucide-react";
import Link from "next/link";
import {
  PageHeader,
  KpiGrid,
  StatusBadge,
  DonutChart,
  BarChart,
  DataTable
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [itemsRes, movRes] = await Promise.all([
        fetch("/api/modules/wms/items"),
        fetch("/api/modules/wms/movements")
      ]);
      const itemsData = await itemsRes.json();
      const movData = await movRes.json();

      setItems(itemsData.items || []);
      setMovements(movData.movements || []);
    } catch (err) {
      console.error("Failed to load WMS data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalPositions = items.length;
  const totalUnits = items.reduce((acc, i) => acc + i.quantity, 0);
  const lowStockCount = items.filter((i) => i.status === "LOW_STOCK" || i.quantity <= i.minQuantity).length;
  const totalValue = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);

  const kpiItems = [
    {
      id: "total-pos",
      label: "Всего наименований",
      value: totalPositions,
      icon: <Box size={18} />,
      iconColor: "blue" as const
    },
    {
      id: "total-qty",
      label: "Суммарный остаток (ед.)",
      value: totalUnits,
      icon: <Warehouse size={18} />,
      iconColor: "emerald" as const
    },
    {
      id: "low-stock",
      label: "Дефицитные позиции",
      value: lowStockCount,
      icon: <AlertTriangle size={18} />,
      iconColor: "amber" as const
    },
    {
      id: "total-val",
      label: "Оценка запасов",
      value: `${totalValue.toLocaleString("ru-RU")} ₽`,
      icon: <TrendingUp size={18} />,
      iconColor: "indigo" as const
    }
  ];

  const statusChartData = [
    { label: "В наличии", value: items.filter((i) => i.status === "IN_STOCK").length, color: "#10b981" },
    { label: "Заканчивается", value: lowStockCount, color: "#f59e0b" },
    { label: "Отсутствует", value: items.filter((i) => i.status === "OUT_OF_STOCK").length, color: "#ef4444" },
  ];

  const warehouseMap = items.reduce((acc, i) => {
    acc[i.warehouse] = (acc[i.warehouse] || 0) + i.quantity;
    return acc;
  }, {} as Record<string, number>);

  const warehouseChartData = Object.entries(warehouseMap).map(([label, value]) => ({
    label,
    value,
    color: "#3b82f6"
  }));

  return (
    <ShellLayout>
      <div className="space-y-6">
        <PageHeader
          title="WMS Складской учет"
          description="Мониторинг складских остатков ТМЦ, управление ячейками и отслеживание движений"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                Обновить
              </button>
              <Link
                href="/modules/wms/items"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
              >
                <Box size={14} />
                Каталог ТМЦ
              </Link>
            </div>
          }
        />

        <KpiGrid items={kpiItems} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-[#162238]/60 p-5 shadow-sm">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-300">
              Состояние складских запасов
            </h3>
            {items.length > 0 ? (
              <DonutChart data={statusChartData} />
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">Нет данных о запасах</div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#162238]/60 p-5 shadow-sm">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-300">
              Распределение позиций по складам
            </h3>
            {warehouseChartData.length > 0 ? (
              <BarChart data={warehouseChartData} />
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">Нет сохраненных складов</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#162238]/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Последние складские операции</h3>
              <p className="text-xs text-slate-400">История приходов, списаний и перемещений</p>
            </div>
            <Link
              href="/modules/wms/movements"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300"
            >
              Смотреть все →
            </Link>
          </div>

          <DataTable
            keyExtractor={(row) => row.id}
            data={movements.slice(0, 5)}
            columns={[
              {
                key: "itemSku",
                header: "Артикул / ТМЦ",
                cell: (row) => (
                  <div>
                    <div className="font-semibold text-white">{row.itemName}</div>
                    <div className="text-[10px] text-slate-400">SKU: {row.itemSku}</div>
                  </div>
                ),
              },
              {
                key: "type",
                header: "Тип операции",
                cell: (row) => {
                  if (row.type === "INCOMING") {
                    return <StatusBadge status="ACTIVE" label="Приход (+)" />;
                  }
                  if (row.type === "OUTGOING" || row.type === "PERSONAL_CARD") {
                    return <StatusBadge status="DECOMMISSIONED" label="Списание (-)" />;
                  }
                  return <StatusBadge status="INACTIVE" label="Перемещение" />;
                },
              },
              {
                key: "quantity",
                header: "Количество",
                cell: (row) => <span className="font-semibold text-slate-200">{row.quantity}</span>,
              },
              {
                key: "fromLocation",
                header: "Локация / Ячейка",
                cell: (row) => (
                  <span className="text-slate-300">{row.fromLocation || "Основная"}</span>
                ),
              },
              {
                key: "performedBy",
                header: "Ответственный",
                cell: (row) => <span className="text-slate-400">{row.performedBy}</span>,
              },
            ]}
          />
        </div>
      </div>
    </ShellLayout>
  );
}
