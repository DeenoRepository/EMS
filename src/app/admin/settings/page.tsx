"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  PageHeader,
  Button,
  FormField,
  Input,
} from "@/components/ui";
import {
  Sliders,
  Palette,
  Bell,
  ShieldCheck,
  HardDrive,
  Layers,
  Save,
  CheckCircle2,
  Building2,
  Clock,
  Globe,
  Terminal,
  SunMoon,
  PanelLeft,
  AlertTriangle,
  Radio,
  Lock,
  Timer,
  Server,
  UploadCloud,
  FileText,
  RotateCcw,
  Sparkles,
  AppWindow,
  Cpu,
} from "lucide-react";

interface ShellSettingsData {
  systemTitle: string;
  organizationName: string;
  timezone: string;
  defaultLocale: string;
  dateFormat: string;
  logLevel: "ERROR" | "WARN" | "INFO" | "DEBUG";

  theme: "SYSTEM" | "LIGHT" | "DARK";
  primaryColor: string;
  compactNav: boolean;
  showHeaderLogo: boolean;

  maintenanceBanner: string;
  maintenanceLevel: "INFO" | "WARNING" | "CRITICAL";
  enableGlobalNotifications: boolean;

  sessionTimeoutMinutes: number;
  enforce2FA: boolean;
  rateLimitStrict: boolean;

  storageDriver: "LOCAL" | "MINIO" | "S3";
  maxUploadMB: number;
  allowedExtensions: string;

  activeModules: {
    eps: boolean;
    wms: boolean;
    audit: boolean;
    rbac: boolean;
  };
  defaultStartupRoute: string;
}

const DEFAULT_SETTINGS: ShellSettingsData = {
  systemTitle: "EMS Platform — Единый Корпоративный Шелл",
  organizationName: "ПАО «ЭнергоМашСервис»",
  timezone: "Europe/Moscow (UTC+3)",
  defaultLocale: "ru-RU",
  dateFormat: "DD.MM.YYYY HH:mm",
  logLevel: "INFO",

  theme: "SYSTEM",
  primaryColor: "#3473d4",
  compactNav: false,
  showHeaderLogo: true,

  maintenanceBanner: "",
  maintenanceLevel: "INFO",
  enableGlobalNotifications: true,

  sessionTimeoutMinutes: 120,
  enforce2FA: false,
  rateLimitStrict: true,

  storageDriver: "MINIO",
  maxUploadMB: 50,
  allowedExtensions: "pdf, dwg, step, xlsx, docx, png, jpg, zip",

  activeModules: {
    eps: true,
    wms: true,
    audit: true,
    rbac: true,
  },
  defaultStartupRoute: "/eps/dashboard",
};

const COLOR_PALETTES = [
  { name: "Enterprise Blue", value: "#3473d4", bg: "bg-[#3473d4]" },
  { name: "Emerald Tech", value: "#10b981", bg: "bg-emerald-500" },
  { name: "Indigo Modern", value: "#6366f1", bg: "bg-indigo-500" },
  { name: "Slate Corporate", value: "#475569", bg: "bg-slate-600" },
  { name: "Crimson Industrial", value: "#e11d48", bg: "bg-rose-600" },
];

