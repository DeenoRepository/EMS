"use client";

import { useState, useMemo } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import WmsSubNav from "@/components/wms/wms-sub-nav";
import {
  Building2,
  Search,
  Plus,
  Warehouse,
  Layers,
  Box,
  UserCheck,
  MapPin,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  ChevronRight,
  Settings
} from "lucide-react";
import Link from "next/link";

interface StorageBin {
  id: string;
  code: string; // e.g. "A-12-04"
  zone: string;
  shelf: string;
  maxCapacity: number;
  currentItemsCount: number;
  occupancyRate: number; // percentage
  status: "NORMAL" | "FULL" | "AVAILABLE" | "MAINTENANCE";
  category?: string;
}

interface WarehouseData {
  id: string;
  name: string;
  code: string;
  address: string;
  molName: string;
  molPhone: string;
  totalBins: number;
  usedBins: number;
  totalCapacityUnits: number;
  usedCapacityUnits: number;
  zones: string[];
}

const MOCK_WAREHOUSES: WarehouseData[] = [
  {
    id: "wh-01",
    name: "Центральный склад ТМЦ и ЗИП (А-1)",
    code: "WH-MAIN-A1",
    address: "Промзона Юг, Блок 4А",
    molName: "Иванов С.В.",
    molPhone: "+7 (999) 111-22-33",
    totalBins: 120,
    usedBins: 94,
    totalCapacityUnits: 5000,
    usedCapacityUnits: 4120,
    zones: ["Зона А (Металл/Запчасти)", "Зона Б (Подшипники)", "Зона В (Электроника)"],
  },
  {
    id: "wh-02",
    name: "Склад ГСМ и Масел (Б-2)",
    code: "WH-OIL-B2",
    address: "Промзона Север, Ангар 12",
    molName: "Петров А.Н.",
    molPhone: "+7 (999) 222-33-44",
    totalBins: 45,
    usedBins: 32,
    totalCapacityUnits: 2000,
    usedCapacityUnits: 1450,
    zones: ["Сектор 1 (Техмасла)", "Сектор 2 (Смазки)", "Сектор 3 (Тара)"],
  },
  {
    id: "wh-03",
    name: "Оперативный склад цеха КИПиА (В-3)",
    code: "WH-KIP-C3",
    address: "Главный корпус, 1 этаж",
    molName: "Сидоров К.М.",
    molPhone: "+7 (999) 333-44-55",
    totalBins: 30,
    usedBins: 18,
    totalCapacityUnits: 800,
    usedCapacityUnits: 420,
    zones: ["Стеллаж 1 (Датчики)", "Стеллаж 2 (Контроллеры)"],
  },
];

const MOCK_BINS: StorageBin[] = [
  { id: "b-01", code: "A-01-01", zone: "Зона А", shelf: "Стеллаж 1 / Полка 1", maxCapacity: 50, currentItemsCount: 42, occupancyRate: 84, status: "NORMAL", category: "Подшипники" },
  { id: "b-02", code: "A-01-02", zone: "Зона А", shelf: "Стеллаж 1 / Полка 2", maxCapacity: 50, currentItemsCount: 50, occupancyRate: 100, status: "FULL", category: "Сальники" },
  { id: "b-03", code: "A-02-01", zone: "Зона А", shelf: "Стеллаж 2 / Полка 1", maxCapacity: 100, currentItemsCount: 15, occupancyRate: 15, status: "AVAILABLE", category: "Фильтры" },
  { id: "b-04", code: "B-01-01", zone: "Зона Б", shelf: "Стеллаж 1 / Полка 1", maxCapacity: 30, currentItemsCount: 28, occupancyRate: 93, status: "NORMAL", category: "Датчики" },
  { id: "b-05", code: "B-01-02", zone: "Зона Б", shelf: "Стеллаж 1 / Полка 2", maxCapacity: 40, currentItemsCount: 0, occupancyRate: 0, status: "AVAILABLE", category: "Пусто" },
  { id: "b-06", code: "C-03-01", zone: "Зона В", shelf: "Стеллаж 3 / Полка 1", maxCapacity: 20, currentItemsCount: 18, occupancyRate: 90, status: "NORMAL", category: "Ремни ГРМ" },
  { id: "b-07", code: "C-03-02", zone: "Зона В", shelf: "Стеллаж 3 / Полка 2", maxCapacity: 25, currentItemsCount: 25, occupancyRate: 100, status: "FULL", category: "Муфты" },
  { id: "b-08", code: "C-04-01", zone: "Зона В", shelf: "Стеллаж 4 / Полка 1", maxCapacity: 60, currentItemsCount: 0, occupancyRate: 0, status: "MAINTENANCE", category: "Инвентаризация" },
];

