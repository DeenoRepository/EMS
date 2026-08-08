"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { useShell } from "./shell-context";
import { MODULES_CONFIG, ModuleManifest } from "@/lib/config/modules";
import { getAdminSettingsNavItems } from "@/lib/config/nav";
import { APP_VERSION } from "@/lib/version";
import { BRAND_CONFIG } from "@/lib/config/brand";

function DynamicIcon({ name, size = 14, className }: { name?: string; size?: number; className?: string }) {
  if (!name) return <Icons.Box size={size} className={className} />;
  const IconComp = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[name] || Icons.Box;
  return <IconComp size={size} className={className} />;
}

function SidebarContent() {
  const {
    currentUser,
    sidebarCollapsed: collapsed,
    setSidebarCollapsed,
    toggleSidebar: onToggle,
    pendingApprovals,
    pendingWmsRequisitions,
    sidebarCounters,
    markSectionAsSeen,
  } = useShell();

  const pathname = usePathname();
  const modulesList = Object.values(MODULES_CONFIG);

  const isSettingsActive = pathname.startsWith("/admin");

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      settings: isSettingsActive,
    };
    modulesList.forEach((mod) => {
      initial[mod.id] = pathname.startsWith(mod.href);
    });
    return initial;
  });

  useEffect(() => {
    let isSubscribed = true;
    Promise.resolve().then(() => {
      if (!isSubscribed) return;
      setOpenSections((prev) => {
        const next = { ...prev };
        modulesList.forEach((mod) => {
          const saved = localStorage.getItem(`ems_shell_sidebar_${mod.id}_open`);
          if (saved !== null) {
            next[mod.id] = saved === "true";
          } else if (pathname.startsWith(mod.href)) {
            next[mod.id] = true;
          }
        });
        const savedSettings = localStorage.getItem("ems_shell_sidebar_settings_open");
        if (savedSettings !== null) {
          next.settings = savedSettings === "true";
        } else if (pathname.startsWith("/admin")) {
          next.settings = true;
        }
        return next;
      });
    });
    return () => {
      isSubscribed = false;
    };
  }, [pathname]);

  const [moduleHealth, setModuleHealth] = useState<Record<string, "online" | "dev" | "offline">>(() => {
    const initial: Record<string, "online" | "dev" | "offline"> = {};
    modulesList.forEach((mod) => {
      initial[mod.id] = mod.status;
    });
    return initial;
  });

  const checkHealth = useCallback(async () => {
    const updated: Record<string, "online" | "dev" | "offline"> = { ...moduleHealth };

    await Promise.all(
      modulesList.map(async (mod) => {
        if (!mod.healthEndpoint) return;
        try {
          const res = await fetch(mod.healthEndpoint, { cache: "no-store" });
          updated[mod.id] = res.ok ? "online" : "offline";
        } catch {
          updated[mod.id] = "offline";
        }
      })
    );

    setModuleHealth(updated);
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const [search, setSearch] = useState("");

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const nextState = !prev[id];
      localStorage.setItem(`ems_shell_sidebar_${id}_open`, String(nextState));
      return { ...prev, [id]: nextState };
    });
  };

  const handleModuleClick = (mod: ModuleManifest) => {
    if (collapsed) {
      setSidebarCollapsed(false);
      toggleSection(mod.id);
    } else {
      toggleSection(mod.id);
    }
  };

  const handleSettingsClick = () => {
    if (collapsed) {
      setSidebarCollapsed(false);
      toggleSection("settings");
    } else {
      toggleSection("settings");
    }
  };

  const query = search.trim().toLowerCase();

  const itemMatchesQuery = (title: string, keywords: string[] = []): boolean => {
    if (!query) return true;
    if (title.toLowerCase().includes(query)) return true;
    if (keywords.some((kw) => kw.toLowerCase().includes(query))) return true;
    return false;
  };

  const userRoles = currentUser?.roles || [];
  const isAdmin = userRoles.includes("ADMIN");
  const isApprover = isAdmin || userRoles.includes("APPROVER");
  const canEditEps = isAdmin || isApprover || userRoles.includes("EDITOR");
  const canEditWms = isAdmin || userRoles.includes("STOREKEEPER");

  const adminSettingsNav = getAdminSettingsNavItems()[0];
  const settingsSubItems = adminSettingsNav?.children ?? [];

  return (
    <aside
      aria-label="Основная навигация"
      className={`flex h-full flex-col bg-[#111a2e] text-white shadow-[8px_0_24px_rgba(15,23,42,.08)] transition-[width] duration-300 ease-in-out select-none overflow-hidden ${
        collapsed ? "w-[72px]" : "w-[248px]"
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-[68px] shrink-0 items-center border-b border-white/10 px-3.5 relative overflow-hidden transition-all duration-300 ease-in-out">
        {collapsed ? (
          <div className="flex w-full items-center justify-center">
            <button
              onClick={onToggle}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-300 transition-all duration-300 hover:bg-white/10 hover:text-white hover:scale-105"
              aria-label="Развернуть меню"
              title="Развернуть меню"
            >
              <Icons.Menu size={18} />
            </button>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between min-w-0">
            <Link
              href="/"
              className="flex items-center min-w-0 group"
              title={BRAND_CONFIG.name}
            >
              <img
                src={BRAND_CONFIG.logoUrl}
                alt="EMS Logo"
                className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-white/10 transition-all duration-300 group-hover:scale-105"
              />
              <div className="ml-2.5 flex flex-col justify-center whitespace-nowrap overflow-hidden transition-all duration-300">
                <div className="text-[13px] font-bold tracking-tight text-white leading-tight">
                  {BRAND_CONFIG.name}
                </div>
                <div className="mt-0.5 text-[8px] font-semibold uppercase tracking-[.16em] text-slate-400 leading-tight">
                  {BRAND_CONFIG.subtitle}
                </div>
              </div>
            </Link>

            <button
              onClick={onToggle}
              className="ml-auto shrink-0 rounded-lg p-1.5 text-slate-400 transition-all duration-300 hover:bg-white/10 hover:text-white"
              aria-label="Свернуть меню"
              title="Свернуть меню"
            >
              <Icons.Menu size={16} className="transition-transform duration-300 hover:scale-110" />
            </button>
          </div>
        )}
      </div>

      {/* Quick Search */}
      {!collapsed && (
        <div className="px-3 pt-4 shrink-0 transition-opacity duration-200">
          <div className="relative">
            <Icons.Search size={12} className="absolute left-3 top-2.5 text-slate-500" />
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
                <Icons.X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto py-5 custom-scrollbar ${collapsed ? "px-2" : "px-3"}`}>
        {/* Group: ГЛАВНАЯ */}
        {itemMatchesQuery("Обзор Платформы", ["главная", "обзор", "дашборд"]) && (
          <>
            {!collapsed && (
              <div className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
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
              <Icons.LayoutDashboard size={14} className="shrink-0" />
              {!collapsed && <span className="truncate whitespace-nowrap">Обзор Платформы</span>}
            </Link>
          </>
        )}

        {/* Group: БИЗНЕС-МОДУЛИ */}
        {modulesList.length > 0 && (
          <>
            {!collapsed && (
              <div className="mb-2 mt-5 px-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                Бизнес-модули
              </div>
            )}

            {modulesList.map((mod) => {
              const isModuleActive = pathname.startsWith(mod.href);
              const isOpen = !!openSections[mod.id];
              const healthStatus = moduleHealth[mod.id] || mod.status;

              // Суммарное количество событий для модуля при свёрнутом сайдбаре
              const moduleEventsTotal = mod.navItems.reduce((sum, item) => {
                let cnt = sidebarCounters[item.id] || 0;
                if (item.id === "nav-eps-approvals") cnt = Math.max(cnt, pendingApprovals);
                if (item.id === "nav-wms-requisitions") cnt = Math.max(cnt, pendingWmsRequisitions);
                return sum + cnt;
              }, 0);

              return (
                <React.Fragment key={mod.id}>
                  <button
                    title={mod.name}
                    onClick={() => handleModuleClick(mod)}
                    aria-expanded={isOpen}
                    aria-label={`${mod.name} подменю`}
                    className={`group mb-1 flex h-9 w-full items-center rounded-md text-left text-[11px] font-medium transition relative ${
                      collapsed ? "justify-center p-0" : "gap-3 px-3 py-2"
                    } ${
                      isModuleActive ? "bg-[#1b2945] text-[#55a5ff]" : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <div className="relative shrink-0 flex items-center justify-center">
                      <DynamicIcon name={mod.iconName} size={14} className={`${isModuleActive ? "text-[#55a5ff]" : "text-slate-400"}`} />
                      {collapsed && moduleEventsTotal > 0 && (
                        <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[8px] font-bold text-white shadow-xs ring-1 ring-[#111a2e] animate-pulse">
                          {moduleEventsTotal > 99 ? "99+" : moduleEventsTotal}
                        </span>
                      )}
                    </div>
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate whitespace-nowrap">{mod.name}</span>
                        {healthStatus === "offline" && (
                          <span className="text-[9px] font-semibold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse shrink-0">
                            <span className="h-1 w-1 rounded-full bg-rose-400 shrink-0" />
                            Offline
                          </span>
                        )}
                        <span className="shrink-0">
                          {isOpen ? <Icons.ChevronDown size={12} /> : <Icons.ChevronRight size={12} />}
                        </span>
                      </>
                    )}
                  </button>

                  {/* Submenu */}
                  {!collapsed && (isOpen || query.length > 0) && (
                    <div className="mb-2 ml-4 border-l border-[#2a3b59] pl-3 text-[10px] text-slate-400 space-y-0.5 transition-all duration-200">
                      {mod.navItems.map((sub) => {
                        if (!itemMatchesQuery(sub.title, sub.keywords)) return null;

                        if (sub.id === "nav-eps-approvals" && !isApprover) return null;
                        if (sub.id === "nav-eps-reports" && !isApprover) return null;
                        if (sub.id === "nav-eps-history" && !canEditEps) return null;
                        if (mod.id === "wms" && sub.id !== "nav-wms-dashboard" && !canEditWms) return null;

                        const isSubActive = pathname === sub.href;

                        let eventCount = sidebarCounters[sub.id] || 0;
                        if (sub.id === "nav-eps-approvals" && pendingApprovals > 0) {
                          eventCount = Math.max(eventCount, pendingApprovals);
                        }
                        if (sub.id === "nav-wms-requisitions" && pendingWmsRequisitions > 0) {
                          eventCount = Math.max(eventCount, pendingWmsRequisitions);
                        }

                        return (
                          <Link
                            key={sub.id}
                            href={sub.href}
                            onClick={() => markSectionAsSeen(sub.id)}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                              isSubActive ? "bg-white/10 text-white font-semibold" : "hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <DynamicIcon name={sub.iconName} size={12} className="shrink-0" />
                            <span className="flex-1 truncate whitespace-nowrap">{sub.title}</span>
                            {eventCount > 0 && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[8px] font-bold font-mono shrink-0 shadow-2xs border ${
                                  sub.id === "nav-eps-approvals" || sub.id === "nav-wms-requisitions"
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse"
                                    : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                }`}
                                title={`Количество активных событий / задач: ${eventCount}`}
                              >
                                {eventCount > 999 ? "999+" : eventCount}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </>
        )}

        {/* Group: НАСТРОЙКИ & АДМИНИСТРИРОВАНИЕ */}
        {isAdmin && (
          <>
            {!collapsed && (
              <div className="mb-2 mt-5 px-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                Настройки & Администрирование
              </div>
            )}

            <button
              title="Настройки"
              onClick={handleSettingsClick}
              aria-expanded={openSections.settings}
              aria-label="Настройки и администрирование подменю"
              className={`group mb-1 flex h-9 w-full items-center rounded-md text-left text-[11px] font-medium transition ${
                collapsed ? "justify-center p-0" : "gap-3 px-3 py-2"
              } ${
                isSettingsActive ? "bg-[#1b2945] text-[#55a5ff]" : "text-slate-300 hover:bg-white/5"
              }`}
            >
              <Icons.Settings2 size={14} className={`shrink-0 ${isSettingsActive ? "text-[#55a5ff]" : "text-slate-400"}`} />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate whitespace-nowrap">Настройки</span>
                  <span className="shrink-0">
                    {openSections.settings ? <Icons.ChevronDown size={12} /> : <Icons.ChevronRight size={12} />}
                  </span>
                </>
              )}
            </button>

            {!collapsed && (openSections.settings || query.length > 0) && (
              <div className="mb-2 ml-4 border-l border-[#2a3b59] pl-3 text-[10px] text-slate-400 space-y-0.5 transition-all duration-200">
                {settingsSubItems.map((sub) => {
                  if (!itemMatchesQuery(sub.title, sub.keywords)) return null;
                  const isSubActive = pathname === sub.href || (sub.href !== "/admin/settings" && pathname.startsWith(sub.href));

                  return (
                    <Link
                      key={sub.id}
                      href={sub.href}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                        isSubActive ? "bg-white/10 text-white font-semibold" : "hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <DynamicIcon name={sub.iconName} size={12} className="shrink-0" />
                      <span className="truncate whitespace-nowrap">{sub.title}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </nav>

      {/* Sidebar Footer System Info */}
      <div className="border-t border-white/10 px-4 py-3 text-slate-400 shrink-0">
        {!collapsed ? (
          <div className="flex items-center justify-between text-[11px] whitespace-nowrap">
            <span className="font-medium text-slate-300 truncate">{BRAND_CONFIG.name}</span>
            <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">v{APP_VERSION}</span>
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
