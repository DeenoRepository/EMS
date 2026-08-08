"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { Wrench, ShieldAlert, Plus, RefreshCw } from "lucide-react";
import { PageHeader, DataTable, StatusBadge, Modal, ModalHeader } from "@/components/ui";

interface WmsItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  reservedQuantity: number;
  isEps: boolean;
}

interface WmsReservation {
  id: string;
  itemId: string;
  equipmentId?: string;
  equipmentName?: string;
  maintenancePlanDate?: string;
  reservedQuantity: number;
  reservedBy: string;
  reason?: string;
  item?: WmsItem;
}

export default function WmsToirEpsPage() {
  const [items, setItems] = useState<WmsItem[]>([]);
  const [reservations, setReservations] = useState<WmsReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReserveModal, setShowReserveModal] = useState(false);

  const [reserveFormData, setReserveFormData] = useState({
    itemId: "",
    equipmentName: "Генератор ГД-250",
    maintenancePlanDate: new Date().toISOString().split("T")[0],
    reservedQuantity: 1,
    reservedBy: "Сидоров К.М. (Мастер ППР)",
    reason: "Резерв под плановое ТО 3-го квартала"
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/modules/wms/items").then((r) => (r.ok ? r.json() : { items: [] })),
      fetch("/api/modules/wms/reservations").then((r) => (r.ok ? r.json() : { reservations: [] }))
    ])
      .then(([itemsData, resData]) => {
        const loadedItems = itemsData.items || [];
        setItems(loadedItems);
        setReservations(resData.reservations || []);
        if (loadedItems.length > 0) {
          setReserveFormData((prev) => ({ ...prev, itemId: loadedItems[0].id }));
        }
      })
      .catch((err) => console.error("TOIR/EPS query error:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/modules/wms/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reserveFormData)
      });
      if (res.ok) {
        setShowReserveModal(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при резервировании под ТОИР");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const epsItems = items.filter((i) => i.isEps || i.quantity <= i.minQuantity);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Резервы & ЗИП (ТОИР/EPS)"
          description="Контроль порога безопасности ЗИП и резервирование материалов под графики ППР."
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учет", href: "/modules/wms" },
            { title: "Резервы & ЗИП" }
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
                onClick={() => setShowReserveModal(true)}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-amber-700"
              >
                <Plus size={14} /> Резерв под ППР
              </button>
            </div>
          }
        />

        <div className="space-y-6">
          {/* Section 1: Active Reserves */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Wrench size={16} className="text-amber-600" />
              <span>Текущие резервы ТМЦ под ТОИР (ППР)</span>
            </div>
            <DataTable
              columns={[
                {
                  key: "item",
                  header: "Позиция ЗИП",
                  cell: (row: WmsReservation) => (
                    <div>
                      <div className="font-semibold text-slate-900 text-xs">{row.item?.name || "ЗИП Позиция"}</div>
                      <div className="font-mono text-[10px] text-blue-600">{row.item?.sku}</div>
                    </div>
                  )
                },
                {
                  key: "equipment",
                  header: "Оборудование / Объект",
                  cell: (row: WmsReservation) => (
                    <span className="text-xs font-semibold text-slate-800">
                      {row.equipmentName || "Общее ТОИР"}
                    </span>
                  )
                },
                {
                  key: "planDate",
                  header: "Дата проведения ППР",
                  cell: (row: WmsReservation) => (
                    <span className="text-xs font-mono text-amber-700 font-medium">
                      {row.maintenancePlanDate ? new Date(row.maintenancePlanDate).toLocaleDateString() : "Не указана"}
                    </span>
                  )
                },
                {
                  key: "reservedQty",
                  header: "Зарезервировано",
                  cell: (row: WmsReservation) => (
                    <span className="font-bold text-xs text-amber-600">
                      {row.reservedQuantity} {row.item?.unit || "шт"}
                    </span>
                  )
                },
                {
                  key: "reservedBy",
                  header: "Зарезервировал",
                  cell: (row: WmsReservation) => (
                    <span className="text-xs text-slate-600">{row.reservedBy}</span>
                  )
                }
              ]}
              data={reservations}
              keyExtractor={(row) => row.id}
            />
          </div>

          {/* Section 2: EPS Safety Stock Control */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <ShieldAlert size={16} className="text-blue-600" />
              <span>Контроль неснижаемого остатка ЗИП (EPS Min-Max)</span>
            </div>
            <DataTable
              columns={[
                {
                  key: "sku",
                  header: "Артикул / Маркировка",
                  cell: (row: WmsItem) => (
                    <span className="font-mono text-xs font-bold text-blue-600">{row.sku}</span>
                  )
                },
                {
                  key: "name",
                  header: "Наименование ЗИП",
                  cell: (row: WmsItem) => (
                    <span className="font-semibold text-slate-900 text-xs">{row.name}</span>
                  )
                },
                {
                  key: "stock",
                  header: "Текущий остаток / Мин. неснижаемый",
                  cell: (row: WmsItem) => (
                    <div className="text-xs">
                      <span className="font-bold text-slate-900">{row.quantity} {row.unit}</span>
                      <span className="text-slate-400 font-medium ml-1.5">(Min порог: {row.minQuantity})</span>
                    </div>
                  )
                },
                {
                  key: "status",
                  header: "Состояние",
                  cell: (row: WmsItem) => {
                    const isDeficit = row.quantity <= row.minQuantity;
                    return (
                      <StatusBadge
                        status={isDeficit ? "REJECTED" : "APPROVED"}
                        label={isDeficit ? "ДЕФИЦИТ EPS" : "В НОРМЕ"}
                      />
                    );
                  }
                }
              ]}
              data={epsItems}
              keyExtractor={(row) => row.id}
            />
          </div>
        </div>

        <Modal open={showReserveModal} onClose={() => setShowReserveModal(false)} size="md">
          <ModalHeader
            icon={<Wrench size={16} />}
            title="Резервирование ЗИП под ППР (ТОИР)"
            subtitle="Фиксация резерва под плановое техническое обслуживание"
            onClose={() => setShowReserveModal(false)}
          />
          <form onSubmit={handleCreateReserve} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Позиция ЗИП *</label>
              <select
                value={reserveFormData.itemId}
                onChange={(e) => setReserveFormData({ ...reserveFormData, itemId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.sku}) - Свободно: {it.quantity - it.reservedQuantity} {it.unit}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Количество под резерв *</label>
                <input
                  type="number"
                  value={reserveFormData.reservedQuantity}
                  onChange={(e) => setReserveFormData({ ...reserveFormData, reservedQuantity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Дата ППР</label>
                <input
                  type="date"
                  value={reserveFormData.maintenancePlanDate}
                  onChange={(e) => setReserveFormData({ ...reserveFormData, maintenancePlanDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Единица оборудования</label>
              <input
                type="text"
                value={reserveFormData.equipmentName}
                onChange={(e) => setReserveFormData({ ...reserveFormData, equipmentName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowReserveModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Зафиксировать Резерв
              </button>
            </div>
          </form>
        </Modal>
      </main>
    </ShellLayout>
  );
}
