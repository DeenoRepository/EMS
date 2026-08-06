"use client";

import { useState } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import Link from "next/link";
import {
  Building2,
  UserCheck,
  Plus,
  X,
  Save,
  Trash2,
  ChevronRight,
  ShieldCheck,
  MapPin,
  RefreshCw,
  Search,
  CheckCircle2,
  Layers,
  Box
} from "lucide-react";

export interface WarehouseSettingItem {
  id: string;
  code: string;
  name: string;
  type: "MAIN" | "SHOP" | "GSM" | "TOOL" | "PPE" | "VIRTUAL";
  location: string;
  responsibleUser: string;
  responsibleUserEmail: string;
  responsibleUserPhone: string;
  capacityStatus: "OK" | "FULL" | "OVERFLOW";
  isActive: boolean;
  notes?: string;
}

export const INITIAL_WAREHOUSES: WarehouseSettingItem[] = [
  {
    id: "wh-001",
    code: "WH-MAIN-ZIP",
    name: "Основной склад ЗИП",
    type: "MAIN",
    location: "Корпус А, Пролет 3-4",
    responsibleUser: "Смирнов А.В.",
    responsibleUserEmail: "smirnov.av@factory.local",
    responsibleUserPhone: "+7 (812) 490-12-01",
    capacityStatus: "OK",
    isActive: true,
    notes: "Центральное хранение запчастей, подшипников и метизов."
  },
  {
    id: "wh-002",
    code: "WH-GSM-02",
    name: "Склад ГСМ №2",
    type: "GSM",
    location: "Отдельный блок Б-12",
    responsibleUser: "Ковалев Д.М.",
    responsibleUserEmail: "kovalev.dm@factory.local",
    responsibleUserPhone: "+7 (812) 490-12-05",
    capacityStatus: "OK",
    isActive: true,
    notes: "Масла, смазочно-охлаждающие жидкости (СОЖ) и индустриальные смазки."
  },
  {
    id: "wh-003",
    code: "WH-SHOP-03",
    name: "Цеховая кладовая №3",
    type: "SHOP",
    location: "Цех №3, Участок ЧПУ",
    responsibleUser: "Сидоров А.Н.",
    responsibleUserEmail: "sidorov.an@factory.local",
    responsibleUserPhone: "+7 (812) 490-12-09",
    capacityStatus: "FULL",
    isActive: true,
    notes: "Оперативный расходный склад для токарно-фрезерных станков."
  },
  {
    id: "wh-004",
    code: "WH-TOOL-01",
    name: "Склад Инструмента и Оснастки",
    type: "TOOL",
    location: "Корпус В, Помещение 104",
    responsibleUser: "Петров В.С.",
    responsibleUserEmail: "petrov.vs@factory.local",
    responsibleUserPhone: "+7 (812) 490-12-14",
    capacityStatus: "OK",
    isActive: true,
    notes: "Режущий инструмент, фрезы, оправки и пластины."
  }
];

export interface StorageCellSettingItem {
  id: string;
  warehouseId: string;
  warehouseName: string;
  rack: string;
  shelf: string;
  cellCode: string;
  barcode: string;
  maxWeightKg: number;
  status: "FREE" | "OCCUPIED" | "RESERVED";
}

export const INITIAL_STORAGE_CELLS: StorageCellSettingItem[] = [
  { id: "cell-01", warehouseId: "wh-001", warehouseName: "Основной склад ЗИП", rack: "A-04", shelf: "3", cellCode: "A-04-3-12", barcode: "4607012948128", maxWeightKg: 500, status: "OCCUPIED" },
  { id: "cell-02", warehouseId: "wh-001", warehouseName: "Основной склад ЗИП", rack: "H-02", shelf: "1", cellCode: "H-02-1-05", barcode: "4607012948773", maxWeightKg: 800, status: "OCCUPIED" },
  { id: "cell-03", warehouseId: "wh-002", warehouseName: "Склад ГСМ №2", rack: "G-01", shelf: "Бочка", cellCode: "G-01-B03", barcode: "4607012948991", maxWeightKg: 1000, status: "OCCUPIED" },
  { id: "cell-04", warehouseId: "wh-003", warehouseName: "Цеховая кладовая №3", rack: "R-03", shelf: "2", cellCode: "R-03-2-C", barcode: "4607012948332", maxWeightKg: 250, status: "FREE" },
  { id: "cell-05", warehouseId: "wh-001", warehouseName: "Основной склад ЗИП", rack: "E-01", shelf: "Блок 14", cellCode: "E-01-14", barcode: "4607012948554", maxWeightKg: 300, status: "OCCUPIED" },
];

