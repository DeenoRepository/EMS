"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";

type SummaryResponse = {
  plans: { total: number; active: number; paused: number; archived: number };
  tasks: { total: number; planned: number; inProgress: number; completed: number; overdue: number };
  upcomingTasks: Array<{ id: string; equipmentId: string; scheduledDate: string; maintenanceType: string; status: string }>;
  overdueTasks: Array<{ id: string; equipmentId: string; scheduledDate: string; maintenanceType: string; status: string }>;
};

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU");
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/ppr/summary", { cache: "no-store" });
      if (!res.ok) {
        setError("Не удалось загрузить сводку ТОиР");
        return;
      }
      setSummary((await res.json()) as SummaryResponse);
    } catch {
      setError("Сетевая ошибка при загрузке сводки ТОиР");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const completionRate = useMemo(() => {
    if (!summary?.tasks.total) return 0;
    return Math.round((summary.tasks.completed / summary.tasks.total) * 100);
  }, [summary]);

  if (loading) return <LoadingState text="Загрузка панели ТОиР..." />;
  if (error) return <ErrorState text={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: "Панель ТОиР" }]} />
          <h1 className="mt-4 text-3xl font-bold">Операционный центр ТОиР</h1>
          <p className="mt-1 text-muted-foreground">Планирование, контроль исполнения и управление рисками в одном окне.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/ppr-plans">
            <Button variant="outline">Планы ППР</Button>
          </Link>
          <Link href="/operations">
            <Button variant="outline">Операции</Button>
          </Link>
          <Link href="/work-orders">
            <Button variant="outline">Наряды</Button>
          </Link>
          <Link href="/schedule">
            <Button variant="outline">График</Button>
          </Link>
          <Link href="/failures">
            <Button>Отказы и RCA</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Планы ППР" value={summary?.plans.total || 0} hint={`Активные: ${summary?.plans.active || 0}`} />
        <KpiCard label="Операции" value={summary?.tasks.total || 0} hint={`В работе: ${summary?.tasks.inProgress || 0}`} />
        <KpiCard label="Выполнено" value={summary?.tasks.completed || 0} tone="positive" hint="Завершенные задачи" />
        <KpiCard label="Просрочено" value={summary?.tasks.overdue || 0} tone="critical" hint="Требует внимания" />
        <KpiCard label="Планируется" value={summary?.tasks.planned || 0} tone="warning" hint="Ожидают исполнения" />
        <KpiCard label="Исполнение" value={`${completionRate}%`} hint="Доля выполненных операций" />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Зона контроля смены</h2>
            <p className="text-sm text-muted-foreground">Приоритетные задачи на ближайшие 14 дней и просроченные работы.</p>
          </div>
          <Button variant="outline" onClick={() => void load()}>Обновить данные</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-border p-4">
            <h3 className="text-lg font-semibold">Просроченные операции</h3>
          </div>
          {!summary?.overdueTasks.length ? (
            <div className="p-4">
              <EmptyState text="Просроченных операций нет." />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {summary.overdueTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{task.equipmentId}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.maintenanceType} • {fmtDate(task.scheduledDate)}
                    </p>
                  </div>
                  <StatusBadge status={task.status} group="task" />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-4">
            <h3 className="text-lg font-semibold">Ближайшие работы</h3>
          </div>
          {!summary?.upcomingTasks.length ? (
            <div className="p-4">
              <EmptyState text="Ближайших работ не найдено." />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {summary.upcomingTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{task.equipmentId}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.maintenanceType} • {fmtDate(task.scheduledDate)}
                    </p>
                  </div>
                  <StatusBadge status={task.status} group="task" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
