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
  pendingWmsRequisitions: number;
  refreshPendingWmsRequisitions: () => Promise<void>;
  sidebarCounters: Record<string, number>;
  refreshSidebarCounters: () => Promise<void>;
  markSectionAsSeen: (sectionId: string) => void;
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
}

const ShellContext = createContext<ShellContextType | undefined>(undefined);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [facilities] = useState<EnterpriseFacility[]>(DEFAULT_FACILITIES);
  const [currentFacility, setCurrentFacility] = useState<EnterpriseFacility>(DEFAULT_FACILITIES[0]);
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [favorites, setFavorites] = useState<NavBookmark[]>([]);
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [pendingWmsRequisitions, setPendingWmsRequisitions] = useState<number>(0);
  const [sidebarCounters, setSidebarCounters] = useState<Record<string, number>>({});
  const [sectionSeenTimestamps, setSectionSeenTimestamps] = useState<Record<string, number>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    let isSubscribed = true;
    Promise.resolve().then(() => {
      if (!isSubscribed) return;

      // Restore sidebarCollapsed
      const savedCollapsed = localStorage.getItem("ems_shell_sidebar_collapsed");
      if (savedCollapsed !== null) setSidebarCollapsedState(savedCollapsed === "true");

      // Restore facility
      const savedFacilityId = localStorage.getItem("ems_shell_facility_id");
      if (savedFacilityId) {
        const found = DEFAULT_FACILITIES.find((f) => f.id === savedFacilityId);
        if (found) setCurrentFacility(found);
      }

      // Restore theme
      const savedTheme = localStorage.getItem("ems_shell_theme") as ThemeMode | null;
      if (savedTheme) setThemeState(savedTheme);

      // Restore favorites
      const savedFavs = localStorage.getItem("ems_shell_favorites");
      if (savedFavs) {
        try {
          const parsed = JSON.parse(savedFavs);
          if (Array.isArray(parsed)) setFavorites(parsed);
        } catch {}
      }

      // Restore recents
      const savedRecents = localStorage.getItem("ems_shell_recents");
      if (savedRecents) {
        try {
          const parsed = JSON.parse(savedRecents);
          if (Array.isArray(parsed)) setRecentPages(parsed);
        } catch {}
      }

      // Restore notifications
      const savedNotes = localStorage.getItem("ems_shell_notifications");
      if (savedNotes) {
        try {
          const parsed = JSON.parse(savedNotes);
          if (Array.isArray(parsed)) setNotifications(parsed);
        } catch {}
      }

      // Restore section seen timestamps
      const savedSeen = localStorage.getItem("ems_shell_section_seen");
      if (savedSeen) {
        try {
          const parsed = JSON.parse(savedSeen);
          if (typeof parsed === "object" && parsed !== null) setSectionSeenTimestamps(parsed);
        } catch {}
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, []);

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

  const refreshPendingWmsRequisitions = useCallback(async () => {
    try {
      const res = await fetch("/api/modules/wms/requisitions/count");
      if (res.ok) {
        const data = await res.json();
        if (typeof data.count === "number") {
          setPendingWmsRequisitions(data.count);
        }
      }
    } catch {
      // Игнорируем ошибки при отсутствии сети
    }
  }, []);

  const refreshSidebarCounters = useCallback(async () => {
    try {
      const savedSeenStr = localStorage.getItem("ems_shell_section_seen");
      let seenMap: Record<string, number> = {};
      if (savedSeenStr) {
        try {
          seenMap = JSON.parse(savedSeenStr);
        } catch {}
      }

      const params = new URLSearchParams();
      Object.entries(seenMap).forEach(([k, v]) => {
        params.set(`seen_${k}`, String(v));
      });

      const res = await fetch(`/api/modules/sidebar-counters?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.counters && typeof data.counters === "object") {
          setSidebarCounters(data.counters);
          if (typeof data.counters["nav-eps-approvals"] === "number") {
            setPendingApprovals(data.counters["nav-eps-approvals"]);
          }
          if (typeof data.counters["nav-wms-requisitions"] === "number") {
            setPendingWmsRequisitions(data.counters["nav-wms-requisitions"]);
          }
        }
      }
    } catch {
      // Игнорируем ошибки сети
    }
  }, []);

  const markSectionAsSeen = useCallback((sectionId: string) => {
    const now = Date.now();
    setSectionSeenTimestamps((prev) => {
      const updated = { ...prev, [sectionId]: now };
      localStorage.setItem("ems_shell_section_seen", JSON.stringify(updated));
      return updated;
    });
    setSidebarCounters((prev) => {
      const updated = { ...prev, [sectionId]: 0 };
      return updated;
    });
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

    // Асинхронное получение первичной очереди согласований, WMS запросов и счетчиков сайдбара
    void (async () => {
      await refreshPendingApprovals();
      await refreshPendingWmsRequisitions();
      await refreshSidebarCounters();
    })();

    // Автоматическое периодическое обновление очереди согласований и счетчиков каждые 60 секунд
    const intervalId = setInterval(() => {
      void refreshPendingApprovals();
      void refreshPendingWmsRequisitions();
      void refreshSidebarCounters();
    }, 60000);

    applyTheme(theme);

    return () => clearInterval(intervalId);
  }, [refreshPendingApprovals, refreshPendingWmsRequisitions, refreshSidebarCounters, applyTheme, theme]);

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
        pendingWmsRequisitions,
        refreshPendingWmsRequisitions,
        sidebarCounters,
        refreshSidebarCounters,
        markSectionAsSeen,
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
