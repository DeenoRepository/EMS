"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Bell,
  ChevronDown,
  X,
  Menu,
  LogOut,
  UserCheck,
  ShieldCheck,
  CheckCheck,
  Sun,
  Moon,
} from "lucide-react";
import { useShell } from "./shell-context";
import { BRAND_CONFIG } from "@/lib/config/brand";
import { ModuleStatusBadge } from "./module-status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const unreadCount = notifications.filter((n) => !n.read).length;

  const userDisplayName = currentUser?.displayName ?? "Гость";
  const userEmail = currentUser?.email ?? "авторизация...";
  const userInitials = currentUser
    ? userDisplayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "US"
    : "--";

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", newTheme === "dark");
      try {
        localStorage.setItem("ems_theme", newTheme);
      } catch {
        // ignore
      }
    }
  };

  return (
    <header
      aria-label="Верхняя панель"
      className="sticky top-0 z-[var(--z-sticky)] flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 md:px-6"
    >
      {/* Left: Hamburger (mobile) + Logo & Title */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleMobileMenu}
          className="lg:hidden"
          aria-label="Открыть мобильное меню"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>

        {sidebarCollapsed && (
          <Link
            href="/"
            className="hidden sm:flex items-center gap-2.5 hover:opacity-90 transition-opacity"
          >
            <img
              src={BRAND_CONFIG.logoUrl}
              alt={`${BRAND_CONFIG.name} Logo`}
              className="h-8 w-8 rounded-md object-cover ring-1 ring-border"
            />
            <div className="leading-none">
              <div className="text-sm font-bold tracking-tight text-foreground">
                {BRAND_CONFIG.name}
              </div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
          type="button"
          onClick={() => setSearchModalOpen(true)}
          className="group relative flex h-10 w-full items-center rounded-lg border border-input bg-muted/50 px-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate">Команды и поиск по Shell...</span>
          <kbd className="hidden sm:inline-flex rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right: Theme toggle, Notifications & User profile */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Включить тёмную тему" : "Включить светлую тему"}
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Sun className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>

        {/* Notifications Button */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setNoticeOpen(!noticeOpen);
              setProfileOpen(false);
            }}
            aria-label={`Уведомления${unreadCount > 0 ? ` (${unreadCount} непрочитанных)` : ""}`}
            aria-expanded={noticeOpen}
            className="relative"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {unreadCount > 0 && (
              <span
                className="absolute right-1 top-1 flex h-2 w-2"
                aria-hidden="true"
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 ring-2 ring-card" />
              </span>
            )}
          </Button>

          {/* Notifications Dropdown */}
          {noticeOpen && (
            <>
              <div
                className="fixed inset-0 z-[var(--z-dropdown)]"
                onClick={() => setNoticeOpen(false)}
                aria-hidden="true"
              />
              <div
                role="dialog"
                aria-label="Уведомления"
                className="absolute right-0 top-12 z-[var(--z-popover)] w-80 rounded-xl border border-border bg-card p-4 text-sm shadow-xl animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between border-b border-border pb-2.5 font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <span>Уведомления</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {unreadCount} новых
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setNoticeOpen(false)}
                    aria-label="Закрыть уведомления"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>

                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Нет новых уведомлений
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => markNotificationRead(item.id)}
                        className={cn(
                          "w-full text-left rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          item.read
                            ? "border-border bg-muted/30 text-muted-foreground"
                            : "border-primary/20 bg-primary/5 text-foreground hover:bg-primary/10"
                        )}
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold">{item.title}</span>
                          <span className="text-xs text-muted-foreground">{item.time}</span>
                        </div>
                        <p className="mt-1 text-sm leading-snug">{item.message}</p>
                        {!item.read && (
                          <div className="mt-2 flex items-center justify-end gap-1 text-xs text-primary">
                            <CheckCheck className="h-3 w-3" aria-hidden="true" />
                            Отметить прочитанным
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

        {/* User Profile Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNoticeOpen(false);
            }}
            aria-expanded={profileOpen}
            aria-label="Меню пользователя"
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {userInitials}
            </div>
            <div className="hidden leading-tight sm:block text-left">
              <div className="text-sm font-semibold text-foreground">{userDisplayName}</div>
              <div className="text-xs text-muted-foreground">{userEmail}</div>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                profileOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>

          {/* Profile Dropdown */}
          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-[var(--z-dropdown)]"
                onClick={() => setProfileOpen(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                className="absolute right-0 top-12 z-[var(--z-popover)] w-56 rounded-xl border border-border bg-card p-2 text-sm shadow-xl animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="px-3 py-2 border-b border-border">
                  <div className="font-semibold text-foreground">{userDisplayName}</div>
                  <div className="text-xs text-muted-foreground">
                    Роль: {currentUser?.roles && currentUser.roles.length > 0 ? currentUser.roles.join(", ") : "Загрузка..."}
                  </div>
                </div>
                <Link
                  href="/admin/rbac"
                  onClick={() => setProfileOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-foreground hover:bg-muted transition-colors"
                >
                  <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                  Безопасность & RBAC
                </Link>
                <Link
                  href="/admin/settings"
                  onClick={() => setProfileOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-foreground hover:bg-muted transition-colors"
                >
                  <UserCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Профиль системного аккаунта
                </Link>
                <div className="border-t border-border pt-1 mt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      setProfileOpen(false);
                      await logout();
                    }}
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-destructive hover:bg-destructive/10 font-medium transition-colors"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Выйти из системы
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
