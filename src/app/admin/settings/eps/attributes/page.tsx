"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ShellLayout from "@/components/layout/shell-layout";
import {
  Plus,
  X,
  RefreshCw,
  ChevronRight,
  SlidersHorizontal,
  ShieldCheck,
  Database,
  Gauge,
} from "lucide-react";

interface AttributeSchema {
  id: string;
  typeValue: string;
  key: string;
  label: string;
  dataType: string;
  required: boolean;
}

interface ReferenceValueSchema {
  id: string;
  value: string;
  label: string;
}

interface ReferenceFieldSchema {
  id: string;
  key: string;
  label: string;
  values: ReferenceValueSchema[];
}

export default function EpsAttributesSettingsPage() {
  const [attributes, setAttributes] = useState<AttributeSchema[]>([]);
  const [references, setReferences] = useState<ReferenceFieldSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAttrModal, setShowAttrModal] = useState(false);

  // Form State
  const [typeValue, setTypeValue] = useState("Обрабатывающий центр");
  const [attrLabel, setAttrLabel] = useState("");
  const [attrKey, setAttrKey] = useState("");
  const [dataType, setDataType] = useState("TEXT");
  const [required, setRequired] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [attrRes, refRes] = await Promise.all([
        fetch("/api/equipment-type-attributes"),
        fetch("/api/reference/fields"),
      ]);
      if (attrRes.ok) setAttributes(await attrRes.json());
      if (refRes.ok) setReferences(await refRes.json());
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
        const [attrRes, refRes] = await Promise.all([
          fetch("/api/equipment-type-attributes"),
          fetch("/api/reference/fields"),
        ]);
        if (mounted) {
          if (attrRes.ok) {
            const attrData = await attrRes.json();
            setAttributes(attrData);
          }
          if (refRes.ok) {
            const refData = await refRes.json();
            setReferences(refData);
          }
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

  const handleAddAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attrLabel.trim()) return;

    try {
      const res = await fetch("/api/equipment-type-attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeValue,
          label: attrLabel.trim(),
          key: attrKey.trim() || attrLabel.trim().toLowerCase().replace(/\s+/g, "_"),
          dataType,
          required,
        }),
      });

      if (res.ok) {
        setShowAttrModal(false);
        setAttrLabel("");
        setAttrKey("");
        fetchData();
      }
    } catch {
      alert("Ошибка создания атрибута");
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
          <span className="text-[#3473d4]">Конструктор Атрибутов</span>
        </div>

        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Конструктор Атрибутов Оборудования
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Формирование динамических характеристик по типам производственной техники.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
            </button>
            <button
              onClick={() => setShowAttrModal(true)}
              className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
            >
              <Plus size={14} /> Добавить атрибут
            </button>
          </div>
        </div>

        {/* Attributes Table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
          <div className="hidden grid-cols-[1.5fr_2fr_1.5fr_1fr_1fr] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 md:grid">
            <span>Привязка / Категория</span>
            <span>Название характеристики</span>
            <span>Ключ поля</span>
            <span>Тип данных</span>
            <span>Обязательное</span>
          </div>

          {attributes.map((attr) => (
            <div
              key={attr.id}
              className="grid gap-2 border-b border-slate-100 px-5 py-3.5 last:border-0 hover:bg-slate-50/50 md:grid-cols-[1.5fr_2fr_1.5fr_1fr_1fr] md:items-center md:gap-4 transition text-xs"
            >
              <div className="font-bold text-[#17243a]">{attr.typeValue}</div>
              <div className="font-medium text-slate-700">{attr.label}</div>
              <div className="font-mono text-[#3473d4] font-semibold">{attr.key}</div>
              <div className="font-mono text-slate-500">{attr.dataType}</div>
              <div>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    attr.required ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {attr.required ? "Да" : "Нет"}
                </span>
              </div>
            </div>
          ))}
        </section>

        {/* Modal Form */}
        {showAttrModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
            onClick={() => setShowAttrModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-[#3473d4]" />
                  <h3 className="text-sm font-bold text-[#17243a]">Создание характеристики</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAttrModal(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddAttribute} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Привязка к типу оборудования</label>
                  <input
                    type="text"
                    required
                    value={typeValue}
                    onChange={(e) => setTypeValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Название характеристики *</label>
                  <input
                    type="text"
                    required
                    value={attrLabel}
                    onChange={(e) => setAttrLabel(e.target.value)}
                    placeholder="например, Максимальный диаметр обработки"
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Уникальный системный ключ</label>
                  <input
                    type="text"
                    value={attrKey}
                    onChange={(e) => setAttrKey(e.target.value)}
                    placeholder="max_diameter_mm"
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Тип данных по умолчанию</label>
                  <select
                    value={dataType}
                    onChange={(e) => setDataType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="TEXT">TEXT (Текст)</option>
                    <option value="NUMBER">NUMBER (Числовое значение)</option>
                    <option value="BOOLEAN">BOOLEAN (Флаг да/нет)</option>
                    <option value="DATE">DATE (Дата)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="req-attr"
                    checked={required}
                    onChange={(e) => setRequired(e.target.checked)}
                    className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-100"
                  />
                  <label htmlFor="req-attr" className="font-semibold text-slate-600 cursor-pointer">Обязательное поле</label>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAttrModal(false)}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
                  >
                    <Plus size={13} /> Создать поле
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
