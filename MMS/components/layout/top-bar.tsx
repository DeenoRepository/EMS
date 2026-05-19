"use client";

import { Bell, LogOut, Search, User, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notifyError, notifySuccess } from "@/lib/client/notify";
import { getCompactUi, setCompactUi } from "@/lib/client/ui-preferences";

type PendingTask = {
  id: string;
  equipmentId: string;
  scheduledDate: string;
};

type QuickHit = { id: string; title: string; subtitle: string; href: string };

export function TopBar() {
  const { user } = useCurrentUser();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [compact, setCompact] = useState(false);

  const [globalQ, setGlobalQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHits, setSearchHits] = useState<QuickHit[]>([]);

  const logout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        notifyError("Не удалось завершить сессию");
        return;
      }
      notifySuccess("Вы вышли из системы");
      window.setTimeout(() => window.location.reload(), 180);
    } catch {
      notifyError("Ошибка выхода из системы");
    }
  };

  useEffect(() => {
    setCompact(getCompactUi());
    const loadNotifications = async () => {
      try {
        const res = await fetch("/api/maintenance/tasks?page=1&pageSize=5&status=OVERDUE", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { items: PendingTask[] };
        setPendingTasks(data.items || []);
      } catch {
        setPendingTasks([]);
      }
    };
    void loadNotifications();
  }, []);

  useEffect(() => {
    const query = globalQ.trim();
    if (query.length < 2) {
      setSearchHits([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const [plansRes, tasksRes, failuresRes, ordersRes] = await Promise.all([
          fetch(`/api/maintenance/plans?q=${encodeURIComponent(query)}&page=1&pageSize=3`, { cache: "no-store" }),
          fetch(`/api/maintenance/tasks?q=${encodeURIComponent(query)}&page=1&pageSize=3`, { cache: "no-store" }),
          fetch(`/api/failures?q=${encodeURIComponent(query)}&page=1&pageSize=3`, { cache: "no-store" }),
          fetch(`/api/maintenance/work-orders?q=${encodeURIComponent(query)}&page=1&pageSize=3`, { cache: "no-store" })
        ]);

        const hits: QuickHit[] = [];

        if (plansRes.ok) {
          const data = (await plansRes.json()) as { items?: Array<{ equipmentId: string; equipmentCode?: string | null; equipmentName?: string | null }> };
          for (const item of data.items || []) {
            hits.push({
              id: `plan-${item.equipmentId}`,
              title: item.equipmentName || item.equipmentCode || item.equipmentId,
              subtitle: "План ППР",
              href: "/ppr-plans"
            });
          }
        }

        if (tasksRes.ok) {
          const data = (await tasksRes.json()) as { items?: Array<{ id: string; equipmentId: string; maintenanceType: string }> };
          for (const item of data.items || []) {
            hits.push({
              id: `task-${item.id}`,
              title: `${item.maintenanceType} · ${item.equipmentId}`,
              subtitle: "Операция",
              href: "/operations"
            });
          }
        }

        if (failuresRes.ok) {
          const data = (await failuresRes.json()) as { items?: Array<{ id: string; equipmentName?: string | null; symptom: string }> };
          for (const item of data.items || []) {
            hits.push({
              id: `failure-${item.id}`,
              title: item.equipmentName || item.id,
              subtitle: `Отказ: ${item.symptom}`,
              href: "/failures"
            });
          }
        }

        if (ordersRes.ok) {
          const data = (await ordersRes.json()) as { items?: Array<{ id: string; title: string; equipmentId: string }> };
          for (const item of data.items || []) {
            hits.push({
              id: `wo-${item.id}`,
              title: item.title,
              subtitle: `Наряд · ${item.equipmentId}`,
              href: "/work-orders"
            });
          }
        }

        setSearchHits(hits.slice(0, 10));
      } catch {
        setSearchHits([]);
      } finally {
        setSearchLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [globalQ]);

  const uniqueHits = useMemo(() => {
    const map = new Map<string, QuickHit>();
    for (const hit of searchHits) map.set(hit.id, hit);
    return Array.from(map.values());
  }, [searchHits]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            data-global-search="true"
            value={globalQ}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
            onChange={(e) => setGlobalQ(e.target.value)}
            placeholder="Глобальный поиск: оборудование, наряды, отказы"
            className="h-10 w-full rounded-md border border-input bg-white pl-9 pr-3 text-sm"
          />
          {searchOpen ? (
            <div className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-md border border-border bg-card p-2 shadow-lg">
              {searchLoading ? <p className="px-2 py-1 text-xs text-muted-foreground">Поиск...</p> : null}
              {!searchLoading && uniqueHits.length === 0 ? <p className="px-2 py-1 text-xs text-muted-foreground">Ничего не найдено</p> : null}
              {!searchLoading && uniqueHits.length > 0 ? (
                <div className="space-y-1">
                  {uniqueHits.map((hit) => (
                    <Link key={hit.id} href={hit.href} className="block rounded px-2 py-1.5 hover:bg-muted" onClick={() => setSearchOpen(false)}>
                      <p className="text-sm font-medium">{hit.title}</p>
                      <p className="text-xs text-muted-foreground">{hit.subtitle}</p>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant={compact ? "default" : "outline"}
            size="sm"
            className="h-9 gap-2"
            onClick={() => {
              const next = !compact;
              setCompact(next);
              setCompactUi(next);
              notifySuccess(next ? "Компактный режим включен" : "Компактный режим выключен");
            }}
          >
            <Rows3 className="h-4 w-4" />
            Compact
          </Button>

          <div className="hidden items-center gap-2 md:flex">
            {user?.roles?.map((role) => (
              <Badge key={role} className="border-0 bg-primary/10 text-primary">
                {role}
              </Badge>
            ))}
            <span className="text-sm text-muted-foreground">{user?.email}</span>
          </div>

          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => {
                setShowNotifications((prev) => !prev);
                setShowProfile(false);
              }}
            >
              {pendingTasks.length > 0 ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-status-warning" /> : null}
              <Bell className="h-5 w-5 text-muted-foreground" />
            </Button>
            {showNotifications ? (
              <div className="absolute right-0 top-11 z-50 w-96 rounded-md border border-border bg-card p-3 shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Просроченные работы</p>
                  <Badge className="border-0 bg-status-warning/20 text-status-warning">{pendingTasks.length}</Badge>
                </div>
                {pendingTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Просроченных работ нет.</p>
                ) : (
                  <div className="space-y-2">
                    {pendingTasks.map((item) => (
                      <div key={item.id} className="rounded border border-border p-2">
                        <p className="font-mono text-xs text-primary">{item.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          Оборудование: {item.equipmentId}, дата: {new Date(item.scheduledDate).toLocaleDateString("ru-RU")}
                        </p>
                      </div>
                    ))}
                    <Link href="/operations" className="block pt-1 text-xs text-primary hover:underline">
                      Перейти к операциям
                    </Link>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => {
                setShowProfile((prev) => !prev);
                setShowNotifications(false);
              }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                <User className="h-5 w-5 text-primary" />
              </div>
            </Button>
            {showProfile ? (
              <div className="absolute right-0 top-11 z-50 w-80 rounded-md border border-border bg-card p-3 shadow-lg">
                <p className="text-sm font-semibold">Профиль</p>
                <p className="mt-1 text-xs text-muted-foreground">{user?.email}</p>
                <div className="mt-3 space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => void logout()}>
                    <LogOut className="h-4 w-4" />
                    Выйти
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
