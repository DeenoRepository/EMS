"use client";

import { useState, useMemo } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  History,
  ArrowRightLeft,
  RefreshCw,
  FileSpreadsheet,
  PlusCircle
} from "lucide-react";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  KpiGrid,
  FilterToolbar
} from "@/components/ui";
import { useWmsMovements } from "@/lib/hooks/wms";
import { WmsMovement } from "@/types/wms";

export default function ConsolidatedWmsOperationsPage() {
  const { movements, warehouses, loading, refetch } = useWmsMovements();

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

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Аудит и Журнал движений ТМЦ"
          description="Полный регистрационный журнал (аудит-трейл) всех физических и системных операций с ТМЦ: приходы, перемещения, выдачи и акты списания."
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учет", href: "/modules/wms" },
            { title: "Аудит движений ТМЦ" }
          ]}
          actions={
            <button
              onClick={refetch}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-50"
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
                cell: (row: WmsMovement) => (
                  <span className="text-[11px] text-slate-500">
                    {new Date(row.createdAt).toLocaleString("ru-RU")}
                  </span>
                )
              },
              {
                key: "itemSku",
                header: "Артикул / Номенклатура",
                cell: (row: WmsMovement) => (
                  <div className="font-mono">
                    <span className="block text-[11px] font-bold text-[#3473d4]">
                      {row.itemName}
                    </span>
                    <span className="block text-[10px] text-slate-400">SKU: {row.itemSku}</span>
                  </div>
                )
              },
              {
                key: "type",
                header: "Тип операции",
                cell: (row: WmsMovement) => {
                  if (row.type === "INCOMING")
                    return <StatusBadge status="ACTIVE" label="Приход номенклатуры" />;
                  if (row.type === "TRANSFER")
                    return <StatusBadge status="PENDING" label="Перемещение" />;
                  if (row.type === "PERSONAL_CARD")
                    return <StatusBadge status="COMPLETED" label="Личная карточка" />;
                  return <StatusBadge status="DECOMMISSIONED" label="Списание" />;
                }
              },
              {
                key: "quantity",
                header: "Количество",
                cell: (row: WmsMovement) => (
                  <span
                    className={`text-[11px] font-bold ${
                      row.type === "INCOMING" ? "text-emerald-600" : "text-slate-800"
                    }`}
                  >
                    {row.type === "INCOMING" ? `+${row.quantity}` : `-${row.quantity}`}
                  </span>
                )
              },
              {
                key: "locations",
                header: "Маршрут (Ячейка / Оборудование)",
                cell: (row: WmsMovement) => (
                  <div className="text-[11px] text-slate-700 font-mono">
                    {row.fromLocation && <span>Из: {row.fromLocation}</span>}
                    {row.toLocation && (
                      <span className="block text-blue-600">В: {row.toLocation}</span>
                    )}
                    {row.relatedOrderOrEq && (
                      <span className="block text-amber-600 font-semibold">
                        Обор.: {row.relatedOrderOrEq}
                      </span>
                    )}
                  </div>
                )
              },
              {
                key: "performedBy",
                header: "Ответственный",
                cell: (row: WmsMovement) => (
                  <span className="text-[11px] text-slate-500">{row.performedBy}</span>
                )
              }
            ]}
          />
        </div>
      </main>
    </ShellLayout>
  );
}
