"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  Warehouse as WarehouseIcon,
  Plus,
  RefreshCw,
  UserCheck,
  MapPin
} from "lucide-react";
import {
  PageHeader,
  StatusBadge,
  Modal,
  ModalHeader
} from "@/components/ui";

interface StorageCell {
  id: string;
  code: string;
  description: string | null;
}

interface Warehouse {
  id: string;
  name: string;
  responsibleUser: string;
  responsibleUsername: string | null;
  storageCells: StorageCell[];
}

export default function WmsWarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    responsibleUser: "Кладовщик И.И.",
  });

  const fetchWarehouses = () => {
    setLoading(true);
    fetch("/api/modules/wms/warehouses")
      .then((res) => (res.ok ? res.json() : { warehouses: [] }))
      .then((data) => setWarehouses(data.warehouses || []))
      .catch((err) => console.error("Failed to fetch warehouses:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({ name: "", responsibleUser: "Кладовщик И.И." });
        fetchWarehouses();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Ошибка создания склада");
      }
    } catch (err) {
      console.error("Warehouse create error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Склады & Ячейки хранения"
          description="Управление топологией складских помещений и местами размещения ТМЦ"
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учет", href: "/modules/wms" },
            { title: "Склады & Ячейки" },
          ]}
          actions={
            <>
              <button
                onClick={fetchWarehouses}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
              >
                <Plus size={14} /> Добавить склад
              </button>
            </>
          }
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((wh) => (
            <div
              key={wh.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#3473d4]">
                    <WarehouseIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-[#17243a]">{wh.name}</h3>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                      <UserCheck size={12} />
                      <span>МОЛ: {wh.responsibleUser}</span>
                    </div>
                  </div>
                </div>
                <StatusBadge status="ACTIVE" label="Активен" />
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">Ячейки хранения</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-[#3473d4] font-semibold">
                    {wh.storageCells.length} ячеек
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {wh.storageCells.length > 0 ? (
                    wh.storageCells.map((cell) => (
                      <span
                        key={cell.id}
                        className="inline-flex items-center gap-1 rounded bg-slate-50 border border-slate-200 px-2 py-1 text-[10px] font-mono text-slate-700"
                      >
                        <MapPin size={9} className="text-slate-400" /> {cell.code}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] italic text-slate-400">Ячейки не сконфигурированы</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Modal open={showModal} onClose={() => setShowModal(false)} size="lg">
          <ModalHeader
            icon={<WarehouseIcon size={16} />}
            title="Добавление нового склада"
            subtitle="Укажите наименование и материально ответственное лицо"
            onClose={() => setShowModal(false)}
          />
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Наименование склада *</label>
              <input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Склад №3 (Запчасти и расходники)"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Материально ответственное лицо (МОЛ) *</label>
              <input
                required
                value={formData.responsibleUser}
                onChange={(e) => setFormData({ ...formData, responsibleUser: e.target.value })}
                placeholder="Иванов И.И."
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8] disabled:opacity-50"
              >
                {submitting ? "Создание..." : "Создать склад"}
              </button>
            </div>
          </form>
        </Modal>
      </main>
    </ShellLayout>
  );
}
