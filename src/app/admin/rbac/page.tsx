"use client";

import { useState } from "react";
import Link from "next/link";
import ShellLayout from "@/components/layout/shell-layout";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import {
  ShieldCheck,
  UserPlus,
  Search,
  Check,
  X,
  SlidersHorizontal,
  ChevronRight,
  Database,
  Gauge,
} from "lucide-react";

interface RoleUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

export default function RbacPage() {
  const [users, setUsers] = useState<RoleUser[]>([
    { id: "1", name: "Администратор EMS", email: "admin@ems.local", roles: ["ADMIN", "EDITOR", "APPROVER", "VIEWER"] },
    { id: "2", name: "Инженер Редактор", email: "editor@ems.local", roles: ["EDITOR", "VIEWER"] },
    { id: "3", name: "Руководитель Согласующий", email: "approver@ems.local", roles: ["APPROVER", "VIEWER"] },
    { id: "4", name: "Наблюдатель Оборудования", email: "viewer@ems.local", roles: ["VIEWER"] },
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State for New User
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["VIEWER"]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleRole = (userId: string, role: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        const exists = u.roles.includes(role);
        const newRoles = exists ? u.roles.filter((r) => r !== role) : [...u.roles, role];
        showToast(`Права пользователя ${u.name} обновлены (роль ${role} ${exists ? "удалена" : "добавлена"})`);
        return { ...u, roles: newRoles };
      })
    );
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    const newUser: RoleUser = {
      id: String(Date.now()),
      name: newName.trim(),
      email: newEmail.trim(),
      roles: selectedRoles.length > 0 ? selectedRoles : ["VIEWER"],
    };

    setUsers((prev) => [...prev, newUser]);
    setIsAddUserOpen(false);
    setNewName("");
    setNewEmail("");
    setSelectedRoles(["VIEWER"]);
    showToast(`Пользователь ${newUser.name} успешно добавлен в систему`);
  };

  const toggleFormRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || u.roles.includes(roleFilter);
    return matchesSearch && matchesRole;
  });

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <Breadcrumbs items={[{ label: "Настройки", href: "/admin/settings" }, { label: "Безопасность & RBAC" }]} />

        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-[#17243a] px-4 py-3 text-xs font-semibold text-white shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Управление Доступом (RBAC) & Ролями
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Настройка корпоративных ролей (Администратор, Редактор, Согласующий, Наблюдатель) и матрица прав.
            </p>
          </div>
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] transition"
          >
            <UserPlus size={14} /> Добавить пользователя
          </button>
        </div>

        {/* Add User Modal */}
        {isAddUserOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
            onClick={() => setIsAddUserOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#eef5ff] text-[#3473d4]">
                    <ShieldCheck size={16} />
                  </div>
                  <h3 className="text-sm font-bold text-[#17243a]">Регистрация нового пользователя</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">ФИО пользователя *</label>
                  <input
                    type="text"
                    required
                    placeholder="Сидоров Алексей Петрович"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-1.5 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Корпоративный Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="user@ems.local"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-1.5 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-semibold text-slate-600">Начальные роли в системе</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { code: "ADMIN", name: "ADMIN (Полный)" },
                      { code: "EDITOR", name: "EDITOR (Редактор)" },
                      { code: "APPROVER", name: "APPROVER (Согласующий)" },
                      { code: "VIEWER", name: "VIEWER (Чтение)" },
                    ].map((role) => {
                      const active = selectedRoles.includes(role.code);
                      return (
                        <div
                          key={role.code}
                          onClick={() => toggleFormRole(role.code)}
                          className={`cursor-pointer rounded-lg border px-3 py-2 text-[10px] font-semibold transition ${
                            active
                              ? "border-[#3473d4] bg-[#eef5ff] text-[#3473d4]"
                              : "border-slate-200 bg-[#f8fafc] text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {role.name}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddUserOpen(false)}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
                  >
                    <UserPlus size={13} /> Зарегистрировать
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
          <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-md">
            <div className="relative w-full">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск пользователя по имени или e-mail…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-[#f8fafc] pl-9 pr-3 text-[11px] outline-none placeholder:text-slate-400 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[#3473d4]">
              <SlidersHorizontal size={13} />
              <span className="font-semibold text-[11px]">Фильтр по роли:</span>
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-[#f8fafc] px-2.5 text-[10px] text-slate-600 outline-none focus:border-[#3c82ed]"
            >
              <option value="ALL">Все роли</option>
              <option value="ADMIN">ADMIN</option>
              <option value="EDITOR">EDITOR</option>
              <option value="APPROVER">APPROVER</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </div>
        </div>

        {/* RBAC Matrix Table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
          <div className="hidden grid-cols-[2fr_2fr_3fr] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 md:grid">
            <span>Пользователь</span>
            <span>Корпоративный Email</span>
            <span>Матрица ролей и полномочий</span>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400">
              Пользователи не найдены.
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className="grid gap-2 border-b border-slate-100 px-5 py-3.5 last:border-0 hover:bg-slate-50/50 md:grid-cols-[2fr_2fr_3fr] md:items-center md:gap-4 transition"
              >
                <div>
                  <span className="block text-[11px] font-bold text-[#17243a]">{user.name}</span>
                  <span className="block text-[9px] text-slate-400">ID: {user.id}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {user.email}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { code: "ADMIN", label: "ADMIN" },
                    { code: "EDITOR", label: "EDITOR" },
                    { code: "APPROVER", label: "APPROVER" },
                    { code: "VIEWER", label: "VIEWER" },
                  ].map((role) => {
                    const hasRole = user.roles.includes(role.code);
                    return (
                      <button
                        key={role.code}
                        onClick={() => toggleRole(user.id, role.code)}
                        className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold transition ${
                          hasRole
                            ? "bg-blue-50 text-[#3473d4] border border-blue-200"
                            : "bg-slate-100 text-slate-400 border border-slate-200 opacity-60 hover:opacity-100"
                        }`}
                      >
                        {hasRole ? "✓ " : "+ "}{role.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>
      </main>
    </ShellLayout>
  );
}
