"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { UserSession } from "@/lib/auth/rbac";
import { EnterpriseFacility, DEFAULT_FACILITIES } from "@/lib/config/facilities";

export type { EnterpriseFacility };

export interface NavBookmark {
  title: string;
  href: string;
  iconName?: string;
}

export interface RecentPage {
  title: string;
  href: string;
  visitedAt: number;
}

export type ThemeMode = "light" | "dark" | "system";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

interface ShellContextType {
  currentUser: UserSession | null;
  logout: () => Promise<void>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  toggleSidebar: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  facilities: EnterpriseFacility[];
  currentFacility: EnterpriseFacility;
  setFacility: (facility: EnterpriseFacility) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  favorites: NavBookmark[];
  toggleFavorite: (bookmark: NavBookmark) => void;
  isFavorite: (href: string) => boolean;
  recentPages: RecentPage[];
  addRecentPage: (page: { title: string; href: string }) => void;
  pendingApprovals: number;
  refreshPendingApprovals: () => Promise<void>;
  pendingWmsTransfers: number;
  refreshPendingWmsTransfers: () => Promise<void>;
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
}

const ShellContext = createContext<ShellContextType | undefined>(undefined);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [facilities] = useState<EnterpriseFacility[]>(DEFAULT_FACILITIES);
  const [currentFacility, setCurrentFacility] = useState<EnterpriseFacility>(DEFAULT_FACILITIES[0]);
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [favorites, setFavorites] = useState<NavBookmark[]>([]);
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [pendingWmsTransfers, setPendingWmsTransfers] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const refreshPendingApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/modules/eps/approval-queue/count");
      if (res.ok) {
        const data = await res.json();
        if (typeof data.count === "number") {
          setPendingApprovals(data.count);
        }
      }
    } catch {
      // Игнорируем ошибки при отсутствии сети
    }
  }, []);

  const refreshPendingWmsTransfers = useCallback(async () => {
    try {
      const res = await fetch("/api/modules/wms/transfer-requests?status=PENDING");
      if (res.ok) {
        const data = await res.json();
        if (data?.requests && Array.isArray(data.requests)) {
          setPendingWmsTransfers(data.requests.length);
        }
      }
    } catch {
      // Игнорируем
    }
  }, []);

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      localStorage.setItem("ems_shell_notifications", JSON.stringify(updated));
      return updated;
    });
  };

  const applyTheme = useCallback((mode: ThemeMode) => {
    const root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
    } else if (mode === "light") {
      root.classList.remove("dark");
    } else if (mode === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark) root.classList.add("dark");
      else root.classList.remove("dark");
    }
  }, []);

  // Инициализация при монтировании
  useEffect(() => {
    // Загрузка пользователя из API
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});

    refreshPendingApprovals();
    refreshPendingWmsTransfers();

    // Загрузка запросов на перемещение ТМЦ и генерация уведомлений для кладовщика
    fetch("/api/modules/wms/transfer-requests?status=PENDING")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.requests && Array.isArray(data.requests)) {
          setPendingWmsTransfers(data.requests.length);
          const transferNotifs: NotificationItem[] = data.requests.map((r: any) => ({
            id: `notif-${r.id}`,
            title: "Запрос на перемещение ТМЦ",
            message: `Запрошено ${r.quantity} ед. "${r.itemName}" со склада "${r.fromWarehouse}" на склад "${r.toWarehouse}".`,
            time: "Только что",
            read: false,
          }));

          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const newNotifs = transferNotifs.filter((n) => !existingIds.has(n.id));
            if (newNotifs.length > 0) {
              return [...newNotifs, ...prev];
            }
            return prev;
          });
        }
      })
      .catch(() => {});

    // Автоматическое периодическое обновление очереди согласований каждые 60 секунд
    const intervalId = setInterval(() => {
      refreshPendingApprovals();
      refreshPendingWmsTransfers();
    }, 60000);

    const savedCollapsed = localStorage.getItem("ems_shell_sidebar_collapsed");
    if (savedCollapsed !== null) {
      setSidebarCollapsedState(savedCollapsed === "true");
    }

    const savedFacilityId = localStorage.getItem("ems_shell_facility_id");
    if (savedFacilityId) {
      const found = DEFAULT_FACILITIES.find((f) => f.id === savedFacilityId);
      if (found) setCurrentFacility(found);
    }

    const savedTheme = (localStorage.getItem("ems_shell_theme") as ThemeMode | null) || "light";
    if (savedTheme) {
      setThemeState(savedTheme);
      applyTheme(savedTheme);
    }

    const savedFavs = localStorage.getItem("ems_shell_favorites");
    if (savedFavs) {
      try {
        const parsed = JSON.parse(savedFavs);
        if (Array.isArray(parsed)) setFavorites(parsed);
      } catch {}
    }

    const savedRecent = localStorage.getItem("ems_shell_recent_pages");
    if (savedRecent) {
      try {
        const parsed = JSON.parse(savedRecent);
        if (Array.isArray(parsed)) setRecentPages(parsed);
      } catch {}
    }

    const savedNotifs = localStorage.getItem("ems_shell_notifications");
    if (savedNotifs) {
      try {
        const parsed = JSON.parse(savedNotifs);
        if (Array.isArray(parsed)) setNotifications(parsed);
      } catch {}
    }

    return () => clearInterval(intervalId);
  }, [applyTheme, refreshPendingApprovals]);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setCurrentUser(null);
    window.location.href = "/login";
  };

  const setSidebarCollapsed = (value: boolean | ((prev: boolean) => boolean)) => {
    setSidebarCollapsedState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      localStorage.setItem("ems_shell_sidebar_collapsed", String(next));
      return next;
    });
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen((prev) => !prev);
  };

  const setFacility = (fac: EnterpriseFacility) => {
    setCurrentFacility(fac);
    localStorage.setItem("ems_shell_facility_id", fac.id);
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem("ems_shell_theme", mode);
    applyTheme(mode);
  };

  const toggleFavorite = (bookmark: NavBookmark) => {
    setFavorites((prev) => {
      const exists = prev.some((b) => b.href === bookmark.href);
      const next = exists ? prev.filter((b) => b.href !== bookmark.href) : [...prev, bookmark];
      localStorage.setItem("ems_shell_favorites", JSON.stringify(next));
      return next;
    });
  };

  const isFavorite = (href: string) => {
    return favorites.some((b) => b.href === href);
  };

  const addRecentPage = (page: { title: string; href: string }) => {
    setRecentPages((prev) => {
      const filtered = prev.filter((p) => p.href !== page.href);
      const updated = [{ title: page.title, href: page.href, visitedAt: Date.now() }, ...filtered].slice(0, 7);
      localStorage.setItem("ems_shell_recent_pages", JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <ShellContext.Provider
      value={{
        currentUser,
        logout,
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
        mobileMenuOpen,
        setMobileMenuOpen,
        toggleMobileMenu,
        facilities,
        currentFacility,
        setFacility,
        theme,
        setTheme,
        favorites,
        toggleFavorite,
        isFavorite,
        recentPages,
        addRecentPage,
        pendingApprovals,
        refreshPendingApprovals,
        pendingWmsTransfers,
        refreshPendingWmsTransfers,
        notifications,
        markNotificationRead,
        searchModalOpen,
        setSearchModalOpen,
      }}
    >
      {children}
    </ShellContext.Provider>
  );
}

export function useShell() {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error("useShell must be used within a ShellProvider");
  }
  return context;
}
