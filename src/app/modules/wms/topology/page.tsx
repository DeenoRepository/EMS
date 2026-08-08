"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { MapPin, Warehouse as WarehouseIcon, Plus, RefreshCw, Layers } from "lucide-react";
import { PageHeader, Modal, ModalHeader } from "@/components/ui";

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
          title="Адресный учет складов"
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
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#2565c8]"
              >
                <Plus size={14} /> Добавить ячейку
              </button>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {warehousesList.map((wh) => (
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
                        className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono font-semibold text-slate-700 shadow-2xs transition-colors hover:border-blue-300 hover:bg-blue-50"
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

        <Modal open={showAddCellModal} onClose={() => setShowAddCellModal(false)} size="md">
          <ModalHeader
            icon={<MapPin size={16} />}
            title="Новая ячейка адресного хранения"
            subtitle="Присвоение уникального кода ячейки складу"
            onClose={() => setShowAddCellModal(false)}
          />
          <form onSubmit={handleAddCell} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Склад *</label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              >
                {warehousesList.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Код ячейки *</label>
              <input
                required
                type="text"
                value={cellCode}
                onChange={(e) => setCellCode(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                placeholder="С-01-А3"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Описание / Стеллаж</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                placeholder="Стеллаж крупногабарита №1"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAddCellModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Добавить ячейку
              </button>
            </div>
          </form>
        </Modal>
      </main>
    </ShellLayout>
  );
}