export default function WmsSettingsPage() {
  const [activeTab, setActiveTab] = useState<"WAREHOUSES" | "CELLS">("WAREHOUSES");
  const [warehouses, setWarehouses] = useState<WarehouseSettingItem[]>(INITIAL_WAREHOUSES);
  const [cells, setCells] = useState<StorageCellSettingItem[]>(INITIAL_STORAGE_CELLS);
  const [query, setQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWh, setEditingWh] = useState<WarehouseSettingItem | null>(null);

  // Cell Creation State
  const [cellRack, setCellRack] = useState("");
  const [cellShelf, setCellShelf] = useState("");
  const [cellCodeVal, setCellCodeVal] = useState("");
  const [cellWhId, setCellWhId] = useState("wh-001");

  // Form State
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<WarehouseSettingItem["type"]>("MAIN");
  const [location, setLocation] = useState("");
  const [responsibleUser, setResponsibleUser] = useState("");
  const [responsibleUserEmail, setResponsibleUserEmail] = useState("");
  const [responsibleUserPhone, setResponsibleUserPhone] = useState("");
  const [notes, setNotes] = useState("");

  const filteredWarehouses = warehouses.filter(
    (w) =>
      w.name.toLowerCase().includes(query.toLowerCase()) ||
      w.code.toLowerCase().includes(query.toLowerCase()) ||
      w.responsibleUser.toLowerCase().includes(query.toLowerCase())
  );

  const filteredCells = cells.filter(
    (c) =>
      c.cellCode.toLowerCase().includes(query.toLowerCase()) ||
      c.rack.toLowerCase().includes(query.toLowerCase()) ||
      c.warehouseName.toLowerCase().includes(query.toLowerCase())
  );

  const handleAddCell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cellCodeVal.trim()) return;
    const wh = warehouses.find((w) => w.id === cellWhId);
    const newCell: StorageCellSettingItem = {
      id: `cell-${Date.now()}`,
      warehouseId: cellWhId,
      warehouseName: wh ? wh.name : "Основной склад ЗИП",
      rack: cellRack || "A-01",
      shelf: cellShelf || "1",
      cellCode: cellCodeVal.trim(),
      barcode: `4607${Date.now().toString().slice(-9)}`,
      maxWeightKg: 400,
      status: "FREE",
    };
    setCells((prev) => [newCell, ...prev]);
    setCellCodeVal("");
    setCellRack("");
    setCellShelf("");
  };

  const openCreateModal = () => {
    setEditingWh(null);
    setCode(`WH-NEW-${Date.now().toString().slice(-4)}`);
    setName("");
    setType("MAIN");
    setLocation("");
    setResponsibleUser("Смирнов А.В.");
    setResponsibleUserEmail("smirnov.av@factory.local");
    setResponsibleUserPhone("+7 (812) 490-12-01");
    setNotes("");
    setShowAddModal(true);
  };

  const openEditModal = (wh: WarehouseSettingItem) => {
    setEditingWh(wh);
    setCode(wh.code);
    setName(wh.name);
    setType(wh.type);
    setLocation(wh.location);
    setResponsibleUser(wh.responsibleUser);
    setResponsibleUserEmail(wh.responsibleUserEmail);
    setResponsibleUserPhone(wh.responsibleUserPhone);
    setNotes(wh.notes || "");
    setShowAddModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingWh) {
      setWarehouses((prev) =>
        prev.map((w) =>
          w.id === editingWh.id
            ? {
                ...w,
                code: code.trim(),
                name: name.trim(),
                type,
                location: location.trim(),
                responsibleUser: responsibleUser.trim(),
                responsibleUserEmail: responsibleUserEmail.trim(),
                responsibleUserPhone: responsibleUserPhone.trim(),
                notes: notes.trim()
              }
            : w
        )
      );
    } else {
      const newWh: WarehouseSettingItem = {
        id: `wh-${Date.now()}`,
        code: code.trim() || `WH-${Date.now()}`,
        name: name.trim(),
        type,
        location: location.trim() || "Главный пролет",
        responsibleUser: responsibleUser.trim() || "Назначен Заведующий",
        responsibleUserEmail: responsibleUserEmail.trim() || "mol@factory.local",
        responsibleUserPhone: responsibleUserPhone.trim() || "+7 (812) 490-00-00",
        capacityStatus: "OK",
        isActive: true,
        notes: notes.trim()
      };
      setWarehouses((prev) => [...prev, newWh]);
    }
    setShowAddModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Вы действительно хотите удалить этот склад из конфигурации?")) {
      setWarehouses((prev) => prev.filter((w) => w.id !== id));
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Breadcrumbs */}
        <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
          <Link href="/" className="hover:text-slate-600">Главная</Link>
          <ChevronRight size={12} />
          <Link href="/admin/settings" className="hover:text-slate-600">Настройки</Link>
          <ChevronRight size={12} />
          <span className="text-[#3473d4]">Настройки Складов, Ячеек & МОЛ WMS</span>
        </div>

        {/* Page Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Склады, Стеллажи, Адресные Ячейки & Назначение МОЛ
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Администрирование физических мест хранения, топологии стеллажных ячеек и привязка материально ответственных лиц (МОЛ).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-4 py-2 text-[11px] font-semibold text-white shadow-xs hover:bg-[#2565c8] transition"
            >
              <Plus size={14} /> Добавить склад
            </button>
          </div>
        </div>

        {/* Settings Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("WAREHOUSES")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition ${
              activeTab === "WAREHOUSES"
                ? "border-[#3473d4] text-[#3473d4]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Building2 size={14} /> Склады и МОЛ ({warehouses.length})
          </button>

          <button
            onClick={() => setActiveTab("CELLS")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition ${
              activeTab === "CELLS"
                ? "border-[#3473d4] text-[#3473d4]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Box size={14} /> Конфигурация Стеллажей и Ячеек ({cells.length})
          </button>
        </div>

        {activeTab === "WAREHOUSES" ? (
          <>
            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                    Всего складов
                  </span>
                  <div className="rounded-md bg-blue-50 p-1.5 text-[#3473d4]">
                    <Building2 size={14} />
                  </div>
                </div>
                <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
                  {warehouses.length}
                </div>
                <div className="mt-1 text-[10px] text-slate-400">Активно в конфигурации</div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                    Закрепленных МОЛ
                  </span>
                  <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-600">
                    <UserCheck size={14} />
                  </div>
                </div>
                <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
                  {new Set(warehouses.map((w) => w.responsibleUser)).size}
                </div>
                <div className="mt-1 text-[10px] text-emerald-600 font-semibold">Ответственных сотрудников</div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                    Локации и Пролеты
                  </span>
                  <div className="rounded-md bg-indigo-50 p-1.5 text-indigo-600">
                    <MapPin size={14} />
                  </div>
                </div>
                <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
                  {warehouses.length} зонирований
                </div>
                <div className="mt-1 text-[10px] text-slate-400">Указаны точные адреса</div>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
              <div className="relative max-w-md">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Поиск по названию склада, коду или ответственному МОЛ..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-[#f8fafc] pl-9 pr-8 text-[11px] outline-none placeholder:text-slate-400 focus:border-[#3c82ed]"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Warehouses Table Grid */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="hidden border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 md:grid grid-cols-5 gap-4">
                <span>Код & Название Склада</span>
                <span>Тип & Назначение</span>
                <span>Локация / Корпус</span>
                <span>Ответственный (МОЛ)</span>
                <span className="text-right">Действия</span>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {filteredWarehouses.map((wh) => (
                  <div key={wh.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 px-5 py-3.5 hover:bg-slate-50/50 md:items-center transition">
                    <div>
                      <span className="font-mono text-[11px] font-bold text-[#3473d4] block">{wh.code}</span>
                      <span className="font-semibold text-[#17243a] text-[12px]">{wh.name}</span>
                    </div>

                    <div>
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                        {wh.type === "MAIN" ? "Центральный ЗИП" : wh.type === "GSM" ? "Склад ГСМ" : wh.type === "SHOP" ? "Цеховая кладовая" : "Инструментальный"}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-1 text-slate-700 font-medium">
                        <MapPin size={12} className="text-slate-400" />
                        <span>{wh.location}</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded-full bg-blue-50 text-[#3473d4] flex items-center justify-center font-bold text-[10px]">
                          {wh.responsibleUser.slice(0, 2)}
                        </div>
                        <div>
                          <span className="font-bold text-[#17243a] block">{wh.responsibleUser}</span>
                          <span className="text-[10px] text-slate-400 block">{wh.responsibleUserPhone}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(wh)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#3473d4] hover:bg-blue-50"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => handleDelete(wh.id)}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Cells & Topology Configurator Tab */
          <div className="space-y-6">
            <form onSubmit={handleAddCell} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-[#17243a]">Быстрое добавление адресной ячейки хранения</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Склад</label>
                  <select
                    value={cellWhId}
                    onChange={(e) => setCellWhId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-[#3c82ed] bg-white text-xs"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Стеллаж / Ряд</label>
                  <input
                    type="text"
                    placeholder="A-04"
                    value={cellRack}
                    onChange={(e) => setCellRack(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-[#3c82ed] text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Полка / Секция</label>
                  <input
                    type="text"
                    placeholder="Полка 3"
                    value={cellShelf}
                    onChange={(e) => setCellShelf(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-[#3c82ed] text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Код Ячейки <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="A-04-3-12"
                      value={cellCodeVal}
                      onChange={(e) => setCellCodeVal(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-[#3c82ed] text-xs font-mono font-bold"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white hover:bg-[#2565c8] shrink-0"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </form>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="hidden border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 md:grid grid-cols-5 gap-4">
                <span>Код Ячейки</span>
                <span>Склад</span>
                <span>Стеллаж / Полка</span>
                <span>Штрихкод ячейки</span>
                <span className="text-right">Статус</span>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {filteredCells.map((c) => (
                  <div key={c.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 px-5 py-3 md:items-center">
                    <span className="font-mono text-[11px] font-bold text-[#3473d4]">{c.cellCode}</span>
                    <span className="font-semibold text-slate-700">{c.warehouseName}</span>
                    <span className="text-slate-600 font-mono">Стеллаж {c.rack} / Полка {c.shelf}</span>
                    <span className="text-slate-400 font-mono text-[10px]">ШК: {c.barcode}</span>
                    <div className="text-right">
                      <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        c.status === "FREE" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-[#3473d4]"
                      }`}>
                        {c.status === "FREE" ? "Свободна" : "Занята ТМЦ"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal Create/Edit Warehouse */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 my-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-[#3473d4]">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#17243a]">
                      {editingWh ? "Редактирование склада и МОЛ" : "Создание нового склада"}
                    </h3>
                    <p className="text-[10px] text-slate-400">Укажите параметры склада и закрепите ответственного сотрудника</p>
                  </div>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Системный код / Индекс склада</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="WH-MAIN-ZIP"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono focus:border-[#3c82ed] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Наименование склада / кладовой <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Основной склад ЗИП"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-[#3c82ed] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Тип склада</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as any)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-[#3c82ed] focus:outline-none bg-white"
                    >
                      <option value="MAIN">Центральный склад ЗИП</option>
                      <option value="SHOP">Цеховая кладовая</option>
                      <option value="GSM">Склад ГСМ</option>
                      <option value="TOOL">Инструментальный склад</option>
                      <option value="PPE">Склад СИЗ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Локация / Корпус</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Корпус А, Пролет 3-4"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-[#3c82ed] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#3473d4]">
                    Закрепленное Ответственное Лицо (МОЛ)
                  </span>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">ФИО и Должность ответственного</label>
                    <input
                      type="text"
                      required
                      value={responsibleUser}
                      onChange={(e) => setResponsibleUser(e.target.value)}
                      placeholder="Смирнов А.В. (Старший кладовщик)"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-[#3c82ed] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Рабочий Email</label>
                      <input
                        type="email"
                        value={responsibleUserEmail}
                        onChange={(e) => setResponsibleUserEmail(e.target.value)}
                        placeholder="smirnov.av@factory.local"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-[#3c82ed] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Телефон / Добавочный</label>
                      <input
                        type="text"
                        value={responsibleUserPhone}
                        onChange={(e) => setResponsibleUserPhone(e.target.value)}
                        placeholder="+7 (812) 490-12-01"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-[#3c82ed] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Примечание / Описание</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Описание назначения и правил доступа к кладовой..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-[#3c82ed] focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#2565c8]"
                  >
                    <Save size={13} /> Сохранить склад
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
