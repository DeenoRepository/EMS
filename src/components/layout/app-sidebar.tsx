"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Server,
  Settings2,
  Box,
  Database,
  ShieldCheck,
  Gauge,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileText,
  BarChart3,
  Activity,
  Menu,
  Search,
  Wrench,
  X,
  PackageCheck,
  Building2,
  History,
  Warehouse,
  PieChart,
  ArrowRightLeft,
  UserCheck,
} from "lucide-react";
import { useShell } from "./shell-context";
import { MODULES_CONFIG } from "@/lib/config/modules";
import { NAV_ITEMS, NavItem } from "@/lib/config/nav";
import { APP_VERSION } from "@/lib/version";
import { BRAND_CONFIG } from "@/lib/config/brand";

function SidebarContent() {
  const {
    sidebarCollapsed: collapsed,
    setSidebarCollapsed,
    toggleSidebar: onToggle,
    pendingApprovals,
  } = useShell();

  const pathname = usePathname();

  const isEpsActive = pathname.startsWith("/modules/eps");
  const isWmsActive = pathname.startsWith("/modules/wms");
  const isSettingsActive = pathname.startsWith("/admin");

  const [epsOpen, setEpsOpen] = useState<boolean>(isEpsActive);
  const [wmsOpen, setWmsOpen] = useState<boolean>(isWmsActive);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(isSettingsActive);

  useEffect(() => {
    let isSubscribed = true;
    Promise.resolve().then(() => {
      if (!isSubscribed) return;
      const savedEps = localStorage.getItem("ems_shell_sidebar_eps_open");
      if (savedEps !== null) setEpsOpen(savedEps === "true");
      const savedWms = localStorage.getItem("ems_shell_sidebar_wms_open");
      if (savedWms !== null) setWmsOpen(savedWms === "true");
      const savedSettings = localStorage.getItem("ems_shell_sidebar_settings_open");
      if (savedSettings !== null) setSettingsOpen(savedSettings === "true");
    });
    return () => {
      isSubscribed = false;
    };
  }, []);

  const [moduleHealth, setModuleHealth] = useState<Record<string, "online" | "dev" | "offline">>({
    eps: MODULES_CONFIG.eps.status,
  });

  useEffect(() => {

    // Ping health endpoints to detect offline status dynamically
    const checkHealth = async () => {
      const updated: Record<string, "online" | "dev" | "offline"> = { ...moduleHealth };

      // Check EPS health
      try {
        const res = await fetch("/api/modules/eps/health", { cache: "no-store" });
        if (res.ok) {
          updated.eps = "online";
        } else {
          updated.eps = "offline";
        }
      } catch {
        updated.eps = "offline";
      }

      setModuleHealth(updated);
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const [search, setSearch] = useState("");

  const toggleEps = () => {
    setEpsOpen((prev) => {
      const next = !prev;
      localStorage.setItem("ems_shell_sidebar_eps_open", String(next));
      return next;
    });
  };

  const toggleWms = () => {
    setWmsOpen((prev) => {
      const next = !prev;
      localStorage.setItem("ems_shell_sidebar_wms_open", String(next));
      return next;
    });
  };

  const toggleSettings = () => {
    setSettingsOpen((prev) => {
      const next = !prev;
      localStorage.setItem("ems_shell_sidebar_settings_open", String(next));
      return next;
    });
  };

  const handleEpsClick = () => {
    if (collapsed) {
      setSidebarCollapsed(false);
      setEpsOpen(true);
      localStorage.setItem("ems_shell_sidebar_eps_open", "true");
    } else {
      toggleEps();
    }
  };

  const handleWmsClick = () => {
    if (collapsed) {
      setSidebarCollapsed(false);
      setWmsOpen(true);
      localStorage.setItem("ems_shell_sidebar_wms_open", "true");
    } else {
      toggleWms();
    }
  };

  const handleSettingsClick = () => {
    if (collapsed) {
      setSidebarCollapsed(false);
      setSettingsOpen(true);
      localStorage.setItem("ems_shell_sidebar_settings_open", "true");
    } else {
      toggleSettings();
    }
  };

  // Поиск по декларативным ключевым словам из NAV_ITEMS
  const query = search.trim().toLowerCase();

  const itemMatchesQuery = (item: NavItem): boolean => {
    if (!query) return true;
    if (item.title.toLowerCase().includes(query)) return true;
    if (item.keywords.some((kw) => kw.toLowerCase().includes(query))) return true;
    if (item.children && item.children.some(itemMatchesQuery)) return true;
    return false;
  };
  const navDashboard = NAV_ITEMS.find((i) => i.id === "nav-dashboard");
  const epsNav = NAV_ITEMS.find((i) => i.id === "nav-eps-root");
  const wmsNav = NAV_ITEMS.find((i) => i.id === "nav-wms-root");
  const settingsNav = NAV_ITEMS.find((i) => i.id === "nav-settings-root");

  const epsSubItems = epsNav?.children ?? [];
  const wmsSubItems = wmsNav?.children ?? [];
  const settingsSubItems = settingsNav?.children ?? [];

  const showDashboard = navDashboard ? itemMatchesQuery(navDashboard) : false;
  const showEpsRoot = epsNav ? itemMatchesQuery(epsNav) : false;
  const showWmsRoot = wmsNav ? itemMatchesQuery(wmsNav) : false;
  const showSettingsRoot = settingsNav ? itemMatchesQuery(settingsNav) : false;

  const showBusinessModulesSection = showEpsRoot || showWmsRoot;

  const renderModuleBadge = (modId: string) => {
    const status = moduleHealth[modId] || MODULES_CONFIG[modId]?.status || "online";
    if (status === "offline") {
      return (
        <span className="text-[9px] font-semibold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
          <span className="h-1 w-1 rounded-full bg-rose-400 shrink-0" />
          Недоступен
        </span>
      );
    }
    if (status === "dev") {
      return (
        <span className="text-[9px] font-normal text-slate-400 bg-slate-800/60 border border-slate-700/50 px-1.5 py-0.5 rounded">
          В разработке
        </span>
      );
    }
    return null;
  };

  return (
    <aside
      aria-label="Основная навигация"
      className={`flex h-full flex-col bg-[#111a2e] text-white shadow-[8px_0_24px_rgba(15,23,42,.08)] transition-all duration-200 ${
        collapsed ? "w-[72px]" : "w-[248px]"
      }`}
    >
      {/* Brand Header */}
      <div
        className={`flex h-[68px] items-center border-b border-white/10 ${
          collapsed ? "justify-center px-2" : "px-4"
        }`}
      >
        {collapsed ? (
          <button
            onClick={onToggle}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Развернуть меню"
            title="Развернуть меню"
          >
            <Menu size={18} />
          </button>
        ) : (
          <>
            <Link href="/" className="flex items-center">
              <img
                src={BRAND_CONFIG.logoUrl}
                alt="EPS Logo"
                className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-white/10"
              />
              <div className="ml-2.5 leading-none">
                <div className="text-[13px] font-bold tracking-tight">{BRAND_CONFIG.name}</div>
                <div className="mt-1 text-[8px] font-semibold uppercase tracking-[.16em] text-slate-400">
                  {BRAND_CONFIG.subtitle}
                </div>
              </div>
            </Link>
            <button
              onClick={onToggle}
              className="ml-auto rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Свернуть меню"
              title="Свернуть меню"
            >
              <Menu size={15} />
            </button>
          </>
        )}
      </div>

      {/* Quick Search */}
      {!collapsed && (
        <div className="px-3 pt-4">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по меню..."
              aria-label="Поиск по меню"
              className="h-8 w-full rounded-md border-0 bg-[#1b2945] pl-8 pr-2 text-[10px] text-slate-200 outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-blue-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Очистить поиск"
                className="absolute right-2 top-2.5 text-slate-400 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto py-5 custom-scrollbar ${collapsed ? "px-2" : "px-3"}`}>
        {/* Group: ГЛАВНАЯ */}
        {showDashboard && (
          <>
            {!collapsed && (
              <div className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                Главная
              </div>
            )}
            <Link
              href="/"
              title="Обзор Платформы"
              className={`group mb-1 flex h-9 w-full items-center rounded-md text-left text-[11px] font-medium transition ${
                collapsed ? "justify-center p-0" : "gap-3 px-3 py-2"
              } ${
                pathname === "/" ? "bg-[#243a62] text-[#55a5ff]" : "text-slate-300 hover:bg-white/5"
              }`}
            >
              <LayoutDashboard size={14} />
              {!collapsed && <span>Обзор Платформы</span>}
            </Link>
          </>
        )}

        {/* Group: БИЗНЕС-МОДУЛИ */}
        {showBusinessModulesSection && (
          <>
            {!collapsed && (
              <div className="mb-2 mt-5 px-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                Бизнес-модули
              </div>
            )}

            {/* EPS Module Expandable */}
            {showEpsRoot && (
              <>
                <button
                  title={MODULES_CONFIG.eps.name}
                  onClick={handleEpsClick}
                  aria-expanded={epsOpen}
                  aria-label={`${MODULES_CONFIG.eps.name} подменю`}
                  className={`group mb-1 flex h-9 w-full items-center rounded-md text-left text-[11px] font-medium transition ${
                    collapsed ? "justify-center p-0" : "gap-3 px-3 py-2"
                  } ${
                    isEpsActive ? "bg-[#1b2945] text-[#55a5ff]" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <Server size={14} className={isEpsActive ? "text-[#55a5ff]" : "text-slate-400"} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{MODULES_CONFIG.eps.name}</span>
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-400 font-mono">
                        {MODULES_CONFIG.eps.version}
                      </span>
                      {epsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </>
                  )}
                </button>

                {/* EPS Submenu */}
                {!collapsed && (epsOpen || query.length > 0) && (
                  <div className="mb-2 ml-4 border-l border-[#2a3b59] pl-3 text-[10px] text-slate-400 space-y-0.5">
                    {epsSubItems.map((sub) => {
                      if (!itemMatchesQuery(sub)) return null;
                      const isSubActive = pathname === sub.href;

                      return (
                        <Link
                          key={sub.id}
                          href={sub.href}
                          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                            isSubActive ? "bg-white/10 text-white font-semibold" : "hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {sub.id === "nav-eps-registry" && <Box size={12} />}
                          {sub.id === "nav-eps-documents" && <FileText size={12} />}
                          {sub.id === "nav-eps-reports" && <BarChart3 size={12} />}
                          {sub.id === "nav-eps-approvals" && <ClipboardCheck size={12} />}
                          {sub.id === "nav-eps-history" && <Activity size={12} />}
                          <span className="flex-1">{sub.title}</span>
                          {sub.id === "nav-eps-approvals" && (
                            <span className="rounded bg-[#2366c6]/40 px-1 py-0.5 text-[8px] font-bold text-[#55a5ff] font-mono">
                              {pendingApprovals}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* WMS Module Expandable */}
            {showWmsRoot && (
              <>
                <button
                  title={MODULES_CONFIG.wms?.name || "WMS Складской учет"}
                  onClick={handleWmsClick}
                  aria-expanded={wmsOpen}
                  aria-label={`${MODULES_CONFIG.wms?.name || "WMS Складной учет"} подменю`}
                  className={`group mb-1 flex h-9 w-full items-center rounded-md text-left text-[11px] font-medium transition ${
                    collapsed ? "justify-center p-0" : "gap-3 px-3 py-2"
                  } ${
                    isWmsActive ? "bg-[#1b2945] text-[#55a5ff]" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <Warehouse size={14} className={isWmsActive ? "text-[#55a5ff]" : "text-slate-400"} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{MODULES_CONFIG.wms?.name || "WMS Складской учет"}</span>
                      <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] text-blue-400 font-mono">
                        {MODULES_CONFIG.wms?.version || "v1.0.0"}
                      </span>
                      {wmsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </>
                  )}
                </button>

                {/* WMS Submenu */}
                {!collapsed && (wmsOpen || query.length > 0) && (
                  <div className="mb-2 ml-4 border-l border-[#2a3b59] pl-3 text-[10px] text-slate-400 space-y-0.5">
                    {wmsSubItems.map((sub) => {
                      if (!itemMatchesQuery(sub)) return null;
                      const isSubActive = pathname === sub.href;

                      return (
                        <Link
                          key={sub.id}
                          href={sub.href}
                          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                            isSubActive ? "bg-white/10 text-white font-semibold" : "hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {sub.id === "nav-wms-dashboard" && <LayoutDashboard size={12} />}
                          {sub.id === "nav-wms-transfers" && <ArrowRightLeft size={12} />}
                          {sub.id === "nav-wms-personal-cards" && <UserCheck size={12} />}
                          {sub.id === "nav-wms-movements" && <History size={12} />}
                          <span className="flex-1">{sub.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Group: НАСТРОЙКИ I АДМИНИСТРИРОВАНИЕ */}
        {showSettingsRoot && (
          <>
            {!collapsed && (
              <div className="mb-2 mt-5 px-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                Настройки & Администрирование
              </div>
            )}

            {/* Expandable Settings Group */}
            <button
              title="Настройки"
              onClick={handleSettingsClick}
              aria-expanded={settingsOpen}
              aria-label="Настройки и администрирование подменю"
              className={`group mb-1 flex h-9 w-full items-center rounded-md text-left text-[11px] font-medium transition ${
                collapsed ? "justify-center p-0" : "gap-3 px-3 py-2"
              } ${
                isSettingsActive ? "bg-[#1b2945] text-[#55a5ff]" : "text-slate-300 hover:bg-white/5"
              }`}
            >
              <Settings2 size={14} className={isSettingsActive ? "text-[#55a5ff]" : "text-slate-400"} />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">Настройки</span>
                  {settingsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </>
              )}
            </button>

            {/* Settings Submenu */}
            {!collapsed && (settingsOpen || query.length > 0) && (
              <div className="mb-2 ml-4 border-l border-[#2a3b59] pl-3 text-[10px] text-slate-400 space-y-0.5">
                {settingsSubItems.map((sub) => {
                  if (!itemMatchesQuery(sub)) return null;
                  const isSubActive = sub.href === "/admin/settings/eps" ? pathname.startsWith("/admin/settings/eps") : pathname === sub.href;

                  return (
                    <Link
                      key={sub.id}
                      href={sub.href}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                        isSubActive ? "bg-white/10 text-white font-semibold" : "hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {sub.id === "nav-admin-settings" && <SlidersHorizontal size={12} />}
                      {sub.id === "nav-admin-rbac" && <ShieldCheck size={12} />}
                      {sub.id === "nav-admin-eps-nsi" && <Database size={12} />}
                      {sub.id === "nav-admin-audit" && <Gauge size={12} />}
                      <span>{sub.title}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </nav>

      {/* Sidebar Footer System Info */}
      <div className="border-t border-white/10 px-4 py-3 text-slate-400">
        {!collapsed ? (
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-slate-300">{BRAND_CONFIG.name}</span>
            <span className="text-[10px] text-slate-500 font-mono">v{APP_VERSION}</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="text-[9px] text-slate-500 font-mono">v{APP_VERSION}</span>
          </div>
        )}
      </div>
    </aside>
  );
}

export default function AppSidebar() {
  const { mobileMenuOpen, setMobileMenuOpen } = useShell();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen, setMobileMenuOpen]);

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <div className="hidden lg:block fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Мобильная навигация"
          className="fixed inset-0 z-50 flex lg:hidden bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-[260px] h-full shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
