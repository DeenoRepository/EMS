"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import {
  Save,
  HardDrive,
  KeyRound,
  CheckCircle2,
  Warehouse as WarehouseIcon,
  Plus,
  UserCheck,
  MapPin,
  RefreshCw
} from "lucide-react";
import { Modal, ModalHeader, StatusBadge } from "@/components/ui";

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

export default function ShellGlobalSettingsPage() {
  const [authMode, setAuthMode] = useState<"MOCK" | "LDAP">("MOCK");
  const [storageType, setStorageType] = useState<"LOCAL" | "NETWORK">("LOCAL");
  const [localPath, setLocalPath] = useState("/var/lib/ems/storage");
  const [networkDrivePath, setNetworkDrivePath] = useState("//192.168.1.50/ems_docs_share");
  const [saved, setSaved] = useState(false);

  // WMS Warehouses Admin Management State
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingWh, setLoadingWh] = useState(true);
  const [showWhModal, setShowWhModal] = useState(false);
  const [creatingWh, setCreatingWh] = useState(false);
  const [whFormData, setWhFormData] = useState({
    name: "",
    responsibleUser: "",
    responsibleUsername: "",
  });

  const fetchWarehouses = () => {
    setLoadingWh(true);
    fetch("/api/modules/wms/warehouses")
      .then((res) => (res.ok ? res.json() : { warehouses: [] }))
      .then((data) => setWarehouses(data.warehouses || []))
      .catch((err) => console.error("Failed to load warehouses:", err))
      .finally(() => setLoadingWh(false));
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingWh(true);
    try {
      const res = await fetch("/api/modules/wms/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(whFormData)
      });
      if (res.ok) {
        setShowWhModal(false);
        setWhFormData({ name: "", responsibleUser: "", responsibleUsername: "" });
        fetchWarehouses();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка создания склада");
      }
    } catch (err) {
      console.error("Create warehouse error:", err);
    } finally {
      setCreatingWh(false);
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <Breadcrumbs items={[{ label: "Настройки" }]} />

        {/* Page Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Основные Настройки Платформы Shell
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Глобальные системные параметры ядра (хранилище файлов, аутентификация, конфигурация складов и МОЛ).
            </p>
          </div>
          {saved && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
              <CheckCircle2 size={14} /> Параметры сохранены
            </span>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6 w-full max-w-4xl">
          {/* File Storage Settings */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2 border-b border-slate-100 pb-3 text-[#17243a]">
              <HardDrive size={16} className="text-[#3473d4]" /> Хранилище Файлов и Документов
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => setStorageType("LOCAL")}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  storageType === "LOCAL"
                    ? "border-[#3473d4] bg-blue-50/50 ring-1 ring-[#3473d4]"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="font-bold text-xs text-[#17243a] block">Локальный Диск Сервера</span>
                <p className="text-[11px] text-slate-500 mt-1">Хранение оригиналов документов на физическом сервере EMS.</p>
              </div>

              <div
                onClick={() => setStorageType("NETWORK")}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  storageType === "NETWORK"
                    ? "border-[#3473d4] bg-blue-50/50 ring-1 ring-[#3473d4]"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="font-bold text-xs text-[#17243a] block">Сетевой Диск (NAS / SMB)</span>
                <p className="text-[11px] text-slate-500 mt-1">Корпоративный удаленный сетевой шар хранения.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              {storageType === "LOCAL" ? (
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Путь к файлам на сервере</label>
                  <input
                    type="text"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Сетевой путь (UNC Path / SMB Share)</label>
                  <input
                    type="text"
                    value={networkDrivePath}
                    onChange={(e) => setNetworkDrivePath(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Security & Authentication */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2 border-b border-slate-100 pb-3 text-[#17243a]">
              <KeyRound size={16} className="text-[#3473d4]" /> Интеграция Учетных Записей & Провайдеры
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => setAuthMode("MOCK")}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  authMode === "MOCK"
                    ? "border-[#3473d4] bg-blue-50/50 ring-1 ring-[#3473d4]"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="font-bold text-xs text-[#17243a] block">Локальный Mock Провайдер</span>
                <p className="text-[11px] text-slate-500 mt-1">Авторизация по локальной БД пользователей без Active Directory.</p>
              </div>

              <div
                onClick={() => setAuthMode("LDAP")}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  authMode === "LDAP"
                    ? "border-[#3473d4] bg-blue-50/50 ring-1 ring-[#3473d4]"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="font-bold text-xs text-[#17243a] block">Корпоративный Active Directory / LDAP</span>
                <p className="text-[11px] text-slate-500 mt-1">Сквозная SSO авторизация через доменные службы Enterprise.</p>
              </div>
            </div>
          </div>

          {/* Administrative WMS Warehouse & MOL Assignment Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a]">
                  <WarehouseIcon size={16} className="text-[#3473d4]" /> Управление Складами & Назначение МОЛ (WMS)
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Конфигурирование складов и закрепление материально ответственных лиц (МОЛ) администратором.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWhModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#2565c8]"
              >
                <Plus size={14} /> Добавить склад & МОЛ
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {warehouses.map((wh) => (
                <div key={wh.id} className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#17243a]">{wh.name}</span>
                    <StatusBadge status="ACTIVE" label="Активен" />
                  </div>
                  <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-1">
                    <UserCheck size={12} className="text-[#3473d4]" />
                    <span className="font-semibold">Ответственный (МОЛ):</span> {wh.responsibleUser}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400 font-mono">
                    Ячеек на хранении: {wh.storageCells.length} ед.
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-4 py-2.5 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] transition"
            >
              <Save size={14} /> Сохранить глобальные параметры
            </button>
          </div>
        </form>

        {/* Modal: Create Warehouse in Shell Settings */}
        <Modal open={showWhModal} onClose={() => setShowWhModal(false)} size="lg">
          <ModalHeader
            icon={<WarehouseIcon size={16} />}
            title="Создание склада & Назначение МОЛ"
            subtitle="Укажите параметры склада и ответственного сотрудника"
            onClose={() => setShowWhModal(false)}
          />
          <form onSubmit={handleCreateWarehouse} className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Наименование склада *</label>
              <input
                required
                value={whFormData.name}
                onChange={(e) => setWhFormData({ ...whFormData, name: e.target.value })}
                placeholder="Склад №2 (Главный хаб запчастей)"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">ФИО Ответственного лица (МОЛ) *</label>
              <input
                required
                value={whFormData.responsibleUser}
                onChange={(e) => setWhFormData({ ...whFormData, responsibleUser: e.target.value })}
                placeholder="Сидоров П.В. (или Инженер Редактор)"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Логин пользователя (Username) МОЛ</label>
              <input
                value={whFormData.responsibleUsername}
                onChange={(e) => setWhFormData({ ...whFormData, responsibleUsername: e.target.value })}
                placeholder="editor / admin"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowWhModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={creatingWh}
                className="rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8] disabled:opacity-50"
              >
                {creatingWh ? "Сохранение..." : "Назначить & Создать"}
              </button>
            </div>
          </form>
        </Modal>
      </main>
    </ShellLayout>
  );
}
