"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ShellLayout from "@/components/layout/shell-layout";
import {
  Plus,
  X,
  RefreshCw,
  ListPlus,
  Trash2,
  ChevronRight,
  SlidersHorizontal,
  ShieldCheck,
  Database,
  Gauge,
} from "lucide-react";

interface ReferenceValueSchema {
  id: string;
  value: string;
  label: string;
}

interface ReferenceFieldSchema {
  id: string;
  key: string;
  label: string;
  description?: string;
  values: ReferenceValueSchema[];
}

export default function EpsReferencesSettingsPage() {
  const [references, setReferences] = useState<ReferenceFieldSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRefModal, setShowRefModal] = useState(false);
  const [selectedFieldForValue, setSelectedFieldForValue] = useState<ReferenceFieldSchema | null>(null);

  // Form states
  const [refLabel, setRefLabel] = useState("");
  const [refKey, setRefKey] = useState("");
  const [newValueVal, setNewValueVal] = useState("");
  const [newValueLabel, setNewValueLabel] = useState("");

  const fetchReferenceData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reference/fields");
      if (res.ok) setReferences(await res.json());
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const res = await fetch("/api/reference/fields");
        if (res.ok) {
          const data = await res.json();
          if (mounted) setReferences(data);
        }
      } catch {
        // Fallback
      } finally {
        if (mounted) setLoading(false);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refLabel.trim()) return;

    try {
      const res = await fetch("/api/reference/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: refLabel.trim(),
          key: refKey.trim() || refLabel.trim().toLowerCase().replace(/\s+/g, "_"),
        }),
      });

      if (res.ok) {
        setShowRefModal(false);
        setRefLabel("");
        setRefKey("");
        fetchReferenceData();
      }
    } catch {
      alert("Ошибка создания справочника");
    }
  };

  const handleAddValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFieldForValue || !newValueLabel.trim()) return;

    try {
      const res = await fetch("/api/reference/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId: selectedFieldForValue.id,
          label: newValueLabel.trim(),
          value: newValueVal.trim() || newValueLabel.trim().toUpperCase(),
        }),
      });

      if (res.ok) {
        setSelectedFieldForValue(null);
        setNewValueLabel("");
        setNewValueVal("");
        fetchReferenceData();
      }
    } catch {
      alert("Ошибка добавления значения в справочник");
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm("Вы действительно хотите удалить этот справочник?")) return;
    try {
      const res = await fetch(`/api/reference/fields/${fieldId}`, { method: "DELETE" });
      if (res.ok) fetchReferenceData();
    } catch {
      alert("Ошибка удаления справочника");
    }
  };

  const handleDeleteValue = async (valueId: string) => {
    try {
      const res = await fetch(`/api/reference/values/${valueId}`, { method: "DELETE" });
      if (res.ok) fetchReferenceData();
    } catch {
      alert("Ошибка удаления элемента");
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8">
        {/* Breadcrumbs */}
        <div className="mb-4 flex items-center gap-2 text-[10px] font-medium text-slate-400">
          <Link href="/" className="hover:text-slate-600">Главная</Link>
          <ChevronRight size={12} />
          <Link href="/admin/settings" className="hover:text-slate-600">Настройки</Link>
          <ChevronRight size={12} />
          <Link href="/admin/settings/eps" className="hover:text-slate-600">НСИ & Справочники EPS</Link>
          <ChevronRight size={12} />
          <span className="text-[#3473d4]">Формирование Справочников</span>
        </div>

        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Формирование Системных Справочников
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Управление справочными полями (ReferenceFields) и их допустимыми значениями.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchReferenceData}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
            </button>
            <button
              onClick={() => setShowRefModal(true)}
              className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
            >
              <Plus size={14} /> Создать справочник
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {references.map((ref) => (
            <div key={ref.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-[#17243a]">{ref.label}</h3>
                  <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-[#3473d4] font-mono">
                    {ref.key}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFieldForValue(ref)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <ListPlus size={13} /> Добавить элемент
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteField(ref.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Values Chips */}
              <div className="flex flex-wrap gap-2 pt-1">
                {ref.values && ref.values.length > 0 ? (
                  ref.values.map((v) => (
                    <span
                      key={v.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-1 text-[11px] font-medium text-slate-700"
                    >
                      <span>{v.label}</span>
                      <span className="text-[9px] font-mono text-slate-400">({v.value})</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteValue(v.id)}
                        className="text-slate-400 hover:text-rose-600 ml-1"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400 italic">Справочник пока не содержит элементов.</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Create Reference Field */}
        {showRefModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
            onClick={() => setShowRefModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-[#3473d4]" />
                  <h3 className="text-sm font-bold text-[#17243a]">Новый системный справочник</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRefModal(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateField} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Название справочника *</label>
                  <input
                    type="text"
                    required
                    value={refLabel}
                    onChange={(e) => setRefLabel(e.target.value)}
                    placeholder="например, Заводы-Изготовители"
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Системный ключ (Key)</label>
                  <input
                    type="text"
                    value={refKey}
                    onChange={(e) => setRefKey(e.target.value)}
                    placeholder="manufacturers_list"
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRefModal(false)}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
                  >
                    <Plus size={13} /> Создать
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Add Value to Reference Field */}
        {selectedFieldForValue && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
            onClick={() => setSelectedFieldForValue(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ListPlus size={16} className="text-[#3473d4]" />
                  <h3 className="text-sm font-bold text-[#17243a]">
                    Элемент в справочник: {selectedFieldForValue.label}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFieldForValue(null)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddValue} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Название элемента (Метка) *</label>
                  <input
                    type="text"
                    required
                    value={newValueLabel}
                    onChange={(e) => setNewValueLabel(e.target.value)}
                    placeholder="например, Завод «Краснолесье»"
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Код элемента (Value)</label>
                  <input
                    type="text"
                    value={newValueVal}
                    onChange={(e) => setNewValueVal(e.target.value)}
                    placeholder="KRASNOLESIE_PLANT"
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedFieldForValue(null)}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
                  >
                    <Plus size={13} /> Добавить элемент
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </ShellLayout>
  );
}
