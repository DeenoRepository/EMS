"use client";

import { use, useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { EquipmentItem } from "@/lib/modules/eps-store";
import { DocumentItem } from "@/lib/modules/eps-advanced-store";
import {
  Server,
  ArrowLeft,
  Building2,
  Edit,
  FileText,
  Download,
  History,
  Eye,
  X,
  Wrench,
  ShieldCheck,
  Activity,
  ChevronRight,
  MapPin,
  Barcode,
  Hash,
  Cpu,
  Clock,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Layers,
  Save,
  Truck,
  Calendar,
  UserCheck,
} from "lucide-react";
import Link from "next/link";

export default function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [item, setItem] = useState<EquipmentItem | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [activeTab, setActiveTab] = useState<"passport" | "documents" | "versions" | "mro">("passport");

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<EquipmentItem | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [techAttributeSchemas, setTechAttributeSchemas] = useState<Array<{ id: string; key: string; label: string; dataType: string; required?: boolean }>>([]);

  useEffect(() => {
    if (item?.type) {
      fetch(`/api/equipment-type-attributes?type=${encodeURIComponent(item.type)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setTechAttributeSchemas(data);
          } else {
            setTechAttributeSchemas([
              { id: "t1", key: "spindle_speed_rpm", label: "Частота вращения шпинделя", dataType: "TEXT" },
              { id: "t2", key: "cnc_controller_type", label: "Тип стойки ЧПУ", dataType: "TEXT" },
              { id: "t3", key: "spindle_power_kw", label: "Мощность привода шпинделя", dataType: "TEXT" },
              { id: "t4", key: "tool_capacity", label: "Количество инструментов в магазине", dataType: "TEXT" }
            ]);
          }
        })
        .catch(() => {});
    }
  }, [item?.type]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const eqRes = await fetch(`/api/modules/eps/equipment/${id}`);
        if (!eqRes.ok) {
          setItem(null);
          return;
        }

        const data = await eqRes.json();
        const currentEq: EquipmentItem | null = data.item;
        setItem(currentEq);

        if (currentEq?.equipmentCode) {
          const docsRes = await fetch(`/api/modules/eps/documents?equipmentCode=${encodeURIComponent(currentEq.equipmentCode)}`);
          if (docsRes.ok) {
            const docsData = await docsRes.json();
            setDocuments(docsData.items || []);
          }
        }
      } catch {
        setItem(null);
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [id]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    setSavingEdit(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/modules/eps/equipment/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        setEditError("Не удалось обновить паспорт оборудования");
        return;
      }

      const data = await res.json();
      if (data.item) {
        setItem(data.item);
      } else {
        setItem(editForm);
      }
      setShowEditModal(false);
    } catch {
      setEditError("Ошибка сети при сохранении изменений");
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <ShellLayout>
        <main className="w-full px-5 py-6 md:px-8">
          <div className="py-20 text-center space-y-3">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[#3473d4] border-t-transparent" />
            <p className="text-[12px] font-medium text-slate-500">Загрузка техпаспорта оборудования…</p>
          </div>
        </main>
      </ShellLayout>
    );
  }

  if (!item) {
    return (
      <ShellLayout>
        <main className="w-full px-5 py-6 md:px-8 space-y-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
            <Link href="/" className="hover:text-slate-600">Главная</Link>
            <ChevronRight size={12} />
            <Link href="/modules/eps" className="hover:text-slate-600">EPS Паспортизация</Link>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-[12px] text-slate-400 space-y-3 shadow-xs">
            <AlertCircle size={36} className="mx-auto text-slate-300" />
            <p className="font-semibold text-slate-700 text-sm">Паспорт оборудования не найден</p>
            <p className="text-slate-500">Проверьте корректность указанного идентификатора или вернитесь в реестр.</p>
            <div className="pt-2">
              <Link
                href="/modules/eps"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <ArrowLeft size={13} /> Вернуться в реестр EPS
              </Link>
            </div>
          </div>
        </main>
      </ShellLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
          dot: "bg-emerald-500",
          label: "ACTIVE",
        };
      case "DRAFT":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200/60",
          dot: "bg-amber-500",
          label: "DRAFT",
        };
      case "INACTIVE":
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200/60",
          dot: "bg-blue-500",
          label: "INACTIVE",
        };
      default:
        return {
          bg: "bg-slate-100 text-slate-600 border-slate-200",
          dot: "bg-slate-400",
          label: "DECOMMISSIONED",
        };
    }
  };

  const statusBadge = getStatusBadge(item.status);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-5">
        {/* Top Header Block: Breadcrumbs & Actions */}
        <div>
          {/* Breadcrumbs */}
          <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
            <Link href="/" className="hover:text-slate-600">Главная</Link>
            <ChevronRight size={12} />
            <Link href="/modules/eps" className="hover:text-slate-600">EPS Паспортизация</Link>
            <ChevronRight size={12} />
            <span className="text-[#3473d4] font-semibold">{item.equipmentCode}</span>
          </div>

          {/* Page Title & Main Action Buttons */}
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
                  {item.name}
                </h1>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${statusBadge.bg}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusBadge.dot}`} />
                  {statusBadge.label}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>Код: <span className="font-mono font-medium text-slate-700">{item.equipmentCode}</span></span>
                <span className="text-slate-300">•</span>
                <span>Инв. №: <span className="font-mono font-medium text-slate-700">{item.inventoryNumber}</span></span>
                <span className="text-slate-300">•</span>
                <span>Версия <span className="font-mono font-medium text-slate-700">v{item.version}</span></span>
              </div>
            </div>

            {/* Action Buttons Header */}
            <div className="flex items-center gap-2 shrink-0">
              <a
                href="/api/modules/eps/equipment/export"
                download
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition"
              >
                <Download size={13} /> Экспорт
              </a>
              <button
                type="button"
                onClick={() => {
                  setEditForm(item ? { ...item } : null);
                  setEditError(null);
                  setShowEditModal(true);
                }}
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] transition cursor-pointer"
              >
                <Edit size={13} /> Редактировать (v{item.version + 1})
              </button>
            </div>
          </div>
        </div>

        {/* Executive Metric Cards Grid (Matching Platform Overview Standard) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Состояние
              </span>
              <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-500">
                <Activity size={14} />
              </div>
            </div>
            <div className="mt-2 text-[18px] font-bold tracking-tight text-[#17243a]">
              {item.status === "ACTIVE" ? "В эксплуатации" : item.status === "DRAFT" ? "Черновик" : item.status === "INACTIVE" ? "В резерве" : "Списано"}
            </div>
            <div className="mt-1 text-[10px] text-emerald-600 font-medium">Исправно</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                След. ТО
              </span>
              <div className="rounded-md bg-blue-50 p-1.5 text-[#3473d4]">
                <Wrench size={14} />
              </div>
            </div>
            <div className="mt-2 text-[18px] font-bold tracking-tight text-[#17243a] font-mono">
              15.09.2026
            </div>
            <div className="mt-1 text-[10px] text-slate-400">План через 40 дн.</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Гарантия
              </span>
              <div className="rounded-md bg-amber-50 p-1.5 text-amber-500">
                <ShieldCheck size={14} />
              </div>
            </div>
            <div className="mt-2 text-[18px] font-bold tracking-tight text-[#17243a]">
              Активна
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Сервисный контракт</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Документов
              </span>
              <div className="rounded-md bg-violet-50 p-1.5 text-violet-500">
                <FileText size={14} />
              </div>
            </div>
            <div className="mt-2 text-[18px] font-bold tracking-tight text-[#17243a]">
              {documents.length} ф.
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Паспорта и схемы</div>
          </div>
        </div>


        {/* Unified Tabbed Content Card Block (Single Block Container) */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* Tab Sub-navigation Bar (Reference EPS Standard Header) */}
          <div className="flex overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden border-b border-slate-200/80 px-2 bg-slate-50/40">
            <button
              type="button"
              onClick={() => setActiveTab("passport")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[11px] font-bold transition -mb-px ${
                activeTab === "passport"
                  ? "border-[#2f74df] text-[#2f74df] bg-white shadow-2xs"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/80"
              }`}
            >
              <Server size={14} /> Паспорт
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("documents")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[11px] font-bold transition -mb-px ${
                activeTab === "documents"
                  ? "border-[#2f74df] text-[#2f74df] bg-white shadow-2xs"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/80"
              }`}
            >
              <FileText size={14} /> Документы и схемы ({documents.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("versions")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[11px] font-bold transition -mb-px ${
                activeTab === "versions"
                  ? "border-[#2f74df] text-[#2f74df] bg-white shadow-2xs"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/80"
              }`}
            >
              <History size={14} /> История версий
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("mro")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[11px] font-bold transition -mb-px ${
                activeTab === "mro"
                  ? "border-[#2f74df] text-[#2f74df] bg-white shadow-2xs"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/80"
              }`}
            >
              <Wrench size={14} /> График ТОиР
            </button>
          </div>

          {/* Card Body: Active Tab Content */}
          <div className="p-6 bg-white">
            {/* Tab 1: Passport Overview Specification Grid */}
            {activeTab === "passport" && (
              <div className="space-y-6">
                <div className="grid gap-8 md:grid-cols-2">
                  {/* Section 1: Passport Identification */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <div className="rounded-md bg-blue-50 p-1 text-[#3473d4]">
                        <Barcode size={15} />
                      </div>
                      <h2 className="text-[13px] font-bold text-[#17243a]">
                        1. Паспортные данные
                      </h2>
                    </div>

                    <div className="divide-y divide-slate-100 text-[11px]">
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Код EPS:</span>
                        <span className="font-mono font-bold text-[#3473d4]">
                          {item.equipmentCode}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Статус оборудования:</span>
                        <span className="font-bold text-emerald-600">{item.status === "ACTIVE" ? "В эксплуатации" : item.status === "DRAFT" ? "Черновик" : item.status === "INACTIVE" ? "В резерве" : "Списано"}</span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Категория:</span>
                        <span className="font-medium text-slate-700">{item.category || "—"}</span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Тип техники:</span>
                        <span className="font-medium text-slate-700">{item.type || "—"}</span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Модель:</span>
                        <span className="font-medium text-slate-700">{item.model || "—"}</span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Заводской номер:</span>
                        <span className="font-mono font-semibold text-slate-700">{item.serialNumber || "—"}</span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Инвентарный номер:</span>
                        <span className="font-mono font-semibold text-slate-700">{item.inventoryNumber || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Technical Specifications (Dynamic Reference Attributes) */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <div className="rounded-md bg-indigo-50 p-1 text-indigo-600">
                        <Cpu size={15} />
                      </div>
                      <h2 className="text-[13px] font-bold text-[#17243a]">
                        2. Технические характеристики
                      </h2>
                    </div>

                    <div className="divide-y divide-slate-100 text-[11px]">
                      {techAttributeSchemas.length > 0 ? (
                        techAttributeSchemas.map((attr) => (
                          <div key={attr.id} className="flex justify-between items-center py-2">
                            <span className="text-slate-400 font-medium">{attr.label}:</span>
                            <span className="font-semibold text-slate-700">
                              {item.techSpecs?.[attr.key] || "—"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="py-4 text-center text-slate-400">
                          Характеристики не заданы в справочнике
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Grid Row 2: Location & Manufacturer */}
                <div className="grid gap-8 md:grid-cols-2 pt-2 border-t border-slate-100">
                  {/* Section 3: Physical Location & Owner Responsibility */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <div className="rounded-md bg-emerald-50 p-1 text-emerald-500">
                        <Building2 size={15} />
                      </div>
                      <h2 className="text-[13px] font-bold text-[#17243a]">
                        3. Размещение и ответственность
                      </h2>
                    </div>

                    <div className="divide-y divide-slate-100 text-[11px]">
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Подразделение (Цех):</span>
                        <span className="font-medium text-slate-700">{item.department || "—"}</span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Размещение / Пролет:</span>
                        <span className="font-medium text-slate-700">{item.location || "—"}</span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Ответственный сотрудник:</span>
                        <span className="font-medium text-slate-700">{item.responsibleUser || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Production & Supplier */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <div className="rounded-md bg-amber-50 p-1 text-amber-600">
                        <Truck size={15} />
                      </div>
                      <h2 className="text-[13px] font-bold text-[#17243a]">
                        4. Изготовитель и поставка
                      </h2>
                    </div>

                    <div className="divide-y divide-slate-100 text-[11px]">
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Изготовитель:</span>
                        <span className="font-medium text-slate-700">{item.manufacturer || "—"}</span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Страна происхождения:</span>
                        <span className="font-semibold text-slate-700">{item.countryOfOrigin || "—"}</span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Происхождение техники:</span>
                        <span className={`font-semibold ${item.isImported ? "text-amber-700" : "text-blue-700"}`}>
                          {item.isImported ? "Импортное оборудование" : "Отечественное оборудование"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Поставщик:</span>
                        <span className="font-medium text-slate-700">{item.supplier || "—"}</span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Дата производства:</span>
                        <span className="font-mono font-medium text-slate-700">{item.productionDate || "—"}</span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Дата поставки:</span>
                        <span className="font-mono font-medium text-slate-700">{item.deliveryDate || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grid Row 3: Exploitation & Additional Details */}
                <div className="grid gap-8 md:grid-cols-2 pt-2 border-t border-slate-100">
                  {/* Section 5: Exploitation & Maintenance */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <div className="rounded-md bg-violet-50 p-1 text-violet-600">
                        <Calendar size={15} />
                      </div>
                      <h2 className="text-[13px] font-bold text-[#17243a]">
                        5. Эксплуатация и гарантия
                      </h2>
                    </div>

                    <div className="divide-y divide-slate-100 text-[11px]">
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Ввод в эксплуатацию:</span>
                        <span className="font-mono font-medium text-slate-700">{item.commissioningDate || "—"}</span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Окончание гарантии:</span>
                        <span className="font-mono font-semibold text-amber-700">{item.warrantyExpiration || "—"}</span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Плановое ТО:</span>
                        <span className="font-mono font-semibold text-[#3473d4]">{item.serviceDueDate || "15.09.2026"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 6: Additional Details */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <div className="rounded-md bg-teal-50 p-1 text-teal-600">
                        <Layers size={15} />
                      </div>
                      <h2 className="text-[13px] font-bold text-[#17243a]">
                        6. Дополнительные сведения
                      </h2>
                    </div>

                    <div className="divide-y divide-slate-100 text-[11px]">
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Критичность оборудования:</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${item.criticality === "A" ? "bg-rose-50 text-rose-700 border-rose-200" : item.criticality === "B" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                          {item.criticality === "A" ? "Класс A (Критическое)" : item.criticality === "B" ? "Класс B (Средняя)" : "Класс C (Низкая)"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-400 font-medium">Уникальность оборудования:</span>
                        <span className={`font-semibold ${item.isUnique ? "text-purple-700" : "text-slate-600"}`}>
                          {item.isUnique ? "Уникальное оборудование" : "Серийное оборудование"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {item.notes && (
                  <div className="rounded-lg bg-slate-50/70 p-3.5 border border-slate-100 text-[11px] space-y-1">
                    <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Примечания</span>
                    <p className="text-slate-700 leading-relaxed">{item.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Documents Table */}
            {activeTab === "documents" && (
              <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
                <div className="hidden grid-cols-[2fr_1.5fr_1fr_1.5fr] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 md:grid">
                  <span>Документ / Схема</span>
                  <span>Тип документа</span>
                  <span>Размер</span>
                  <span className="text-right">Действия</span>
                </div>

                {documents.length === 0 ? (
                  <div className="px-5 py-12 text-center text-[12px] text-slate-400 space-y-2">
                    <FileCode size={32} className="mx-auto text-slate-300" />
                    <p className="font-semibold text-slate-600">Прикрепленные файлы отсутствуют</p>
                    <p className="text-[11px]">Вы можете добавить технические схемы и паспорта через раздел документов.</p>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="grid gap-2 border-b border-slate-100 px-5 py-3 last:border-0 hover:bg-slate-50/50 md:grid-cols-[2fr_1.5fr_1fr_1.5fr] md:items-center md:gap-4 transition text-[11px]"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#3473d4]">
                          <FileText size={16} />
                        </div>
                        <div>
                          <span className="block font-bold text-[#17243a] text-xs">{doc.title}</span>
                          <span className="block text-[10px] text-slate-400 font-mono">{doc.fileName}</span>
                        </div>
                      </div>

                      <div>
                        <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {doc.docType}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 font-mono">{doc.fileSize}</div>

                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-[#3473d4] hover:text-blue-700 transition"
                        >
                          <Eye size={13} /> Просмотр
                        </button>
                        <a
                          href={`/api/files/download?id=${doc.id}`}
                          download
                          className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition"
                        >
                          <Download size={13} /> Скачать
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </section>
            )}

            {/* Tab 3: Version History Timeline */}
            {activeTab === "versions" && (
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3 text-[11px]">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-[#17243a] text-xs flex items-center gap-2">
                    <History size={15} className="text-[#3473d4]" /> История версий техпаспорта
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {Array.from({ length: item.version }, (_, i) => item.version - i).map((ver) => (
                    <div key={ver} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50/60 transition">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-md font-mono font-bold text-[10px] ${ver === item.version ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-slate-100 text-slate-500"}`}>
                          v{ver}
                        </div>
                        <div>
                          <span className="font-bold text-[#17243a] text-xs">
                            Ревизия v{ver}.0 {ver === item.version ? "(Текущая)" : "(Архивная)"}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {ver === item.version ? "Утвержденные актуальные параметры техпаспорта" : `Архивная ревизия техпаспорта ${item.equipmentCode}`}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${ver === item.version ? "text-emerald-700 bg-emerald-50 border border-emerald-200" : "text-slate-500 bg-slate-100"}`}>
                        {ver === item.version ? "Утверждено" : "Архив"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 4: MRO Schedule */}
            {activeTab === "mro" && (
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs text-[11px] space-y-3">
                <div className="flex items-center gap-2 font-bold text-[#17243a] text-xs border-b border-slate-100 pb-3">
                  <Wrench size={15} className="text-[#3473d4]" />
                  <span>Техническое обслуживание и ремонты (ТОиР)</span>
                </div>
                <p className="text-slate-500 leading-relaxed">
                  График планово-предупредительных ремонтов (ППР), ТО и наработка оборудования синхронизируются с модулем MRO.
                </p>
                <div className="pt-1">
                  <Link
                    href="/modules/mro"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] transition"
                  >
                    <Wrench size={13} /> Перейти в модуль MRO
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>


        {/* Document Preview Modal */}
        {previewDoc && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
            onClick={() => setPreviewDoc(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#3473d4]">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#17243a]">{previewDoc.title}</h3>
                    <p className="text-[10px] text-slate-400 font-mono">{previewDoc.fileName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl p-8 min-h-[220px] flex flex-col items-center justify-center text-[11px] text-slate-500 space-y-2">
                <FileCode size={32} className="text-slate-300" />
                <p className="font-semibold text-slate-700">Предпросмотр файла</p>
                <p className="text-[10px] text-slate-400 font-mono">{previewDoc.fileName} ({previewDoc.fileSize})</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <a
                  href={`/api/files/download?id=${previewDoc.id}`}
                  download
                  className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] transition"
                >
                  <Download size={13} /> Скачать файл
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Edit Passport Modal Dialog */}
        {showEditModal && editForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto"
            onClick={() => setShowEditModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#3473d4]">
                    <Edit size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#17243a]">
                      Редактирование Паспорта (Новая версия v{item.version + 1})
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Код: {item.equipmentCode} | Текущая версия: v{item.version}.0
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveEdit} className="space-y-4 text-xs overflow-y-auto min-h-0 flex-1 pr-1">
                {editError && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="p-3 text-xs rounded-lg bg-rose-50 text-rose-600 border border-rose-200 font-semibold"
                  >
                    {editError}
                  </div>
                )}

                {/* Section 1: Passport Identification */}
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <div className="flex items-center gap-1.5 font-bold text-[#17243a] text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/60 pb-2">
                    <Barcode size={14} className="text-[#3473d4]" /> 1. Паспортные данные
                  </div>
                  
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600 text-[11px]">Наименование оборудования *</label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Статус оборудования</label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value as EquipmentItem["status"] })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-semibold text-emerald-700"
                      >
                        <option value="ACTIVE">ACTIVE (В эксплуатации)</option>
                        <option value="INACTIVE">INACTIVE (В резерве)</option>
                        <option value="DRAFT">DRAFT (Черновик)</option>
                        <option value="DECOMMISSIONED">DECOMMISSIONED (Списано)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Категория</label>
                      <input
                        type="text"
                        value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Тип оборудования</label>
                      <input
                        type="text"
                        value={editForm.type}
                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Модель</label>
                      <input
                        type="text"
                        value={editForm.model}
                        onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Заводской №</label>
                      <input
                        type="text"
                        value={editForm.serialNumber}
                        onChange={(e) => setEditForm({ ...editForm, serialNumber: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Инвентарный №</label>
                      <input
                        type="text"
                        value={editForm.inventoryNumber}
                        onChange={(e) => setEditForm({ ...editForm, inventoryNumber: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Technical Specifications (From Reference Settings) */}
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <div className="flex items-center gap-1.5 font-bold text-[#17243a] text-[11px] uppercase tracking-wider text-slate-500">
                      <Cpu size={14} className="text-indigo-600" /> 2. Технические характеристики
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Подгружено из справочника</span>
                  </div>

                  {techAttributeSchemas.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {techAttributeSchemas.map((attr) => (
                        <div key={attr.id} className="space-y-1">
                          <label className="font-semibold text-slate-600 text-[11px]">{attr.label}</label>
                          <input
                            type="text"
                            placeholder="Не указано"
                            value={editForm.techSpecs?.[attr.key] || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                techSpecs: {
                                  ...editForm.techSpecs,
                                  [attr.key]: e.target.value,
                                },
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-2 text-slate-400 text-[11px]">
                      Нет настроенных атрибутов для данного типа техники
                    </div>
                  )}
                </div>

                {/* Section 3: Location & Responsibility */}
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <div className="flex items-center gap-1.5 font-bold text-[#17243a] text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/60 pb-2">
                    <Building2 size={14} className="text-emerald-600" /> 3. Размещение и ответственность
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Подразделение (Цех)</label>
                      <input
                        type="text"
                        value={editForm.department}
                        onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Размещение / Пролет</label>
                      <input
                        type="text"
                        value={editForm.location}
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Ответственный сотрудник</label>
                      <input
                        type="text"
                        value={editForm.responsibleUser || ""}
                        onChange={(e) => setEditForm({ ...editForm, responsibleUser: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Manufacturer & Delivery */}
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <div className="flex items-center gap-1.5 font-bold text-[#17243a] text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/60 pb-2">
                    <Truck size={14} className="text-amber-600" /> 4. Изготовитель и поставка
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Изготовитель</label>
                      <input
                        type="text"
                        value={editForm.manufacturer || ""}
                        onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Поставщик</label>
                      <input
                        type="text"
                        value={editForm.supplier || ""}
                        onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Страна происхождения</label>
                      <input
                        type="text"
                        placeholder="Например: США, Германия, Россия"
                        value={editForm.countryOfOrigin || ""}
                        onChange={(e) => setEditForm({ ...editForm, countryOfOrigin: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Происхождение техники</label>
                      <select
                        value={editForm.isImported ? "true" : "false"}
                        onChange={(e) => setEditForm({ ...editForm, isImported: e.target.value === "true" })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-semibold"
                      >
                        <option value="false">Отечественное оборудование</option>
                        <option value="true">Импортное оборудование</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Дата производства</label>
                      <input
                        type="date"
                        value={editForm.productionDate || ""}
                        onChange={(e) => setEditForm({ ...editForm, productionDate: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Дата поставки</label>
                      <input
                        type="date"
                        value={editForm.deliveryDate || ""}
                        onChange={(e) => setEditForm({ ...editForm, deliveryDate: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 5: Exploitation & Warranty */}
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <div className="flex items-center gap-1.5 font-bold text-[#17243a] text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/60 pb-2">
                    <Calendar size={14} className="text-violet-600" /> 5. Эксплуатация и гарантия
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Ввод в эксплуатацию</label>
                      <input
                        type="date"
                        value={editForm.commissioningDate || ""}
                        onChange={(e) => setEditForm({ ...editForm, commissioningDate: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Окончание гарантии</label>
                      <input
                        type="date"
                        value={editForm.warrantyExpiration || ""}
                        onChange={(e) => setEditForm({ ...editForm, warrantyExpiration: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Дата планового ТО</label>
                      <input
                        type="date"
                        value={editForm.serviceDueDate || ""}
                        onChange={(e) => setEditForm({ ...editForm, serviceDueDate: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600 text-[11px]">Примечания</label>
                    <textarea
                      rows={2}
                      value={editForm.notes || ""}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {/* Section 6: Additional Details */}
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <div className="flex items-center gap-1.5 font-bold text-[#17243a] text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/60 pb-2">
                    <Layers size={14} className="text-teal-600" /> 6. Дополнительные сведения
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Критичность оборудования (ABC)</label>
                      <select
                        value={editForm.criticality || "A"}
                        onChange={(e) => setEditForm({ ...editForm, criticality: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-bold text-rose-700"
                      >
                        <option value="A">Класс A — Высокая (Критическое)</option>
                        <option value="B">Класс B — Средняя</option>
                        <option value="C">Класс C — Низкая</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 text-[11px]">Уникальность оборудования</label>
                      <select
                        value={editForm.isUnique ? "true" : "false"}
                        onChange={(e) => setEditForm({ ...editForm, isUnique: e.target.value === "true" })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-semibold"
                      >
                        <option value="false">Серийное оборудование</option>
                        <option value="true">Уникальное оборудование</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] transition"
                  >
                    <Save size={14} />
                    {savingEdit ? "Публикация версии…" : `Опубликовать новую версию (v${item.version + 1})`}
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

