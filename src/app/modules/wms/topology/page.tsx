"use client";

import { useState, useEffect, useMemo } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  MapPin,
  Warehouse as WarehouseIcon,
  Plus,
  RefreshCw,
  Layers,
  Search,
  CheckCircle2,
  Box,
  SlidersHorizontal
} from "lucide-react";
import {
  PageHeader,
  KpiGrid,
  DataTable,
  StatusBadge,
  Modal,
  ModalHeader,
  FilterToolbar
} from "@/components/ui";
import { AddCellModal } from "@/components/wms/modals";


interface StorageCell {
  id: string;
  code: string;
  description?: string;
  capacity?: number;
}

interface WmsZone {
  id: string;
  code: string;
  name: string;
  cells?: StorageCell[];
}

interface Warehouse {
  id: string;
  name: string;
  responsibleUser: string;
  zones?: WmsZone[];
  storageCells: StorageCell[];
}

export default function WmsTopologyPage() {
  const [warehousesList, setWarehousesList] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [showAddCellModal, setShowAddCellModal] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [cellCode, setCellCode] = useState("");
  const [description, setDescription] = useState("");

  const fetchTopology = () => {
    setLoading(true);
    fetch("/api/modules/wms/warehouses")
      .then((res) => (res.ok ? res.json() : { warehouses: [] }))
      .then((data) => {
        const whs = data.warehouses || [];
        setWarehousesList(whs);
        if (whs.length > 0) setSelectedWarehouseId(whs[0].id);
      })
      .catch((err) => console.error("Topology query error:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTopology();
  }, []);

  const kpiStats = useMemo(() => {
    const totalWarehouses = warehousesList.length;
    const totalCells = warehousesList.reduce((acc, w) => acc + (w.storageCells?.length || 0), 0);
    const totalMols = Array.from(new Set(warehousesList.map((w) => w.responsibleUser))).length;
    return { totalWarehouses, totalCells, totalMols };
  }, [warehousesList]);

  const filteredWarehouses = useMemo(() => {
    return warehousesList.filter((wh) => {
      if (warehouseFilter !== "ALL" && wh.id !== warehouseFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesWh = wh.name.toLowerCase().includes(q) || wh.responsibleUser.toLowerCase().includes(q);
        const matchesCell = wh.storageCells?.some(
          (c) => c.code.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q))
        );
        return matchesWh || matchesCell;
      }
      return true;
    });
  }, [warehousesList, warehouseFilter, searchQuery]);

  const allCellsList = useMemo(() => {
    const list: { id: string; code: string; description?: string; warehouseName: string; responsibleUser: string }[] = [];
    warehousesList.forEach((wh) => {
      (wh.storageCells || []).forEach((c) => {
        list.push({
          id: c.id,
          code: c.code,
          description: c.description,
          warehouseName: wh.name,
          responsibleUser: wh.responsibleUser
        });
      });
    });
    return list.filter((c) => {
      if (warehouseFilter !== "ALL") {
        const whObj = warehousesList.find((w) => w.id === warehouseFilter);
        if (whObj && c.warehouseName !== whObj.name) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.code.toLowerCase().includes(q) ||
          c.warehouseName.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [warehousesList, warehouseFilter, searchQuery]);

  const handleAddCell = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/modules/wms/bins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_cell",
          warehouseId: selectedWarehouseId,
          code: cellCode,
          description
        })
      });
      if (res.ok) {
        setShowAddCellModal(false);
        setCellCode("");
        setDescription("");
        fetchTopology();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при добавлении ячейки");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Адресный учет складов & Топология ячеек"
          description="Управление стеллажами, зонами и динамическими ячейками хранения (Bins) по складам предприятия."
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учет", href: "/modules/wms" },
            { title: "Адресный учет" }
          ]}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={fetchTopology}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
              </button>
              <button
                onClick={() => setShowAddCellModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
              >
                <Plus size={14} /> Добавить ячейку
              </button>
            </div>
          }
        />

        <KpiGrid
          items={[
            {
              label: "Складов в топологии",
              value: kpiStats.totalWarehouses,
              sub: "Складских комплексов",
              subColor: "slate",
              icon: <WarehouseIcon size={18} />,
              iconColor: "blue"
            },
            {
              label: "Конфигурировано ячеек",
              value: kpiStats.totalCells,
              sub: "Адресных ячеек хранения (Bins)",
              subColor: "emerald",
              icon: <MapPin size={18} />,
              iconColor: "emerald"
            },
            {
              label: "Ответственных МОЛ",
              value: kpiStats.totalMols,
              sub: "Закрепленных кладовщиков",
              subColor: "slate",
              icon: <Layers size={18} />,
              iconColor: "indigo"
            }
          ]}
        />

        <FilterToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Поиск по коду ячейки (напр. С-01-А3), стеллажу, складу, МОЛ..."
          filters={[
            {
              key: "warehouse",
              label: "Склад",
              value: warehouseFilter,
              options: [
                { label: "Все склады", value: "ALL" },
                ...warehousesList.map((w) => ({ label: w.name, value: w.id }))
              ],
              onChange: setWarehouseFilter
            }
          ]}
        />

        {/* TOPOLOGY WAREHOUSE CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredWarehouses.map((wh) => (
            <div key={wh.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <WarehouseIcon className="text-blue-600" size={18} />
                  <h3 className="font-bold text-slate-900 text-sm">{wh.name}</h3>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                  МОЛ: {wh.responsibleUser}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Конфигурировано ячеек:</span>
                  <span className="font-bold text-slate-900">{wh.storageCells?.length || 0}</span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {wh.storageCells?.length > 0 ? (
                    wh.storageCells.map((cell) => (
                      <div
                        key={cell.id}
                        className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono font-semibold text-slate-700 shadow-2xs transition-colors hover:border-blue-300 hover:bg-blue-50 cursor-pointer"
                        title={cell.description || `Ячейка ${cell.code}`}
                      >
                        <MapPin size={12} className="text-blue-500" />
                        {cell.code}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 italic">Ячейки адресации пока не заданы</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* DETAILED STORAGE BINS REPOSITORY TABLE */}
        <div className="space-y-3 pt-2">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Layers size={16} className="text-blue-600" /> Реестр ячеек адресного хранения (Bins)
          </h3>

          <DataTable
            columns={[
              {
                key: "code",
                header: "Код ячейки",
                cell: (row) => (
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-blue-700 border border-blue-100">
                      {row.code}
                    </span>
                  </div>
                )
              },
              {
                key: "warehouseName",
                header: "Склад",
                cell: (row) => (
                  <span className="font-semibold text-slate-900 text-xs">{row.warehouseName}</span>
                )
              },
              {
                key: "description",
                header: "Описание / Стеллаж",
                cell: (row) => (
                  <span className="text-xs text-slate-600">{row.description || "Стандартная ячейка"}</span>
                )
              },
              {
                key: "responsibleUser",
                header: "Ответственный МОЛ",
                cell: (row) => (
                  <span className="text-xs font-medium text-slate-700">{row.responsibleUser}</span>
                )
              },
              {
                key: "status",
                header: "Статус ячейки",
                cell: () => (
                  <StatusBadge status="ACTIVE" label="Активна" />
                )
              }
            ]}
            data={allCellsList}
            keyExtractor={(row) => row.id}
          />
        </div>

        {/* ADD CELL MODAL */}
        <AddCellModal
          isOpen={showAddCellModal}
          onClose={() => setShowAddCellModal(false)}
          onSuccess={fetchTopology}
          warehouses={warehousesList as any}
          initialWarehouseId={selectedWarehouseId}
        />


      </main>
    </ShellLayout>
  );
}
