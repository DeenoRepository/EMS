"use client";

import { Bell, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import Link from "next/link";
import { notifyError, notifySuccess } from "@/lib/client/notify";

type ActiveReservation = {
  id: string;
  mms_work_order_id: string;
  quantity: number;
};
type InternalRequestNotice = { id: string; number: string; status: string };

export function TopBar() {
  const { user } = useCurrentUser();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activeReservations, setActiveReservations] = useState<ActiveReservation[]>([]);
  const [requestNotices, setRequestNotices] = useState<InternalRequestNotice[]>([]);

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
    const loadNotifications = async () => {
      try {
        const res = await fetch("/api/wms/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { active_reservations: ActiveReservation[]; internal_requests: InternalRequestNotice[] };
        setActiveReservations(data.active_reservations || []);
        setRequestNotices(data.internal_requests || []);
      } catch {
        setActiveReservations([]);
        setRequestNotices([]);
      }
    };
    void loadNotifications();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="flex items-center justify-end px-6 py-4">
        <div className="flex items-center gap-4">
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
              {activeReservations.length + requestNotices.length > 0 ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-status-warning" /> : null}
              <Bell className="h-5 w-5 text-muted-foreground" />
            </Button>
            {showNotifications ? (
              <div className="absolute right-0 top-11 z-50 w-96 rounded-md border border-border bg-card p-3 shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Уведомления</p>
                  <Badge className="border-0 bg-status-warning/20 text-status-warning">{activeReservations.length + requestNotices.length}</Badge>
                </div>
                {activeReservations.length === 0 && requestNotices.length === 0 ? <p className="text-xs text-muted-foreground">Новых событий нет.</p> : (
                  <div className="space-y-3">
                    {requestNotices.map((item) => (
                      <div key={item.id} className="rounded border border-border p-2">
                        <p className="font-mono text-xs text-primary">{item.number}</p>
                        <p className="text-xs text-muted-foreground">Заявка в работе: {item.status}</p>
                      </div>
                    ))}
                    {activeReservations.map((item) => (
                      <div key={item.id} className="rounded border border-border p-2">
                        <p className="font-mono text-xs text-primary">{item.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          Заявка MMS: {item.mms_work_order_id}, количество: {item.quantity}
                        </p>
                      </div>
                    ))}
                    <Link href="/wms/reservations" className="block pt-1 text-xs text-primary hover:underline">
                      Перейти к резервам
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
