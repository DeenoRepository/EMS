"use client";

import { useState, use } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { MOCK_WMS_ITEMS, MOCK_WMS_MOVEMENTS, WmsItem } from "@/lib/modules/wms-store";
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
  FileSpreadsheet
} from "lucide-react";
import Link from "next/link";
import WmsItemForm from "@/components/wms/wms-item-form";

export default function WmsItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const itemId = resolvedParams.id;

  const [items, setItems] = useState<WmsItem[]>(MOCK_WMS_ITEMS);
  const [showEditModal, setShowEditModal] = useState(false);

  const item = items.find((i) => i.id === itemId) || items[0];

  const itemMovements = MOCK_WMS_MOVEMENTS.filter((m) => m.itemId === item.id || m.itemSku === item.sku);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Navigation & Header */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
            <Link href="/" className="hover:text-slate-600">Главная</Link>
            <ChevronRight size={12} />
            <Link href="/modules/wms" className="hover:text-slate-600">WMS Склад</Link>
            <ChevronRight size={12} />
            <span className="text-[#3473d4]">{item.sku}</span>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/modules/wms"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              >
                <ArrowLeft size={16} />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#3473d4] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    {item.sku}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    {item.category}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-[#17243a] mt-1">{item.name}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-50"
              >
                <Printer size={13} /> Печать этикетки QR
              </button>
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-4 py-2 text-[11px] font-semibold text-white shadow-xs hover:bg-[#2565c8]"
              >
                Редактировать карточку
              </button>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info Columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* General Specs Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-[#17243a] border-b border-slate-100 pb-3 flex items-center gap-2">
                <Box size={16} className="text-purple-600" /> Основные параметры ТМЦ / ЗИП
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Склад хранения</span>
                  <span className="font-semibold text-slate-700">{item.warehouse}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Ячейка / Место</span>
                  <span className="font-mono font-semibold text-purple-700">{item.cell}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Тип ТМЦ</span>
                  <span className="font-semibold text-slate-700">{item.type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Текущий остаток</span>
                  <span className="font-bold text-slate-900">{item.quantity} {item.unit}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Мин. неснижаемый порог</span>
                  <span className="font-semibold text-amber-600">{item.minQuantity} {item.unit}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Зарезервировано</span>
                  <span className="font-semibold text-blue-600">{item.reservedQuantity} {item.unit}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Цена за единицу</span>
                  <span className="font-semibold text-slate-800">{item.unitPrice.toLocaleString("ru-RU")} ₽</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Стоимость остатка</span>
                  <span className="font-bold text-emerald-600">{(item.quantity * item.unitPrice).toLocaleString("ru-RU")} ₽</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Ответственный</span>
                  <span className="font-semibold text-slate-700">{item.responsibleUser || "—"}</span>
                </div>
              </div>

              {item.description && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1">Описание</span>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                </div>
              )}
            </div>

            {/* Technical Specifications */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-[#17243a] border-b border-slate-100 pb-3 flex items-center gap-2">
                <Wrench size={16} className="text-purple-600" /> Технические характеристики
              </h2>

              {item.techSpecs && Object.keys(item.techSpecs).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {Object.entries(item.techSpecs).map(([key, val]) => (
                    <div key={key} className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-500 capitalize">{key.replace(/_/g, " ")}:</span>
                      <span className="font-semibold text-slate-800">{val}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Спецификации не указаны.</p>
              )}
            </div>

            {/* Movements History */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-[#17243a] border-b border-slate-100 pb-3 flex items-center gap-2">
                <History size={16} className="text-purple-600" /> История движения позиции
              </h2>

              <div className="space-y-3">
                {itemMovements.length === 0 ? (
                  <p className="text-xs text-slate-400">Записей о перемещениях не найдено.</p>
                ) : (
                  itemMovements.map((mov) => (
                    <div key={mov.id} className="flex items-start justify-between rounded-lg border border-slate-100 p-3 text-xs bg-slate-50/50">
                      <div>
                        <div className="font-semibold text-[#17243a]">
                          {mov.type === "OUTGOING" ? "Расход / Списание" : mov.type === "INCOMING" ? "Приход / Поступление" : "Перемещение"}
                          <span className="ml-2 font-mono text-purple-700">{mov.quantity} {item.unit}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{mov.reason}</p>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {mov.fromLocation} → {mov.toLocation} | {mov.performedBy}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(mov.timestamp).toLocaleDateString("ru-RU")}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar: QR Code & Compatibility */}
          <div className="space-y-6">
            {/* QR Label Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 text-center">
              <h3 className="text-xs font-bold text-[#17243a] uppercase tracking-wider text-slate-500">
                Маркировка & QR-код WMS
              </h3>
              <div className="flex justify-center py-2">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center gap-2">
                  <QrCode size={120} className="text-slate-800" />
                  <span className="font-mono text-xs font-bold text-slate-700">{item.barcode || item.sku}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Сканируйте для моментального проведения инвентаризации или вычитки со склада.
              </p>
            </div>

            {/* EPS Equipment Compatibility */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-[#17243a] uppercase tracking-wider text-slate-500">
                Совместимость с EPS
              </h3>
              {item.compatibleEquipment && item.compatibleEquipment.length > 0 ? (
                <div className="space-y-2">
                  {item.compatibleEquipment.map((eqCode) => (
                    <div key={eqCode} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                      <span className="font-mono font-bold text-purple-700">{eqCode}</span>
                      <Link href="/modules/eps" className="text-[10px] font-semibold text-purple-600 hover:underline">
                        Паспорт EPS →
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Совместимое оборудование не привязано.</p>
              )}
            </div>
          </div>
        </div>

        {/* Edit Modal */}
        <WmsItemForm
          initialData={item}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSubmitSuccess={(updated) => {
            setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          }}
        />
      </main>
    </ShellLayout>
  );
}