export default function WmsWarehousesPage() {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("wh-01");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedZone, setSelectedZone] = useState<string>("ALL");

  const currentWarehouse = useMemo(() => {
    return MOCK_WAREHOUSES.find((w) => w.id === selectedWarehouseId) || MOCK_WAREHOUSES[0];
  }, [selectedWarehouseId]);

  const filteredBins = useMemo(() => {
    return MOCK_BINS.filter((bin) => {
      if (selectedZone !== "ALL" && !bin.zone.includes(selectedZone)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          bin.code.toLowerCase().includes(q) ||
          bin.shelf.toLowerCase().includes(q) ||
          (bin.category && bin.category.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [selectedZone, searchQuery]);

  const getStatusBadge = (status: StorageBin["status"]) => {
    switch (status) {
      case "FULL":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-semibold text-rose-700 border border-rose-100">
            Заполнена (100%)
          </span>
        );
      case "NORMAL":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 border border-emerald-100">
            В норме
          </span>
        );
      case "AVAILABLE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-[#3473d4] border border-blue-100">
            Свободна
          </span>
        );
      case "MAINTENANCE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700 border border-amber-100">
            Обслуживание
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-5">
        {/* Sub-Nav Bar */}
        <WmsSubNav />

        {/* Action Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <h2 className="text-base font-bold text-slate-900">Склады, Зоны и Ячейки хранения</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Мониторинг задействования складских площадей, адресного хранения и размещения номенклатуры
            </p>
          </div>
          <Link
            href="/admin/settings/wms"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <Settings size={14} /> Настройка складов и МОЛ
          </Link>
        </div>

        {/* Warehouse Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MOCK_WAREHOUSES.map((wh) => {
            const isSelected = wh.id === selectedWarehouseId;
            const occupancyPct = Math.round((wh.usedCapacityUnits / wh.totalCapacityUnits) * 100);

            return (
              <div
                key={wh.id}
                onClick={() => setSelectedWarehouseId(wh.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? "border-[#3473d4] bg-blue-50/20 ring-2 ring-[#3473d4]/20 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${isSelected ? "bg-[#3473d4] text-white" : "bg-slate-100 text-slate-600"}`}>
                      <Building2 size={18} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{wh.code}</span>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">{wh.name}</h3>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="flex items-center gap-1 text-[11px]"><MapPin size={12} /> {wh.address}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="flex items-center gap-1 text-[11px]"><UserCheck size={12} /> МОЛ: {wh.molName}</span>
                    <span className="text-[10px] font-semibold text-slate-600">{wh.molPhone}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Занято ячеек / ёмкость</span>
                    <span className="font-bold text-slate-900">{wh.usedBins} / {wh.totalBins} ({occupancyPct}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        occupancyPct > 85 ? "bg-amber-500" : "bg-[#3473d4]"
                      }`}
                      style={{ width: `${occupancyPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bins & Storage Grid Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Warehouse size={16} className="text-[#3473d4]" />
                Карта ячеек адресного хранения: {currentWarehouse.name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Отображение текущей загруженности ячеек и привязанных категорий номенклатуры
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Поиск ячейки или стеллажа..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#3473d4]"
                />
              </div>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="h-8 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700 font-medium"
              >
                <option value="ALL">Все зоны склада</option>
                <option value="Зона А">Зона А</option>
                <option value="Зона Б">Зона Б</option>
                <option value="Зона В">Зона В</option>
              </select>
            </div>
          </div>

          {/* Bins Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
            {filteredBins.map((bin) => (
              <div
                key={bin.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded-md">
                      {bin.code}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600">{bin.zone}</span>
                  </div>
                  {getStatusBadge(bin.status)}
                </div>

                <div className="mt-3 text-xs space-y-1">
                  <div className="text-slate-500 text-[11px]">{bin.shelf}</div>
                  <div className="font-semibold text-slate-800">
                    Категория: <span className="text-[#3473d4]">{bin.category || "Общая"}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Загрузка ячейки</span>
                    <span className="font-bold text-slate-800">{bin.currentItemsCount} / {bin.maxCapacity} ед. ({bin.occupancyRate}%)</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        bin.occupancyRate >= 90 ? "bg-rose-500" : bin.occupancyRate >= 50 ? "bg-emerald-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${bin.occupancyRate}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </ShellLayout>
  );
}
