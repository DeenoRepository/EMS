"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader, Button, SearchInput } from "@/components/ui";
import { ShieldCheck, UserPlus, SlidersHorizontal, Plus, Edit2, Trash2, Copy, Shield, Users, Layers } from "lucide-react";
import { RoleConstructorModal, RoleData } from "@/components/admin/role-constructor-modal";
import { PermissionModuleGroup } from "@/lib/auth/permissions-registry";

interface UserItem {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roleKeys: string[];
  roles: { id: string; key: string; name: string }[];
}

export default function RbacPage() {
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");

  // API Data
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<PermissionModuleGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State
  const [isConstructorOpen, setIsConstructorOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<RoleData | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchData = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
        showToast(data.error || "Ошибка при сохранении роли");
        return;
      }

      showToast(`Роль "${roleData.name}" успешно ${isEditing ? "обновлена" : "создана"}`);
      await fetchData();
    } catch (err) {
      console.error("Save role error:", err);
      showToast("Ошибка подключения к серверу");
    }
  };

  const handleDeleteRole = async (role: RoleData) => {
    if (role.isSystem) {
      showToast("Запрещено удалять системные встроенные роли");
      return;
    }

    if (!confirm(`Вы действительно хотите удалить роль "${role.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/roles/${role.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Ошибка при удалении роли");
        return;
      }

      showToast(`Роль "${role.name}" успешно удалена`);
      await fetchData();
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
        <Breadcrumbs items={[{ label: "Настройки", href: "/admin/settings" }, { label: "Конструктор Ролей & RBAC" }]} />

        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-[#17243a] px-4 py-3 text-xs font-semibold text-white shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header */}
        <PageHeader
          title="Безопасность & Конструктор Ролей RBAC"
          description="Управление ролями предприятия, сборка матрицы атомарных прав и назначение доступа сотрудникам."
          actions={
            <Button
              onClick={() => {
                setRoleToEdit(null);
                setIsConstructorOpen(true);
              }}
            >
              <Plus size={14} /> Создать роль в конструкторе
            </Button>
          }
        />

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-200 gap-6">
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === "users"
                ? "border-[#3473d4] text-[#3473d4]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users size={15} />
            <span>Пользователи и назначение ролей ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("roles")}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === "roles"
                ? "border-[#3473d4] text-[#3473d4]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Shield size={15} />
            <span>Конструктор ролей ({roles.length})</span>
          </button>
        </div>

        {/* TAB 1: USERS & ROLE ASSIGNMENTS */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-md">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Поиск пользователя по имени или e-mail…"
                />
              </div>

              <div className="flex items-center gap-2">
                <SlidersHorizontal size={13} className="text-[#3473d4]" />
                <span className="font-semibold text-[11px] text-slate-600">Фильтр по роли:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="h-8 rounded-lg border border-slate-200 text-xs px-2 text-slate-700 bg-white"
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

            {/* Users Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="hidden grid-cols-[2fr_2fr_3fr] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 md:grid">
                <span>Сотрудник</span>
                <span>Корпоративный Email</span>
                <span>Назначенные роли в системе</span>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">Загрузка пользователей...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">Пользователи не найдены</div>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="grid gap-2 border-b border-slate-100 px-5 py-4 last:border-0 hover:bg-slate-50/60 md:grid-cols-[2fr_2fr_3fr] md:items-center md:gap-4 transition"
                  >
                    <div>
                      <span className="block text-xs font-bold text-slate-800">{user.name}</span>
                      <span className="block text-[10px] text-slate-400 font-mono">ID: {user.id}</span>
                    </div>
                    <div className="text-xs text-slate-600 font-mono">{user.email}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {roles.map((r) => {
                        if (!r.key) return null;
                        const roleKey = r.key;
                        const hasRole = user.roleKeys.includes(roleKey);
                        return (
                          <button
                            key={roleKey}
                            onClick={() => handleToggleUserRole(user.id, roleKey)}
                            className={`rounded-full px-3 py-1 text-[10px] font-bold transition flex items-center gap-1 ${
                              hasRole
                                ? "bg-blue-50 text-[#3473d4] border border-blue-200 shadow-sm"
                                : "bg-slate-100 text-slate-400 border border-slate-200 opacity-60 hover:opacity-100"
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

        {/* TAB 2: ROLE CONSTRUCTOR CARDS */}
        {activeTab === "roles" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Создавайте и изменяйте роли enterprise-системы. Доступно атомарное назначение функций и ограничений.
              </p>
              <Button
                onClick={() => {
                  setRoleToEdit(null);
                  setIsConstructorOpen(true);
                }}
              >
                <Plus size={14} /> Создать роль
              </Button>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Загрузка конструктора ролей...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role) => (
                  <div
                    key={role.id || role.key}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <h3 className="font-bold text-slate-900 text-sm">{role.name}</h3>
                          <span className="inline-block text-[10px] font-mono text-slate-400">{role.key}</span>
                        </div>

                        {role.isSystem ? (
                          <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[9px] font-bold text-purple-700 border border-purple-200 shrink-0">
                            Системная
                          </span>
                        ) : (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200 shrink-0">
                            Кастомная
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">
                        {role.description || "Описание не указано"}
                      </p>

                      <div className="pt-2 flex flex-wrap gap-2 text-[10px] text-slate-600 font-semibold border-t border-slate-100">
                        <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md">
                          <ShieldCheck size={12} className="text-[#3473d4]" />
                          <span>Разрешений: <strong>{role.permissions.length}</strong></span>
                        </div>

                        <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md">
                          <Layers size={12} className="text-amber-600" />
                          <span>
                            Scope: <strong>{role.scope?.isGlobal ? "Глобальный" : "Ограничен"}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <button
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
                        className="text-slate-500 hover:text-slate-800 text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Copy size={13} /> Клонировать
                      </button>

                      <div className="flex items-center gap-2">
                        {!role.isSystem && (
                          <button
                            onClick={() => handleDeleteRole(role)}
                            className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition"
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

        {/* Role Constructor Modal */}
        <RoleConstructorModal
          open={isConstructorOpen}
          onClose={() => setIsConstructorOpen(false)}
          roleToEdit={roleToEdit}
          onSave={handleSaveRole}
          groupedPermissions={groupedPermissions}
        />
      </main>
    </ShellLayout>
  );
}
