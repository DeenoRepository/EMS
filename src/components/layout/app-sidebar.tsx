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
import { cn } from "@/lib/utils";

function DynamicIcon({
  name,
  size = 16,
  className,
}: {
  name?: string;
  size?: number;
  className?: string;
}) {
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
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground shadow-lg",
        "transition-[width] duration-300 ease-out select-none overflow-hidden",
        collapsed ? "w-[72px]" : "w-[248px]"
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-3.5 relative overflow-hidden transition-all duration-300">
        {collapsed ? (
          <div className="flex w-full items-center justify-center">
            <button
              type="button"
              onClick={onToggle}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              aria-label="Развернуть меню"
              title="Развернуть меню"
            >
              <Icons.Menu className="h-5 w-5" aria-hidden="true" />
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
                alt={`${BRAND_CONFIG.name} Logo`}
                className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-sidebar-border transition-transform group-hover:scale-105"
              />
              <div className="ml-2.5 flex flex-col justify-center whitespace-nowrap overflow-hidden transition-all duration-300">
                <div className="text-sm font-bold tracking-tight text-sidebar-foreground leading-tight">
                  {BRAND_CONFIG.name}
                </div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/60 leading-tight">
                  {BRAND_CONFIG.subtitle}
                </div>
              </div>
            </Link>

            <button
              type="button"
              onClick={onToggle}
              className="ml-auto shrink-0 rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              aria-label="Свернуть меню"
              title="Свернуть меню"
            >
              <Icons.Menu className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Quick Search */}
      {!collapsed && (
        <div className="px-3 pt-4 shrink-0 transition-opacity duration-200">
          <div className="relative">
            <Icons.Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/50"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по меню..."
              aria-label="Поиск по меню"
              className="h-9 w-full rounded-md border-0 bg-sidebar-accent pl-8 pr-8 text-xs text-sidebar-foreground outline-none placeholder:text-sidebar-foreground/50 focus:ring-1 focus:ring-sidebar-ring"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Очистить поиск"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-sidebar-foreground/60 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <Icons.X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto py-5 custom-scrollbar",
          collapsed ? "px-2" : "px-3"
        )}
        aria-label="Навигация по модулям"
      >
        {/* Group: ГЛАВНАЯ */}
        {itemMatchesQuery("Обзор Платформы", ["главная", "обзор", "дашборд"]) && (
          <>
            {!collapsed && (
              <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 whitespace-nowrap">
                Главная
              </div>
            )}
            <Link
              href="/"
              title="Обзор Платформы"
              className={cn(
                "group mb-1 flex h-10 w-full items-center rounded-md text-left text-sm font-medium transition-colors",
                collapsed ? "justify-center p-0" : "gap-3 px-3",
                pathname === "/"
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icons.LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate whitespace-nowrap">Обзор Платформы</span>}
            </Link>
          </>
        )}

        {/* Group: БИЗНЕС-МОДУЛИ */}
        {modulesList.length > 0 && (
          <>
            {!collapsed && (
              <div className="mb-2 mt-5 px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 whitespace-nowrap">
                Бизнес-модули
              </div>
            )}

            {modulesList.map((mod) => {
              const isModuleActive = pathname.startsWith(mod.href);
              const isOpen = !!openSections[mod.id];
              const healthStatus = moduleHealth[mod.id] || mod.status;

              const moduleEventsTotal = mod.navItems.reduce((sum, item) => {
                let cnt = sidebarCounters[item.id] || 0;
                if (item.id === "nav-eps-approvals") cnt = Math.max(cnt, pendingApprovals);
                if (item.id === "nav-wms-requisitions") cnt = Math.max(cnt, pendingWmsRequisitions);
                return sum + cnt;
              }, 0);

              return (
                <React.Fragment key={mod.id}>
                  <button
                    type="button"
                    title={mod.name}
                    onClick={() => handleModuleClick(mod)}
                    aria-expanded={isOpen}
                    aria-label={`${mod.name} подменю`}
                    className={cn(
                      "group mb-1 flex h-10 w-full items-center rounded-md text-left text-sm font-medium transition-colors",
                      collapsed ? "justify-center p-0" : "gap-3 px-3",
                      isModuleActive
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <div className="relative shrink-0 flex items-center justify-center">
                      <DynamicIcon
                        name={mod.iconName}
                        size={16}
                        className={cn(
                          isModuleActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
                        )}
                      />
                      {collapsed && moduleEventsTotal > 0 && (
                        <span
                          className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm ring-1 ring-sidebar animate-pulse"
                          aria-label={`${moduleEventsTotal} событий`}
                        >
                          {moduleEventsTotal > 99 ? "99+" : moduleEventsTotal}
                        </span>
                      )}
                    </div>
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate whitespace-nowrap">{mod.name}</span>
                        {healthStatus === "offline" && (
                          <span className="text-[10px] font-semibold text-destructive bg-destructive/15 border border-destructive/30 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse shrink-0">
                            <span className="h-1 w-1 rounded-full bg-destructive shrink-0" />
                            Offline
                          </span>
                        )}
                        <span className="shrink-0">
                          {isOpen ? (
                            <Icons.ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <Icons.ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </span>
                      </>
                    )}
                  </button>

                  {/* Submenu */}
                  {!collapsed && (isOpen || query.length > 0) && (
                    <div className="mb-2 ml-4 border-l border-sidebar-border pl-3 text-xs text-sidebar-foreground/70 space-y-0.5 transition-all duration-200">
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
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors min-h-[32px]",
                              isSubActive
                                ? "bg-sidebar-accent text-sidebar-foreground font-semibold"
                                : "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            )}
                          >
                            <DynamicIcon
                              name={sub.iconName}
                              size={14}
                              className="shrink-0"
                            />
                            <span className="flex-1 truncate whitespace-nowrap">{sub.title}</span>
                            {eventCount > 0 && (
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-bold font-mono shrink-0 shadow-sm border",
                                  sub.id === "nav-eps-approvals" || sub.id === "nav-wms-requisitions"
                                    ? "bg-warning/20 text-warning border-warning/30 animate-pulse"
                                    : "bg-primary/20 text-primary border-primary/30"
                                )}
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
              <div className="mb-2 mt-5 px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 whitespace-nowrap">
                Настройки & Администрирование
              </div>
            )}

            <button
              type="button"
              title="Настройки"
              onClick={handleSettingsClick}
              aria-expanded={openSections.settings}
              aria-label="Настройки и администрирование подменю"
              className={cn(
                "group mb-1 flex h-10 w-full items-center rounded-md text-left text-sm font-medium transition-colors",
                collapsed ? "justify-center p-0" : "gap-3 px-3",
                isSettingsActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icons.Settings2
                className={cn(
                  "h-4 w-4 shrink-0",
                  isSettingsActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
                )}
                aria-hidden="true"
              />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate whitespace-nowrap">Настройки</span>
                  <span className="shrink-0">
                    {openSections.settings ? (
                      <Icons.ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <Icons.ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </span>
                </>
              )}
            </button>

            {!collapsed && (openSections.settings || query.length > 0) && (
              <div className="mb-2 ml-4 border-l border-sidebar-border pl-3 text-xs text-sidebar-foreground/70 space-y-0.5 transition-all duration-200">
                {settingsSubItems.map((sub) => {
                  if (!itemMatchesQuery(sub.title, sub.keywords)) return null;
                  const isSubActive =
                    pathname === sub.href ||
                    (sub.href !== "/admin/settings" && pathname.startsWith(sub.href));

                  return (
                    <Link
                      key={sub.id}
                      href={sub.href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors min-h-[32px]",
                        isSubActive
                          ? "bg-sidebar-accent text-sidebar-foreground font-semibold"
                          : "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <DynamicIcon name={sub.iconName} size={14} className="shrink-0" />
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
      <div className="border-t border-sidebar-border px-4 py-3 text-sidebar-foreground/60 shrink-0">
        {!collapsed ? (
          <div className="flex items-center justify-between text-xs whitespace-nowrap">
            <span className="font-medium text-sidebar-foreground/80 truncate">
              {BRAND_CONFIG.name}
            </span>
            <span className="text-[10px] text-sidebar-foreground/50 font-mono shrink-0 ml-2">
              v{APP_VERSION}
            </span>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="text-[10px] text-sidebar-foreground/50 font-mono">
              v{APP_VERSION}
            </span>
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
      <div className="hidden lg:block fixed inset-y-0 left-0 z-[var(--z-fixed)]">
        <SidebarContent />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Мобильная навигация"
          className="fixed inset-0 z-[var(--z-modal)] flex lg:hidden bg-slate-900/60 backdrop-blur-sm"
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