export default function ShellGlobalSettingsPage() {
  const [settings, setSettings] = useState<ShellSettingsData>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<"general" | "appearance" | "notifications" | "security" | "storage" | "modules">("general");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        showToast("Настройки Shell и приложения успешно сохранены!");
      } else {
        const err = await res.json();
        showToast(err.error || "Ошибка сохранения настроек", "error");
      }
    } catch (err) {
      console.error("Save settings error:", err);
      showToast("Сетевая ошибка при сохранении параметров", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (confirm("Вы уверены, что хотите сбросить настройки Shell к параметрам по умолчанию?")) {
      setSettings(DEFAULT_SETTINGS);
      showToast("Параметры сброшены к значениям по умолчанию");
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6 max-w-7xl mx-auto">
        <PageHeader
          title="Основные настройки Shell и Платформы"
          description="Централизованное конфигурирование параметров корпоративного шелла, оформление, безопасность и системные модули."
          breadcrumbs={[
            { title: "Администрирование", href: "/admin/settings" },
            { title: "Основные настройки" },
          ]}
          actions={
            toast ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold shadow-xs border transition-all animate-in fade-in duration-200 ${
                  toast.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                }`}
              >
                <CheckCircle2 size={14} /> {toast.text}
              </span>
            ) : undefined
          }
        />

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "general"
                ? "bg-[#3473d4] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Sliders size={15} /> Общие параметры Shell
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("appearance")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "appearance"
                ? "bg-[#3473d4] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Palette size={15} /> Внешний вид и Брендинг
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "notifications"
                ? "bg-[#3473d4] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Bell size={15} /> Оповещения и Баннеры
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "security"
                ? "bg-[#3473d4] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <ShieldCheck size={15} /> Безопасность и Сессии
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("storage")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "storage"
                ? "bg-[#3473d4] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <HardDrive size={15} /> Файловое хранилище
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("modules")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "modules"
                ? "bg-[#3473d4] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Layers size={15} /> Модули Платформы
          </button>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="space-y-6">
          {isLoading ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-xs text-slate-400">
              Загрузка конфигурации Shell...
            </div>
          ) : (
            <>
              {/* TAB 1: GENERAL SETTINGS */}
              {activeTab === "general" && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-5">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                      <Sliders size={16} className="text-[#3473d4] dark:text-blue-400" /> Идентификация и параметры Shell
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Базовые метаданные приложения, организация, системные локали и форматирование даты.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormField label="Наименование системы (Title) *">
                      <Input
                        required
                        value={settings.systemTitle}
                        onChange={(e) => setSettings({ ...settings, systemTitle: e.target.value })}
                        placeholder="EMS Platform — Единый Корпоративный Шелл"
                      />
                    </FormField>

                    <FormField label="Организация / Предприятие *">
                      <div className="relative">
                        <Input
                          required
                          value={settings.organizationName}
                          onChange={(e) => setSettings({ ...settings, organizationName: e.target.value })}
                          placeholder="ПАО «ЭнергоМашСервис»"
                        />
                      </div>
                    </FormField>

                    <FormField label="Часовой пояс сервера (Timezone)">
                      <select
                        value={settings.timezone}
                        onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#3473d4]"
                      >
                        <option value="Europe/Moscow (UTC+3)">Москва (UTC+3 / MSK)</option>
                        <option value="Asia/Yekaterinburg (UTC+5)">Екатеринбург (UTC+5)</option>
                        <option value="Asia/Novosibirsk (UTC+7)">Новосибирск (UTC+7)</option>
                        <option value="UTC (UTC+0)">Всемирное координированное время (UTC+0)</option>
                      </select>
                    </FormField>

                    <FormField label="Язык интерфейса по умолчанию">
                      <select
                        value={settings.defaultLocale}
                        onChange={(e) => setSettings({ ...settings, defaultLocale: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#3473d4]"
                      >
                        <option value="ru-RU">Русский (ru-RU)</option>
                        <option value="en-US">English (en-US)</option>
                      </select>
                    </FormField>

                    <FormField label="Формат даты и времени">
                      <select
                        value={settings.dateFormat}
                        onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#3473d4]"
                      >
                        <option value="DD.MM.YYYY HH:mm">ДД.ММ.ГГГГ ЧЧ:ММ (24.10.2026 14:30)</option>
                        <option value="YYYY-MM-DD HH:mm:ss">ГГГГ-ММ-ДД ЧЧ:ММ:СС (2026-10-24 14:30:00)</option>
                      </select>
                    </FormField>

                    <FormField label="Уровень журналирования (System Log Level)">
                      <select
                        value={settings.logLevel}
                        onChange={(e) => setSettings({ ...settings, logLevel: e.target.value as any })}
                        className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#3473d4]"
                      >
                        <option value="INFO">INFO — Стандартное информирование</option>
                        <option value="WARN">WARN — Ошибки и предупреждения</option>
                        <option value="ERROR">ERROR — Только критические сбои</option>
                        <option value="DEBUG">DEBUG — Полная отладка системных трассировок</option>
                      </select>
                    </FormField>
                  </div>
                </div>
              )}

              {/* TAB 2: APPEARANCE & BRANDING */}
              {activeTab === "appearance" && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-6">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                      <Palette size={16} className="text-[#3473d4] dark:text-blue-400" /> Корпоративное оформление и темы
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Настройка внешнего вида Shell, цветовой палитры, поведения бокового меню и логотипа.
                    </p>
                  </div>

                  {/* Theme Selectors */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Тема оформления по умолчанию
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { id: "SYSTEM", title: "Системная тема", desc: "Автоматически подстраиваться под настройку ОС" },
                        { id: "LIGHT", title: "Светлая тема", desc: "Классический светлый корпоративный стиль" },
                        { id: "DARK", title: "Тёмная тема", desc: "Контрастный тёмный интерфейс высокой четкости" },
                      ].map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSettings({ ...settings, theme: t.id as any })}
                          className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start gap-3 ${
                            settings.theme === t.id
                              ? "border-[#3473d4] dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-[#3473d4] dark:ring-blue-500"
                              : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <SunMoon className={`mt-0.5 ${settings.theme === t.id ? "text-[#3473d4]" : "text-slate-400"}`} size={18} />
                          <div>
                            <span className="font-bold text-xs text-[#17243a] dark:text-slate-200 block">{t.title}</span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{t.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Accent Color Palette */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Корпоративный акцентный цвет
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      {COLOR_PALETTES.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setSettings({ ...settings, primaryColor: c.value })}
                          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                            settings.primaryColor === c.value
                              ? "border-slate-800 dark:border-slate-200 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                              : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full ${c.bg} shadow-xs inline-block`} />
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                      <div>
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">Компактное боковое меню</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Сворачивать сайдбар по умолчанию до иконок</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.compactNav}
                        onChange={(e) => setSettings({ ...settings, compactNav: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-[#3473d4] focus:ring-[#3473d4] cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                      <div>
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">Отображать логотип предприятия</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Выводить герб/логотип в верхнем бэнере Shell</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.showHeaderLogo}
                        onChange={(e) => setSettings({ ...settings, showHeaderLogo: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-[#3473d4] focus:ring-[#3473d4] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: NOTIFICATIONS & BANNERS */}
              {activeTab === "notifications" && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-5">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                      <Bell size={16} className="text-[#3473d4] dark:text-blue-400" /> Системные оповещения и объявления
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Управление сквозными трансляционными баннерами обслуживания и рассылкой уведомлений.
                    </p>
                  </div>

                  <FormField label="Текст объявления / Обслуживания (Broadcast Message)">
                    <textarea
                      rows={3}
                      value={settings.maintenanceBanner}
                      onChange={(e) => setSettings({ ...settings, maintenanceBanner: e.target.value })}
                      placeholder="Например: Внимание! 15.10.2026 с 02:00 до 04:00 планируются регламентные работы на сервере WMS."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#3473d4]"
                    />
                  </FormField>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormField label="Уровень важности баннера">
                      <select
                        value={settings.maintenanceLevel}
                        onChange={(e) => setSettings({ ...settings, maintenanceLevel: e.target.value as any })}
                        className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#3473d4]"
                      >
                        <option value="INFO">Информационное сообщение (Синий баннер)</option>
                        <option value="WARNING">Предупреждение о работах (Жёлтый баннер)</option>
                        <option value="CRITICAL">Критическое предупреждение (Красный баннер)</option>
                      </select>
                    </FormField>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 mt-5">
                      <div>
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">Глобальные системные уведомления</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Отправка системных алеров пользователям</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableGlobalNotifications}
                        onChange={(e) => setSettings({ ...settings, enableGlobalNotifications: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-[#3473d4] focus:ring-[#3473d4] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SECURITY & SESSIONS */}
              {activeTab === "security" && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-5">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                      <ShieldCheck size={16} className="text-[#3473d4] dark:text-blue-400" /> Политики безопасности и Сессии
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Конфигурирование таймаута неактивности сессий, правил 2FA и защиты от подбора паролей.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormField label="Время жизни сессии неактивности (Session Timeout)">
                      <select
                        value={settings.sessionTimeoutMinutes}
                        onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: Number(e.target.value) })}
                        className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#3473d4]"
                      >
                        <option value={15}>15 минут (Высокий уровень защиты)</option>
                        <option value={30}>30 минут</option>
                        <option value={60}>1 час</option>
                        <option value={120}>2 часа (Стандарт системы)</option>
                        <option value={480}>8 часов (Рабочая смена)</option>
                        <option value={1440}>24 часа (Без разлогинивания)</option>
                      </select>
                    </FormField>

                    <div className="space-y-3 pt-5">
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                        <div>
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">Строгий Rate Limiting (Brute-Force Protection)</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">Блокировка IP при 5 неудачных попытках входа подряд</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.rateLimitStrict}
                          onChange={(e) => setSettings({ ...settings, rateLimitStrict: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-[#3473d4] focus:ring-[#3473d4] cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                        <div>
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">Обязательная 2FA для суперадминистраторов</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">Требовать двухфакторный код для аккаунтов ADMIN</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.enforce2FA}
                          onChange={(e) => setSettings({ ...settings, enforce2FA: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-[#3473d4] focus:ring-[#3473d4] cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: FILE STORAGE */}
              {activeTab === "storage" && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-5">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                      <HardDrive size={16} className="text-[#3473d4] dark:text-blue-400" /> Файловое хранилище и лимиты документов
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Настройка провайдера хранения чертежей, паспортов и допустимых типов файлов.
                    </p>
                  </div>

                  {/* Storage Driver Selector Cards */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Драйвер файлового хранилища
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { id: "MINIO", title: "MinIO Object Storage (S3)", desc: "Корпоративное локальное S3 хранилище документов" },
                        { id: "LOCAL", title: "Локальный диск сервера", desc: "Сохранение файлов в локальную папку сервера" },
                        { id: "S3", title: "Amazon S3 / Облако", desc: "Внешний облачный бакет файлов и медиа" },
                      ].map((driver) => (
                        <div
                          key={driver.id}
                          onClick={() => setSettings({ ...settings, storageDriver: driver.id as any })}
                          className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start gap-3 ${
                            settings.storageDriver === driver.id
                              ? "border-[#3473d4] dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-[#3473d4] dark:ring-blue-500"
                              : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <Server className={`mt-0.5 ${settings.storageDriver === driver.id ? "text-[#3473d4]" : "text-slate-400"}`} size={18} />
                          <div>
                            <span className="font-bold text-xs text-[#17243a] dark:text-slate-200 block">{driver.title}</span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{driver.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                    <FormField label="Максимальный размер вложения (MB)">
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        value={settings.maxUploadMB}
                        onChange={(e) => setSettings({ ...settings, maxUploadMB: Number(e.target.value) })}
                      />
                    </FormField>

                    <FormField label="Белый список разрешённых расширений">
                      <Input
                        value={settings.allowedExtensions}
                        onChange={(e) => setSettings({ ...settings, allowedExtensions: e.target.value })}
                        placeholder="pdf, dwg, step, xlsx, docx, png, jpg, zip"
                      />
                    </FormField>
                  </div>
                </div>
              )}

              {/* TAB 6: MODULES & STARTUP */}
              {activeTab === "modules" && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-5">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                      <Layers size={16} className="text-[#3473d4] dark:text-blue-400" /> Реестр системных модулей и маршрутизация
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Включение/отключение функциональных модулей EMS Shell и стартовая страница входа.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                      <div>
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">EPS — Паспортизация оборудования</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Учет единиц, версионирование, согласования</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.activeModules.eps}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            activeModules: { ...settings.activeModules, eps: e.target.checked },
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-[#3473d4] focus:ring-[#3473d4] cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                      <div>
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">WMS — Складской учет ТМЦ</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Номенклатура, остатки, личные карточки СИЗ</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.activeModules.wms}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            activeModules: { ...settings.activeModules, wms: e.target.checked },
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-[#3473d4] focus:ring-[#3473d4] cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                      <div>
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">Системный Журнал Аудита</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Журнал безопасности и отслеживание действий</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.activeModules.audit}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            activeModules: { ...settings.activeModules, audit: e.target.checked },
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-[#3473d4] focus:ring-[#3473d4] cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                      <div>
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">Конструктор Ролей RBAC</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Управление матрицей прав и ролями пользователей</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.activeModules.rbac}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            activeModules: { ...settings.activeModules, rbac: e.target.checked },
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-[#3473d4] focus:ring-[#3473d4] cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <FormField label="Стартовый модуль при авторизации пользователя">
                      <select
                        value={settings.defaultStartupRoute}
                        onChange={(e) => setSettings({ ...settings, defaultStartupRoute: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#3473d4]"
                      >
                        <option value="/eps/dashboard">Панель EPS (Оборудование)</option>
                        <option value="/wms/dashboard">Панель WMS (Склады & ТМЦ)</option>
                        <option value="/admin/audit">Журнал Аудита</option>
                        <option value="/admin/rbac">Администрирование RBAC</option>
                      </select>
                    </FormField>
                  </div>
                </div>
              )}

              {/* Action Buttons Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetDefaults}
                  className="gap-2 text-xs"
                >
                  <RotateCcw size={14} /> Сбросить к умолчаниям
                </Button>

                <Button
                  type="submit"
                  disabled={isSaving}
                  className="gap-2 px-6 shadow-md"
                >
                  <Save size={15} /> {isSaving ? "Сохранение..." : "Сохранить конфигурацию Shell"}
                </Button>
              </div>
            </>
          )}
        </form>
      </main>
    </ShellLayout>
  );
}
