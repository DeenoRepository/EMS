"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  PageHeader,
  Button,
  Modal,
  ModalHeader,
  ModalFooter,
  FormField,
  Input,
  StatusBadge,
} from "@/components/ui";
import {
  Save,
  HardDrive,
  KeyRound,
  CheckCircle2,
  Warehouse as WarehouseIcon,
  Plus,
  UserCheck,
  Server,
  Network,
} from "lucide-react";

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
        body: JSON.stringify(whFormData),
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
        <PageHeader
          title="Настройки платформы"
          description="Управление файловым хранилищем, авторизацией и складами."
          breadcrumbs={[
            { title: "Администрирование", href: "/admin/settings" },
            { title: "Общие" },
          ]}
          actions={
            saved ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-xs animate-in fade-in duration-200">
                <CheckCircle2 size={14} /> Параметры сохранены
              </span>
            ) : undefined
          }
        />

        <form onSubmit={handleSave} className="space-y-6 w-full">
          {/* File Storage Settings */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                  <HardDrive size={16} className="text-[#3473d4] dark:text-blue-400" /> Файловое хранилище
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Расположение файлов и документов системы.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div
                onClick={() => setStorageType("LOCAL")}
                className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start gap-3 ${
                  storageType === "LOCAL"
                    ? "border-[#3473d4] dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-[#3473d4] dark:ring-blue-500"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <div className={`p-2 rounded-lg ${storageType === "LOCAL" ? "bg-[#3473d4] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                  <Server size={18} />
                </div>
                <div>
                  <span className="font-bold text-xs text-[#17243a] dark:text-slate-200 block">Локальный диск</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Сохранение на сервере EMS.</p>
                </div>
              </div>

              <div
                onClick={() => setStorageType("NETWORK")}
                className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start gap-3 ${
                  storageType === "NETWORK"
                    ? "border-[#3473d4] dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-[#3473d4] dark:ring-blue-500"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <div className={`p-2 rounded-lg ${storageType === "NETWORK" ? "bg-[#3473d4] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                  <Network size={18} />
                </div>
                <div>
                  <span className="font-bold text-xs text-[#17243a] dark:text-slate-200 block">Сетевой диск (NAS)</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Корпоративный сетевой шар.</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              {storageType === "LOCAL" ? (
                <FormField label="Абсолютный путь на сервере">
                  <Input
                    type="text"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                    className="font-mono"
                  />
                </FormField>
              ) : (
                <FormField label="Сетевой путь (UNC / SMB Share)">
                  <Input
                    type="text"
                    value={networkDrivePath}
                    onChange={(e) => setNetworkDrivePath(e.target.value)}
                    className="font-mono"
                  />
                </FormField>
              )}
            </div>
          </div>

          {/* Security & Authentication */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                  <KeyRound size={16} className="text-[#3473d4] dark:text-blue-400" /> Авторизация
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Режим проверки подлинности пользователей.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div
                onClick={() => setAuthMode("MOCK")}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  authMode === "MOCK"
                    ? "border-[#3473d4] dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-[#3473d4] dark:ring-blue-500"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <span className="font-bold text-xs text-[#17243a] dark:text-slate-200 block">Локальный провайдер</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Авторизация по локальной базе пользователей EMS.</p>
              </div>

              <div
                onClick={() => setAuthMode("LDAP")}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  authMode === "LDAP"
                    ? "border-[#3473d4] dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-[#3473d4] dark:ring-blue-500"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <span className="font-bold text-xs text-[#17243a] dark:text-slate-200 block">Active Directory / LDAP</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Корпоративный домен Active Directory.</p>
              </div>
            </div>
          </div>

          {/* Administrative WMS Warehouse & MOL Assignment Section */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                  <WarehouseIcon size={16} className="text-[#3473d4] dark:text-blue-400" /> Склады и МОЛ
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Конфигурирование складов и закрепление материально ответственных лиц.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setShowWhModal(true)}
                className="gap-1.5"
                size="sm"
              >
                <Plus size={14} /> Добавить склад
              </Button>
            </div>

            {loadingWh ? (
              <div className="p-8 text-center text-xs text-slate-400">Загрузка списка складов...</div>
            ) : warehouses.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                Склады не зарегистрированы. Нажмите &quot;Добавить склад&quot; для настройки первого склада.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {warehouses.map((wh) => (
                  <div key={wh.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#17243a] dark:text-slate-200">{wh.name}</span>
                      <StatusBadge status="ACTIVE" label="Активен" />
                    </div>
                    <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <UserCheck size={14} className="text-[#3473d4] dark:text-blue-400" />
                      <span><strong className="font-semibold text-slate-700 dark:text-slate-300">МОЛ:</strong> {wh.responsibleUser}</span>
                    </div>
                    {wh.responsibleUsername && (
                      <div className="mt-1 text-[11px] text-slate-400 font-mono pl-5">
                        Логин: @{wh.responsibleUsername}
                      </div>
                    )}
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800 pt-2 flex justify-between">
                      <span>Ячеек хранения:</span>
                      <strong className="font-semibold text-slate-700 dark:text-slate-300">{wh.storageCells?.length || 0} ед.</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              className="gap-2 px-5"
            >
              <Save size={15} /> Сохранить конфигурацию
            </Button>
          </div>
        </form>

        {/* Modal: Create Warehouse */}
        <Modal open={showWhModal} onClose={() => setShowWhModal(false)} size="lg">
          <ModalHeader
            icon={<WarehouseIcon size={16} />}
            title="Создание склада & Назначение МОЛ"
            subtitle="Укажите наименование склада и материально ответственное лицо"
            onClose={() => setShowWhModal(false)}
          />
          <form onSubmit={handleCreateWarehouse} className="space-y-4 p-5">
            <FormField label="Наименование склада *">
              <Input
                required
                value={whFormData.name}
                onChange={(e) => setWhFormData({ ...whFormData, name: e.target.value })}
                placeholder="Склад №2 (Главный хаб запчастей)"
              />
            </FormField>

            <FormField label="ФИО Ответственного лица (МОЛ) *">
              <Input
                required
                value={whFormData.responsibleUser}
                onChange={(e) => setWhFormData({ ...whFormData, responsibleUser: e.target.value })}
                placeholder="Сидоров П.В. (или Инженер Редактор)"
              />
            </FormField>

            <FormField label="Логин пользователя (Username) МОЛ">
              <Input
                value={whFormData.responsibleUsername}
                onChange={(e) => setWhFormData({ ...whFormData, responsibleUsername: e.target.value })}
                placeholder="editor / admin"
              />
            </FormField>

            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowWhModal(false)}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={creatingWh}
              >
                {creatingWh ? "Сохранение..." : "Назначить & Создать"}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      </main>
    </ShellLayout>
  );
}
