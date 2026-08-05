"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ShellLayout from "@/components/layout/shell-layout";
import { EquipmentItem } from "@/lib/modules/eps-store";
import { ArrowLeft, Save, ChevronRight, Server } from "lucide-react";
import Link from "next/link";

export default function EditEquipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<EquipmentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchItem = async () => {
      try {
        const res = await fetch(`/api/modules/eps/equipment/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) setItem(data.item);
        }
      } catch {
        if (mounted) setItem(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void fetchItem();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/modules/eps/equipment/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });

      if (!res.ok) {
        setError("Не удалось обновить паспорт оборудования");
        return;
      }

      router.push(`/modules/eps/${id}`);
      router.refresh();
    } catch {
      setError("Ошибка сети при сохранении изменений");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ShellLayout>
        <main className="w-full px-5 py-6 md:px-8">
          <div className="py-12 text-center text-xs text-slate-400">
            Загрузка данных паспорта…
          </div>
        </main>
      </ShellLayout>
    );
  }

  if (!item) {
    return (
      <ShellLayout>
        <main className="w-full px-5 py-6 md:px-8 space-y-4">
          <Link
            href="/modules/eps"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft size={14} /> Назад в реестр
          </Link>
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
            Оборудование не найдено.
          </div>
        </main>
      </ShellLayout>
    );
  }

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8">
        {/* Breadcrumbs */}
        <div className="mb-6 flex items-center gap-2 text-[10px] font-medium text-slate-400">
          <Link href="/" className="hover:text-slate-600">Главная</Link>
          <ChevronRight size={12} />
          <Link href="/modules/eps" className="hover:text-slate-600">EPS Паспортизация</Link>
          <ChevronRight size={12} />
          <Link href={`/modules/eps/${item.id}`} className="hover:text-slate-600">{item.equipmentCode}</Link>
          <ChevronRight size={12} />
          <span className="text-[#3473d4]">Редактирование v{item.version + 1}</span>
        </div>

        {/* Page Header */}
        <div className="mb-6 border-b border-slate-200/80 pb-4">
          <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
            Редактирование Техпаспорта (Новая версия v{item.version + 1})
          </h1>
          <p className="mt-1 text-[12px] text-slate-500 font-mono">
            Код: <span className="font-semibold text-slate-700">{item.equipmentCode}</span> | Текущая опубликованная версия: <span className="font-semibold text-[#3473d4]">v{item.version}.0</span>
          </p>
        </div>

        <form onSubmit={handleSave} className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-5 text-xs">
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3 text-xs rounded-lg bg-rose-50 text-rose-600 border border-rose-200 font-semibold"
            >
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-[#17243a]">
            <Server size={16} className="text-[#3473d4]" /> Параметры оборудования
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-slate-600">Наименование оборудования *</label>
              <input
                type="text"
                required
                value={item.name}
                onChange={(e) => setItem({ ...item, name: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-600">Статус оборудования</label>
              <select
                value={item.status}
                onChange={(e) => setItem({ ...item, status: e.target.value as EquipmentItem["status"] })}
                className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-semibold"
              >
                <option value="ACTIVE">ACTIVE (В эксплуатации)</option>
                <option value="INACTIVE">INACTIVE (В резерве)</option>
                <option value="DRAFT">DRAFT (Черновик)</option>
                <option value="DECOMMISSIONED">DECOMMISSIONED (Списано)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-slate-600">Категория</label>
              <input
                type="text"
                value={item.category}
                onChange={(e) => setItem({ ...item, category: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-600">Тип оборудования</label>
              <input
                type="text"
                value={item.type}
                onChange={(e) => setItem({ ...item, type: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-slate-600">Модель</label>
              <input
                type="text"
                value={item.model}
                onChange={(e) => setItem({ ...item, model: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-600">Заводской №</label>
              <input
                type="text"
                value={item.serialNumber}
                onChange={(e) => setItem({ ...item, serialNumber: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-600">Инвентарный №</label>
              <input
                type="text"
                value={item.inventoryNumber}
                onChange={(e) => setItem({ ...item, inventoryNumber: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-slate-600">Цех / Подразделение</label>
              <input
                type="text"
                value={item.department}
                onChange={(e) => setItem({ ...item, department: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-600">Локация / Размещение</label>
              <input
                type="text"
                value={item.location}
                onChange={(e) => setItem({ ...item, location: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <Link
              href={`/modules/eps/${item.id}`}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Отмена
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
            >
              <Save size={14} />
              {saving ? "Публикация версии…" : `Опубликовать новую версию (v${item.version + 1})`}
            </button>
          </div>
        </form>
      </main>
    </ShellLayout>
  );
}
