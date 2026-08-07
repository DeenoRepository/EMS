"use client";

import { useState, use } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { useShell } from "@/components/layout/shell-context";
import { MOCK_WMS_ITEMS, MOCK_WMS_MOVEMENTS, WmsItem, canUserManageItem, getWarehouseResponsibleUser } from "@/lib/modules/wms-store";
import {
  ChevronRight,
  ArrowLeft,
  Box,
  QrCode,
  Printer,
  History,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Wrench,
  UserCheck,
  Building2,
  Calendar,
  DollarSign,
  Plus,
  RefreshCw,
  X,
  FileSpreadsheet,
  PackageCheck,
  Archive,
  Activity,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Barcode,
  Cpu,
  Edit,
  Download
} from "lucide-react";
import Link from "next/link";
import WmsItemForm from "@/components/wms/wms-item-form";

export default function WmsItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { currentUser } = useShell();

  const resolvedParams = use(params);
  const itemId = resolvedParams.id;

  const [items, setItems] = useState<WmsItem[]>(MOCK_WMS_ITEMS);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"passport" | "movements" | "compatibility">("passport");

  const item = items.find((i) => i.id === itemId) || items[0];
  const itemMovements = MOCK_WMS_MOVEMENTS.filter((m) => m.itemId === item.id || m.itemSku === item.sku);

  const canEdit = canUserManageItem(currentUser, item);
  const responsibleUser = item.responsibleUser || getWarehouseResponsibleUser(item.warehouse);

  const getStatusBadge = (status: WmsItem["status"]) => {
    switch (status) {
      case "IN_STOCK":
        return { bg: "bg-emerald-50 text-emerald-700 border-emerald-200/60", dot: "bg-emerald-500", label: "В наличии" };
      case "LOW_STOCK":
        return { bg: "bg-amber-50 text-amber-700 border-amber-200/60", dot: "bg-amber-500", label: "Дефицит / Мало" };
      case "OUT_OF_STOCK":
        return { bg: "bg-rose-50 text-rose-700 border-rose-200/60", dot: "bg-rose-500", label: "Отсутствует" };
      case "OVERSTOCKED":
        return { bg: "bg-blue-50 text-[#3473d4] border-blue-200/60", dot: "bg-[#3473d4]", label: "Избыток" };
      default:
        return { bg: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400", label: "Черновик" };
    }
  };

  const statusBadge = getStatusBadge(item.status);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-5">
        {/* Top Header Block: Breadcrumbs & Main Actions */}
        <div>
          {/* Breadcrumbs */}
          <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
            <Link href="/" className="hover:text-slate-600">Главная</Link>
            <ChevronRight size={12} />
            <Link href="/modules/wms" className="hover:text-slate-600">WMS Склад</Link>
            <ChevronRight size={12} />
            <span className="text-[#3473d4] font-semibold">{item.sku}</span>
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
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${canEdit ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  <UserCheck size={11} className={canEdit ? "text-emerald-600" : "text-slate-400"} />
                  МОЛ склада: {responsibleUser}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>Артикул / SKU: <span className="font-mono font-bold text-[#3473d4]">{item.sku}</span></span>
                <span className="text-slate-300">•</span>
                <span>Категория: <span className="font-medium text-slate-700">{item.category}</span></span>
                <span className="text-slate-300">•</span>
                <span>Склад: <span className="font-medium text-slate-700">{item.warehouse}</span></span>
              </div>
            </div>

            {/* Action Buttons Header */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition"
              >
                <Printer size={13} /> Печать этикетки QR
              </button>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] transition cursor-pointer"
                >
                  <Edit size={13} /> Редактировать карточку
                </button>
              ) : (
                <div
                  title={`Редактирование доступно только МОЛ склада: ${responsibleUser}`}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2 text-[11px] font-medium text-slate-400 cursor-not-allowed"
                >
                  <ShieldAlert size={13} className="text-slate-400" /> Только для МОЛ
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Executive Metric Cards Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Текущий остаток
              </span>
              <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-500">
                <PackageCheck size={14} />
              </div>
            </div>
            <div className="mt-2 text-[20px] font-bold tracking-tight text-[#17243a]">
              {item.quantity} {item.unit}
            </div>
            <div className="mt-1 text-[10px] text-emerald-600 font-medium">В наличии на складе</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Неснижаемый минимум
              </span>
              <div className="rounded-md bg-amber-50 p-1.5 text-amber-500">
                <AlertTriangle size={14} />
              </div>
            </div>
            <div className="mt-2 text-[20px] font-bold tracking-tight text-[#17243a]">
              {item.minQuantity} {item.unit}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Мин. порог закупки</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Зарезервировано
              </span>
              <div className="rounded-md bg-blue-50 p-1.5 text-[#3473d4]">
                <Archive size={14} />
              </div>
            </div>
            <div className="mt-2 text-[20px] font-bold tracking-tight text-[#17243a]">
              {item.reservedQuantity} {item.unit}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Под плановые ремонты</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Балансовая стоимость
              </span>
              <div className="rounded-md bg-indigo-50 p-1.5 text-indigo-500">
                <DollarSign size={14} />
              </div>
            </div>
            <div className="mt-2 text-[20px] font-bold tracking-tight text-emerald-600 font-mono">
              {(item.quantity * item.unitPrice).toLocaleString("ru-RU")} ₽
            </div>
            <div className="mt-1 text-[10px] text-slate-400">{item.unitPrice.toLocaleString("ru-RU")} ₽/ед.</div>
          </div>
        </div>

        {/* Unified Tabbed Content Card Block (Single Block Container) */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* Tab Sub-navigation Bar */}
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
              <Box size={14} /> Складской паспорт ТМЦ
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("movements")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[11px] font-bold transition -mb-px ${
                activeTab === "movements"
                  ? "border-[#2f74df] text-[#2f74df] bg-white shadow-2xs"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/80"
              }`}
            >
              <History size={14} /> История движения ({itemMovements.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("compatibility")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[11px] font-bold transition -mb-px ${
                activeTab === "compatibility"
                  ? "border-[#2f74df] text-[#2f74df] bg-white shadow-2xs"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/80"
              }`}
            >
              <Wrench size={14} /> Совместимость с EPS ({item.compatibleEquipment?.length || 0})
            </button>
          </div>

          {/* Card Body: Active Tab Content */}
          <div className="p-6 bg-white">
            {/* Tab 1: Passport Overview Specification Grid */}
            {activeTab === "passport" && (
              <div className="space-y-6">
                <div className="grid gap-8 md:grid-cols-3">
                  {/* Section 1: Storage & Identity Specs */}
                  <div className="space-y-4 md:col-span-2">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <div className="rounded-md bg-blue-50 p-1 text-[#3473d4]">
                        <Barcode size={15} />
                      </div>
                      <h2 className="text-[13px] font-bold text-[#17243a]">
                        1. Складские и реквизитные параметры ТМЦ
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-slate-100 text-[11px]">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                          <span className="text-slate-400 font-medium">Артикул / SKU:</span>
                          <span className="font-mono font-bold text-[#3473d4]">{item.sku}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                          <span className="text-slate-400 font-medium">Склад хранения:</span>
                          <span className="font-semibold text-slate-700">{item.warehouse}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                          <span className="text-slate-400 font-medium">Ячейка / Место:</span>
                          <span className="font-mono font-bold text-[#3473d4]">{item.cell}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                          <span className="text-slate-400 font-medium">Тип номенклатуры:</span>
                          <span className="font-semibold text-slate-700">{item.type}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                          <span className="text-slate-400 font-medium">Цена за единицу:</span>
                          <span className="font-semibold text-slate-700">{item.unitPrice.toLocaleString("ru-RU")} ₽</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                          <span className="text-slate-400 font-medium">Поставщик:</span>
                          <span className="font-semibold text-slate-700">{item.supplier || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                          <span className="text-slate-400 font-medium">Ответственный:</span>
                          <span className="font-semibold text-slate-700">{item.responsibleUser || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                          <span className="text-slate-400 font-medium">Штрихкод / QR:</span>
                          <span className="font-mono text-slate-700">{item.barcode || "—"}</span>
                        </div>
                      </div>
                    </div>

                    {item.description && (
                      <div className="pt-2">
                        <span className="text-slate-400 font-medium text-[10px] uppercase block mb-1">Описание номенклатуры</span>
                        <p className="text-[12px] text-slate-600 bg-slate-50/70 p-3 rounded-lg border border-slate-100 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Section 2: QR Marking Card Sidebar */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <div className="rounded-md bg-indigo-50 p-1 text-indigo-600">
                        <QrCode size={15} />
                      </div>
                      <h2 className="text-[13px] font-bold text-[#17243a]">
                        2. Маркировка & QR
                      </h2>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 text-center space-y-3">
                      <div className="flex justify-center">
                        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col items-center gap-2">
                          <QrCode size={110} className="text-slate-800" />
                          <span className="font-mono text-[11px] font-bold text-slate-700">{item.barcode || item.sku}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Сканируйте для инвентаризации или вычитки со склада
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 3: Technical Specifications */}
                {item.techSpecs && Object.keys(item.techSpecs).length > 0 && (
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-violet-50 p-1 text-violet-600">
                        <Cpu size={15} />
                      </div>
                      <h2 className="text-[13px] font-bold text-[#17243a]">
                        3. Технические характеристики
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {Object.entries(item.techSpecs).map(([key, val]) => (
                        <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">{key.replace(/_/g, " ")}</span>
                          <span className="text-[12px] font-bold text-slate-800 mt-0.5 block">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Movements History */}
            {activeTab === "movements" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-[13px] font-bold text-[#17243a] flex items-center gap-2">
                    <History size={16} className="text-[#3473d4]" /> Хронология складских операций
                  </h2>
                  <Link href="/modules/wms/movements" className="text-[11px] font-semibold text-[#3473d4] hover:underline">
                    Перейти в полный журнал →
                  </Link>
                </div>

                {itemMovements.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">Записей о перемещениях не найдено.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {itemMovements.map((mov) => (
                      <div key={mov.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <div className="font-bold text-[#17243a] flex items-center gap-2">
                            <span>{mov.type === "OUTGOING" ? "Расход / Списание" : mov.type === "INCOMING" ? "Приход / Поступление" : "Перемещение"}</span>
                            <span className="font-mono text-[#3473d4] font-bold">{mov.quantity} {item.unit}</span>
                          </div>
                          <p className="text-slate-500 text-[11px] mt-0.5">{mov.reason}</p>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {mov.fromLocation} → {mov.toLocation} | {mov.performedBy}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 shrink-0">
                          {new Date(mov.timestamp).toLocaleDateString("ru-RU")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: EPS Equipment Compatibility */}
            {activeTab === "compatibility" && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-[13px] font-bold text-[#17243a] flex items-center gap-2">
                    <Wrench size={16} className="text-[#3473d4]" /> Совместимое промышленное оборудование EPS
                  </h2>
                </div>

                {item.compatibleEquipment && item.compatibleEquipment.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {item.compatibleEquipment.map((eqCode) => (
                      <div key={eqCode} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
                        <div>
                          <span className="font-mono font-bold text-[#3473d4] text-[12px] block">{eqCode}</span>
                          <span className="text-[10px] text-slate-400">Специфицированная запчасть / ЗИП</span>
                        </div>
                        <Link href="/modules/eps" className="text-[11px] font-semibold text-[#3473d4] hover:underline">
                          Паспорт EPS →
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-6 text-center">Совместимое оборудование EPS не привязано.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Edit Modal */}
        <WmsItemForm
          initialData={item}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          existingItems={items}
          onSubmitSuccess={(updated) => {
            setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          }}
        />
      </main>
    </ShellLayout>
  );
}
