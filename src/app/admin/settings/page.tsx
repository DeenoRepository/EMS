"use client";

import { useState } from "react";
import Link from "next/link";
import ShellLayout from "@/components/layout/shell-layout";
import {
  Save,
  HardDrive,
  KeyRound,
  ShieldCheck,
  Database,
  SlidersHorizontal,
  Gauge,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

export default function ShellGlobalSettingsPage() {
  const [authMode, setAuthMode] = useState<"MOCK" | "LDAP">("MOCK");
  const [storageType, setStorageType] = useState<"LOCAL" | "NETWORK">("LOCAL");
  const [localPath, setLocalPath] = useState("/var/lib/ems/storage");
  const [networkDrivePath, setNetworkDrivePath] = useState("//192.168.1.50/ems_docs_share");
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8">
        {/* Breadcrumbs */}
        <div className="mb-4 flex items-center gap-2 text-[10px] font-medium text-slate-400">
          <Link href="/" className="hover:text-slate-600">Главная</Link>
          <ChevronRight size={12} />
          <span className="text-[#3473d4]">Настройки</span>
        </div>

        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Основные Настройки Платформы Shell
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Глобальные системные параметры ядра (хранилище файлов, аутентификация, системные лимиты).
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
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-4">
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
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-4">
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

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-5 py-2.5 text-xs font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
            >
              <Save size={15} /> Сохранить конфигурацию Shell
            </button>
          </div>
        </form>
      </main>
    </ShellLayout>
  );
}
