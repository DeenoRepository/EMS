"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Bell, ChevronDown, X, Menu, LogOut, UserCheck, ShieldCheck, CheckCheck } from "lucide-react";
import { useShell } from "./shell-context";
import { BRAND_CONFIG } from "@/lib/config/brand";
import { ModuleStatusBadge } from "./module-status-badge";

export function TopBar() {
  const {
    currentUser,
    logout,
    sidebarCollapsed,
    setSearchModalOpen,
    notifications,
    markNotificationRead,
    toggleMobileMenu,
  } = useShell();

  const [noticeOpen, setNoticeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const userDisplayName = currentUser?.displayName ?? "Гость / Загрузка...";
  const userEmail = currentUser?.email ?? "авторизация...";
  const userInitials = currentUser
    ? userDisplayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "US"
    : "--";

  return (
    <header
      aria-label="Верхняя панель"
      className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-[0_1px_10px_rgba(15,23,42,.03)] backdrop-blur md:px-8 relative"
    >
      {/* Left: Hamburger (mobile) + Logo & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleMobileMenu}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Открыть мобильное меню"
        >
          <Menu size={18} />
        </button>

        {sidebarCollapsed && (
          <Link href="/" className="hidden sm:flex items-center gap-2.5 hover:opacity-90 transition">
            <img
              src={BRAND_CONFIG.logoUrl}
              alt="EPS Logo"
              className="h-8 w-8 rounded-md object-cover ring-1 ring-slate-200"
            />
            <div className="leading-none">
              <div className="text-[13px] font-bold tracking-tight text-[#17243a]">{BRAND_CONFIG.name}</div>
              <div className="mt-0.5 text-[8px] font-semibold uppercase tracking-[.14em] text-slate-400">
                {BRAND_CONFIG.subtitle}
              </div>
            </div>
          </Link>
        )}

        <div className="hidden lg:flex items-center gap-2 ml-4">
          <ModuleStatusBadge moduleId="eps" />
          <ModuleStatusBadge moduleId="wms" />
        </div>
      </div>

      {/* Center: Search trigger button */}
      <div className="absolute left-1/2 -translate-x-1/2 w-[min(440px,46vw)] hidden sm:block">
        <button
          onClick={() => setSearchModalOpen(true)}
          className="relative flex h-9 w-full items-center rounded-lg border border-slate-200 bg-[#f8fafc] px-3 text-left text-[11px] text-slate-400 transition hover:border-[#3c82ed] hover:bg-white focus:outline-none"
        >
          <Search size={15} className="mr-2 text-slate-400 shrink-0" />
          <span className="flex-1 truncate">Команды и поиск по Shell...</span>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-mono text-slate-400 shrink-0">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right: Notifications & User profile */}
      <div className="flex items-center gap-3">
        {/* Notifications Button */}
        <div className="relative">
          <button
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
            onClick={() => {
              setNoticeOpen(!noticeOpen);
              setProfileOpen(false);
            }}
            aria-label="Уведомления"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 ring-2 ring-white"></span>
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {noticeOpen && (
            <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 font-bold text-[#17243a]">
                <div className="flex items-center gap-2">
                  <span>Уведомления</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-[#3473d4]">
                      {unreadCount} новых
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setNoticeOpen(false)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-[11px]">Нет новых уведомлений</div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => markNotificationRead(item.id)}
                      className={`cursor-pointer rounded-lg border p-3 transition ${
                        item.read
                          ? "border-slate-100 bg-slate-50/50 text-slate-500"
                          : "border-blue-100 bg-blue-50/40 text-slate-700 font-medium hover:bg-blue-50"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#17243a]">{item.title}</span>
                        <span className="text-[9px] text-slate-400">{item.time}</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug">{item.message}</p>
                      {!item.read && (
                        <div className="mt-2 flex items-center justify-end gap-1 text-[9px] text-[#3473d4]">
                          <CheckCheck size={12} /> Отметить прочитанным
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="hidden h-6 w-px bg-slate-200 sm:block" />

        {/* User Profile Menu */}
        <div className="relative">
          <div
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNoticeOpen(false);
            }}
            className="flex items-center gap-2 cursor-pointer rounded-lg p-1 hover:bg-slate-100 transition"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f1ff] text-[11px] font-bold text-[#3473d4]">
              {userInitials}
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="text-[11px] font-semibold text-[#17243a]">{userDisplayName}</div>
              <div className="text-[10px] text-slate-400">{userEmail}</div>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </div>

          {/* Profile Dropdown */}
          {profileOpen && (
            <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-2xl animate-in fade-in zoom-in-95 duration-150 space-y-1">
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="font-bold text-[#17243a]">{userDisplayName}</div>
                <div className="text-[10px] text-slate-400">
                  Роль: {currentUser?.roles && currentUser.roles.length > 0 ? currentUser.roles.join(", ") : "Загрузка..."}
                </div>
              </div>
              <Link
                href="/admin/rbac"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-[#17243a]"
              >
                <ShieldCheck size={14} className="text-[#3473d4]" /> Безопасность & RBAC
              </Link>
              <Link
                href="/admin/settings"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-[#17243a]"
              >
                <UserCheck size={14} className="text-slate-400" /> Профиль системного аккаунта
              </Link>
              <div className="border-t border-slate-100 pt-1">
                <button
                  onClick={async () => {
                    setProfileOpen(false);
                    await logout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-rose-600 hover:bg-rose-50 font-medium"
                >
                  <LogOut size={14} /> Выйти из системы
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
