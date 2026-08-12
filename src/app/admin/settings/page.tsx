"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ShellLayout from "@/components/layout/shell-layout";
import {
  PageHeader,
  Button,
  FormField,
  Input,
  SearchInput,
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
  Users,
  Shield,
  Plus,
  Edit2,
  Trash2,
  Copy,
  SlidersHorizontal,
} from "lucide-react";
import { RoleConstructorModal, RoleData } from "@/components/admin/role-constructor-modal";
import { PermissionModuleGroup } from "@/lib/auth/permissions-registry";

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

interface UserItem {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roleKeys: string[];
  roles: { id: string; key: string; name: string }[];
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
  defaultStartupRoute: "/modules/eps",
};

function ShellSettingsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");

  const [settings, setSettings] = useState<ShellSettingsData>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<"general" | "rbac" | "appearance" | "notifications" | "security" | "storage" | "modules">(
    initialTab === "rbac" ? "rbac" : "general"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // RBAC State
  const [rbacSubTab, setRbacSubTab] = useState<"users" | "roles">("users");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<PermissionModuleGroup[]>([]);
  const [isRbacLoading, setIsRbacLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [isConstructorOpen, setIsConstructorOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<RoleData | null>(null);

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

  const fetchRbacData = async () => {
    setIsRbacLoading(true);
    try {
      const [usersRes, rolesRes, permRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/roles"),
        fetch("/api/admin/permissions"),
      ]);

      if (usersRes.ok) {
        const uData = await usersRes.json();
        if (uData.users) setUsers(uData.users);
      }

      if (rolesRes.ok) {
        const rData = await rolesRes.json();
        if (rData.roles) setRoles(rData.roles);
      }

      if (permRes.ok) {
        const pData = await permRes.json();
        if (pData.groupedPermissions) setGroupedPermissions(pData.groupedPermissions);
      }
    } catch (err) {
      console.error("Fetch RBAC data error:", err);
    } finally {
      setIsRbacLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === "rbac") {
      fetchRbacData();
    }
  }, [activeTab]);

  useEffect(() => {
    if (initialTab === "rbac") {
      setActiveTab("rbac");
    }
  }, [initialTab]);

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

  // RBAC Actions
  const handleSaveRole = async (roleData: RoleData) => {
    try {
      const isEditing = Boolean(roleData.id);
      const url = isEditing ? `/api/admin/roles/${roleData.id}` : "/api/admin/roles";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roleData.name,
          description: roleData.description,
          permissionCodes: roleData.permissions,
          scope: roleData.scope,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Ошибка при сохранении роли", "error");
        return;
      }

      showToast(`Роль "${roleData.name}" успешно ${isEditing ? "обновлена" : "создана"}`);
      await fetchRbacData();
    } catch (err) {
      console.error("Save role error:", err);
      showToast("Ошибка подключения к серверу", "error");
    }
  };

  const handleDeleteRole = async (role: RoleData) => {
    if (role.isSystem) {
      showToast("Запрещено удалять системные встроенные роли", "error");
      return;
    }

    if (!confirm(`Вы действительно хотите удалить роль "${role.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/roles/${role.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Ошибка при удалении роли", "error");
        return;
      }

      showToast(`Роль "${role.name}" успешно удалена`);
      await fetchRbacData();
    } catch (err) {
      console.error("Delete role error:", err);
    }
  };

  const handleToggleUserRole = async (userId: string, roleKey: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    const hasRole = user.roleKeys.includes(roleKey);
    const updatedRoleKeys = hasRole
      ? user.roleKeys.filter((k) => k !== roleKey)
      : [...user.roleKeys, roleKey];

    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, roleKeys: updatedRoleKeys }),
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, roleKeys: updatedRoleKeys } : u))
        );
        showToast(`Права пользователя ${user.name} обновлены`);
      }
    } catch (err) {
      console.error("Toggle user role error:", err);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || u.roleKeys.includes(roleFilter);
    return matchesSearch && matchesRole;
  });

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Основные настройки Shell и Платформы"
          description="Централизованное конфигурирование параметров корпоративного шелла, оформление, доступ (RBAC) и системные модули."
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
            onClick={() => setActiveTab("rbac")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "rbac"
                ? "bg-[#3473d4] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <ShieldCheck size={15} /> Доступ и Роли (RBAC)
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
            <Lock size={15} /> Безопасность и Сессии
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

        {/* TAB: RBAC CONSOLE */}
        {activeTab === "rbac" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                    <ShieldCheck size={16} className="text-[#3473d4] dark:text-blue-400" />
                    Контроль Доступа & Ролевая модель RBAC
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Управление ролями предприятия, матрица атомарных разрешений и назначение доступа сотрудникам.
                  </p>
                </div>

                <Button
                  onClick={() => {
                    setRoleToEdit(null);
                    setIsConstructorOpen(true);
                  }}
                >
                  <Plus size={14} className="mr-1" /> Создать роль
                </Button>
              </div>

              {/* Subtabs for RBAC */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
                <button
                  type="button"
                  onClick={() => setRbacSubTab("users")}
                  className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                    rbacSubTab === "users"
                      ? "border-[#3473d4] text-[#3473d4] dark:text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Users size={15} />
                  <span>Пользователи и назначение ролей ({users.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRbacSubTab("roles")}
                  className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                    rbacSubTab === "roles"
                      ? "border-[#3473d4] text-[#3473d4] dark:text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Shield size={15} />
                  <span>Конструктор ролей ({roles.length})</span>
                </button>
              </div>

              {/* Subtab 1: Users */}
              {rbacSubTab === "users" && (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3">
                    <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-md">
                      <SearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Поиск пользователя по имени или e-mail…"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <SlidersHorizontal size={13} className="text-[#3473d4]" />
                      <span className="font-semibold text-[11px] text-slate-600 dark:text-slate-400">Фильтр по роли:</span>
                      <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-xs px-2 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900"
                      >
                        <option value="ALL">Все роли</option>
                        {roles.map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="hidden grid-cols-[2fr_2fr_3fr] gap-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 md:grid">
                      <span>Сотрудник</span>
                      <span>Корпоративный Email</span>
                      <span>Назначенные роли в системе</span>
                    </div>

                    {isRbacLoading ? (
                      <div className="p-8 text-center text-xs text-slate-400">Загрузка пользователей...</div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">Пользователи не найдены</div>
                    ) : (
                      filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          className="grid gap-2 border-b border-slate-100 dark:border-slate-800 px-5 py-4 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 md:grid-cols-[2fr_2fr_3fr] md:items-center md:gap-4 transition"
                        >
                          <div>
                            <span className="block text-xs font-bold text-[#17243a] dark:text-slate-100">{user.name}</span>
                            <span className="block text-[10px] text-slate-400 font-mono">ID: {user.id}</span>
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">{user.email}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {roles.map((r) => {
                              if (!r.key) return null;
                              const roleKey = r.key;
                              const hasRole = user.roleKeys.includes(roleKey);
                              return (
                                <button
                                  key={roleKey}
                                  type="button"
                                  onClick={() => handleToggleUserRole(user.id, roleKey)}
                                  className={`rounded-full px-3 py-1 text-[10px] font-bold transition flex items-center gap-1 ${
                                    hasRole
                                      ? "bg-blue-50 dark:bg-blue-950/50 text-[#3473d4] dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-xs"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100"
                                  }`}
                                >
                                  {hasRole ? "✓ " : "+ "}
                                  {r.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Subtab 2: Roles */}
              {rbacSubTab === "roles" && (
                <div className="space-y-4 pt-2">
                  {isRbacLoading ? (
                    <div className="p-8 text-center text-xs text-slate-400">Загрузка конструктора ролей...</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {roles.map((role) => (
                        <div
                          key={role.id || role.key}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5">
                                <h3 className="font-bold text-[#17243a] dark:text-slate-100 text-sm">{role.name}</h3>
                                <span className="inline-block text-[10px] font-mono text-slate-400">{role.key}</span>
                              </div>

                              {role.isSystem ? (
                                <span className="rounded-md bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 text-[9px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                                  Системная
                                </span>
                              ) : (
                                <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                                  Кастомная
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[32px]">
                              {role.description || "Описание не указано"}
                            </p>

                            <div className="pt-2 flex flex-wrap gap-2 text-[10px] text-slate-600 dark:text-slate-300 font-semibold border-t border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                <ShieldCheck size={12} className="text-[#3473d4]" />
                                <span>Разрешений: <strong>{role.permissions.length}</strong></span>
                              </div>

                              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                <Layers size={12} className="text-amber-600" />
                                <span>
                                  Scope: <strong>{role.scope?.isGlobal ? "Глобальный" : "Ограничен"}</strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => {
                                setRoleToEdit({
                                  ...role,
                                  id: undefined,
                                  key: undefined,
                                  name: `${role.name} (копия)`,
                                  isSystem: false,
                                });
                                setIsConstructorOpen(true);
                              }}
                              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-[11px] font-semibold flex items-center gap-1"
                            >
                              <Copy size={13} /> Клонировать
                            </button>

                            <div className="flex items-center gap-2">
                              {!role.isSystem && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRole(role)}
                                  className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                  title="Удалить роль"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}

                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setRoleToEdit(role);
                                  setIsConstructorOpen(true);
                                }}
                              >
                                <Edit2 size={13} /> Изменить
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Role Constructor Modal */}
            <RoleConstructorModal
              open={isConstructorOpen}
              onClose={() => setIsConstructorOpen(false)}
              roleToEdit={roleToEdit}
              onSave={handleSaveRole}
              groupedPermissions={groupedPermissions}
            />
          </div>
        )}

        {/* Configuration Form for Other Tabs */}
        {activeTab !== "rbac" && (
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

                      <FormField label="Уровень системных логов">
                        <select
                          value={settings.logLevel}
                          onChange={(e) => setSettings({ ...settings, logLevel: e.target.value as any })}
                          className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#3473d4]"
                        >
                          <option value="INFO">INFO (Стандартный аудит)</option>
                          <option value="WARN">WARN (Предупреждения)</option>
                          <option value="ERROR">ERROR (Только ошибки)</option>
                          <option value="DEBUG">DEBUG (Отладочный дамп)</option>
                        </select>
                      </FormField>
                    </div>
                  </div>
                )}

                {/* TAB 2: APPEARANCE & BRANDING */}
                {activeTab === "appearance" && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-5">
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                      <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                        <Palette size={16} className="text-[#3473d4] dark:text-blue-400" /> Оформление и Тематизация Shell
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Цветовая палитра бренда, системная тема оформление и глобальные параметры навигации.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormField label="Глобальная тема оформления">
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: "SYSTEM", label: "Системная", icon: <SunMoon size={16} /> },
                            { id: "LIGHT", label: "Светлая", icon: <Sparkles size={16} /> },
                            { id: "DARK", label: "Тёмная", icon: <PanelLeft size={16} /> },
                          ].map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSettings({ ...settings, theme: t.id as any })}
                              className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border text-xs font-semibold transition ${
                                settings.theme === t.id
                                  ? "border-[#3473d4] bg-blue-50/50 dark:bg-blue-950/40 text-[#3473d4] dark:text-blue-400"
                                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                              }`}
                            >
                              {t.icon}
                              <span>{t.label}</span>
                            </button>
                          ))}
                        </div>
                      </FormField>

                      <FormField label="Основной акцентный цвет (#HEX)">
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={settings.primaryColor}
                            onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                            className="h-9 w-12 rounded border border-slate-300 dark:border-slate-700 bg-transparent p-0.5 cursor-pointer"
                          />
                          <Input
                            value={settings.primaryColor}
                            onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                            placeholder="#3473d4"
                            className="font-mono text-xs"
                          />
                        </div>
                      </FormField>
                    </div>
                  </div>
                )}

                {/* TAB 3: NOTIFICATIONS & BANNERS */}
                {activeTab === "notifications" && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-5">
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                      <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                        <Bell size={16} className="text-[#3473d4] dark:text-blue-400" /> Системные баннеры и Объявления
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Уведомления о технических работах и глобальные предупреждения для всех пользователей.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <FormField label="Текст информационного баннера об обслуживании">
                        <textarea
                          rows={3}
                          value={settings.maintenanceBanner}
                          onChange={(e) => setSettings({ ...settings, maintenanceBanner: e.target.value })}
                          placeholder="Пример: Внимание! 15 августа с 02:00 до 04:00 планируются плановые регламентные работы на сервере БД..."
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#3473d4]"
                        />
                      </FormField>
                    </div>
                  </div>
                )}

                {/* TAB 4: SECURITY & SESSIONS */}
                {activeTab === "security" && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-5">
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                      <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                        <Lock size={16} className="text-[#3473d4] dark:text-blue-400" /> Политики безопасности и Сессии
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Таймаут неактивности, двухфакторная аутентификация и защита от подбора.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormField label="Таймаут неактивной сессии (минуты)">
                        <Input
                          type="number"
                          value={settings.sessionTimeoutMinutes}
                          onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: Number(e.target.value) })}
                        />
                      </FormField>
                    </div>
                  </div>
                )}

                {/* TAB 5: FILE STORAGE */}
                {activeTab === "storage" && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-5">
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                      <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                        <HardDrive size={16} className="text-[#3473d4] dark:text-blue-400" /> Конфигурация файлового хранилища
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Драйвер загрузки документов, ограничения по размеру и типам файлов.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormField label="Тип хранилища документов">
                        <select
                          value={settings.storageDriver}
                          onChange={(e) => setSettings({ ...settings, storageDriver: e.target.value as any })}
                          className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#3473d4]"
                        >
                          <option value="MINIO">Локальный S3 (MinIO Object Storage)</option>
                          <option value="LOCAL">Локальный сетевой диск (NAS / Network Storage)</option>
                        </select>
                      </FormField>

                      <FormField label="Максимальный размер загружаемого файла (МБ)">
                        <Input
                          type="number"
                          value={settings.maxUploadMB}
                          onChange={(e) => setSettings({ ...settings, maxUploadMB: Number(e.target.value) })}
                        />
                      </FormField>

                      <FormField label="Разрешенные расширения файлов (через запятую)">
                        <Input
                          value={settings.allowedExtensions}
                          onChange={(e) => setSettings({ ...settings, allowedExtensions: e.target.value })}
                          placeholder="pdf, dwg, step, xlsx, docx, png, jpg, zip"
                        />
                      </FormField>
                    </div>
                  </div>
                )}

                {/* TAB 6: MODULES REGISTRY */}
                {activeTab === "modules" && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-5">
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                      <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                        <Layers size={16} className="text-[#3473d4] dark:text-blue-400" /> Активные модули платформы
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Включение и отключение видимости подсистем предприятии в общем меню Shell.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { key: "eps", name: "EPS Паспортизация", desc: "Управление паспортами оборудования и структурой иерархии", icon: <Server size={18} /> },
                        { key: "wms", name: "WMS Складской учет", desc: "Управление складами, ячейками хранения, остатками ТМЦ и списанием", icon: <AppWindow size={18} /> },
                        { key: "audit", name: "Аудит и Телеметрия", desc: "Журналирование операций и аудит действий пользователей", icon: <FileText size={18} /> },
                        { key: "rbac", name: "RBAC Права доступа", desc: "Контроль доступа сотрудников к подсистемам платформы", icon: <ShieldCheck size={18} /> },
                      ].map((m) => (
                        <div
                          key={m.key}
                          className="flex items-start justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#3473d4] dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
                              {m.icon}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-[#17243a] dark:text-slate-100">{m.name}</h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{m.desc}</p>
                            </div>
                          </div>

                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.activeModules[m.key as keyof typeof settings.activeModules]}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  activeModules: {
                                    ...settings.activeModules,
                                    [m.key]: e.target.checked,
                                  },
                                })
                              }
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-slate-600 peer-checked:bg-[#3473d4]"></div>
                          </label>
                        </div>
                      ))}
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
        )}
      </main>
    </ShellLayout>
  );
}

export default function ShellGlobalSettingsPage() {
  return (
    <Suspense fallback={
      <ShellLayout>
        <main className="w-full px-5 py-6 md:px-8 space-y-6 max-w-7xl mx-auto">
          <div className="p-8 text-center text-xs text-slate-400">Загрузка настроек...</div>
        </main>
      </ShellLayout>
    }>
      <ShellSettingsContent />
    </Suspense>
  );
}
