"use client";

import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";

type PprSummary = {
  plans: { total: number; active: number; paused: number; archived: number };
  tasks: { total: number; planned: number; inProgress: number; completed: number; overdue: number };
  byMaintenanceType: Array<{ maintenanceType: string; count: number }>;
  byMonth: Array<{ month: string; planned: number; completed: number }>;
};

type FailureSummary = {
  total: number;
  openRca: number;
  inProgressRca: number;
  critical: number;
  totalDowntime: number;
  avgDowntime: number;
  byCause: Array<{ cause: string; count: number }>;
  bySeverity: Array<{ severity: string; count: number }>;
  trendByMonth: Array<{ month: string; count: number }>;
};

type OpsSummary = {
  kpi: {
    mtbfHours: number;
    mttrHours: number;
    activeWorkOrders: number;
    overdueTasks: number;
    downtimeMinutes: number;
    totalRepairCost: number;
  };
  sla: {
    completedWithinSla: number;
    completedOverSla: number;
  };
  recurringFailures: Array<{ equipmentId: string; failures: number }>;
};

function MiniBarList({
  items,
  colorClass
}: {
  items: Array<{ label: string; value: number }>;
  colorClass: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const width = Math.max(4, Math.round((item.value / max) * 100));
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate text-muted-foreground">{item.label}</span>
              <span className="font-semibold">{item.value}</span>
            </div>
            <div className="h-2 rounded bg-muted/70">
              <div className={`h-2 rounded ${colorClass}`} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompactTrend({
  items,
  colorClass
}: {
  items: Array<{ label: string; value: number }>;
  colorClass: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="flex items-end gap-1">
      {items.map((item) => {
        const height = Math.max(8, Math.round((item.value / max) * 56));
        return (
          <div key={item.label} className="group flex w-full flex-col items-center">
            <div className={`w-full rounded-t ${colorClass}`} style={{ height }} title={`${item.label}: ${item.value}`} />
            <span className="mt-1 text-[10px] text-muted-foreground">{item.label.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const [pprSummary, setPprSummary] = useState<PprSummary | null>(null);
  const [failureSummary, setFailureSummary] = useState<FailureSummary | null>(null);
  const [opsSummary, setOpsSummary] = useState<OpsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pprRes, failureRes, opsRes] = await Promise.all([
        fetch("/api/analytics/ppr/summary", { cache: "no-store" }),
        fetch("/api/analytics/failures/summary", { cache: "no-store" }),
        fetch("/api/analytics/ops/summary", { cache: "no-store" })
      ]);

      if (!pprRes.ok) {
        setError("Не удалось загрузить аналитику ППР");
        return;
      }

      setPprSummary((await pprRes.json()) as PprSummary);
      if (failureRes.ok) {
        setFailureSummary((await failureRes.json()) as FailureSummary);
      } else {
        setFailureSummary(null);
      }
      if (opsRes.ok) {
        setOpsSummary((await opsRes.json()) as OpsSummary);
      } else {
        setOpsSummary(null);
      }
    } catch {
      setError("Сетевая ошибка при загрузке аналитики");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const executionRate = useMemo(() => {
    if (!pprSummary?.tasks.total) return 0;
    return Math.round((pprSummary.tasks.completed / pprSummary.tasks.total) * 100);
  }, [pprSummary]);

  const pprTrend = useMemo(() => {
    return (pprSummary?.byMonth || []).map((item) => ({ label: item.month, value: item.completed }));
  }, [pprSummary]);

  const failureTrend = useMemo(() => {
    return (failureSummary?.trendByMonth || []).slice(-8).map((item) => ({ label: item.month, value: item.count }));
  }, [failureSummary]);

  const maintenanceBars = useMemo(
    () => (pprSummary?.byMaintenanceType || []).map((item) => ({ label: item.maintenanceType, value: item.count })),
    [pprSummary]
  );

  const causeBars = useMemo(
    () => (failureSummary?.byCause || []).slice(0, 6).map((item) => ({ label: item.cause, value: item.count })),
    [failureSummary]
  );

  if (loading) return <LoadingState text="Загрузка аналитики..." />;
  if (error) return <ErrorState text={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6 p-6">
      <div>
        <Breadcrumbs items={[{ label: "Аналитика" }]} />
        <h1 className="mt-4 text-3xl font-bold">Управленческая аналитика ТОиР</h1>
        <p className="mt-1 text-muted-foreground">Компактные графики KPI ППР и надежности оборудования.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Планы ППР" value={pprSummary?.plans.total || 0} hint={`ACTIVE: ${pprSummary?.plans.active || 0}`} />
        <KpiCard label="Операции" value={pprSummary?.tasks.total || 0} hint={`В работе: ${pprSummary?.tasks.inProgress || 0}`} />
        <KpiCard label="Исполнение" value={`${executionRate}%`} tone={executionRate >= 85 ? "positive" : "warning"} hint="Доля завершенных работ" />
        <KpiCard label="Просрочено" value={pprSummary?.tasks.overdue || 0} tone="critical" hint="SLA под риском" />
        <KpiCard label="RCA open" value={failureSummary?.openRca || 0} tone="critical" hint="Открытые расследования" />
        <KpiCard label="Простой (мин)" value={failureSummary?.totalDowntime || 0} hint={`Средний: ${failureSummary?.avgDowntime || 0}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="MTBF (ч)" value={opsSummary?.kpi.mtbfHours || 0} hint="Среднее время между отказами" />
        <KpiCard label="MTTR (ч)" value={opsSummary?.kpi.mttrHours || 0} hint="Среднее время восстановления" />
        <KpiCard label="Активные WO" value={opsSummary?.kpi.activeWorkOrders || 0} tone="warning" />
        <KpiCard label="Затраты ремонтов" value={opsSummary?.kpi.totalRepairCost || 0} hint="Фактовые затраты" />
        <KpiCard
          label="SLA выполнено"
          value={`${opsSummary ? Math.round((opsSummary.sla.completedWithinSla / Math.max(1, opsSummary.sla.completedWithinSla + opsSummary.sla.completedOverSla)) * 100) : 0}%`}
          hint="Доля в срок"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="p-4">
          <h2 className="text-lg font-semibold">Статусы операций</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">PLANNED</span><span className="font-semibold">{pprSummary?.tasks.planned || 0}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">IN_PROGRESS</span><span className="font-semibold">{pprSummary?.tasks.inProgress || 0}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">COMPLETED</span><span className="font-semibold text-status-success">{pprSummary?.tasks.completed || 0}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">OVERDUE</span><span className="font-semibold text-status-error">{pprSummary?.tasks.overdue || 0}</span></div>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold">Типы ППР (мини-график)</h2>
          <div className="mt-3">
            <MiniBarList items={maintenanceBars} colorClass="bg-status-info/80" />
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold">RCA и критичность</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status="OPEN" group="rca" />
            <span className="text-sm">{failureSummary?.openRca || 0}</span>
            <StatusBadge status="IN_PROGRESS" group="rca" />
            <span className="text-sm">{failureSummary?.inProgressRca || 0}</span>
            <StatusBadge status="CRITICAL" group="severity" />
            <span className="text-sm">{failureSummary?.critical || 0}</span>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">Контроль активных расследований и критичных инцидентов.</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-lg font-semibold">Тренд выполнения ППР</h2>
          <p className="text-xs text-muted-foreground">Завершенные операции по месяцам</p>
          <div className="mt-4 h-20">
            {pprTrend.length ? <CompactTrend items={pprTrend} colorClass="bg-status-success/80" /> : <p className="text-sm text-muted-foreground">Нет данных.</p>}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold">Тренд отказов</h2>
          <p className="text-xs text-muted-foreground">Количество отказов по месяцам</p>
          <div className="mt-4 h-20">
            {failureTrend.length ? <CompactTrend items={failureTrend} colorClass="bg-status-error/80" /> : <p className="text-sm text-muted-foreground">Нет данных.</p>}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="text-lg font-semibold">Топ причин отказов (мини-график)</h2>
        <div className="mt-3">
          {causeBars.length ? <MiniBarList items={causeBars} colorClass="bg-status-warning/80" /> : <p className="text-sm text-muted-foreground">Нет данных по отказам.</p>}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-semibold">Повторные отказы (топ)</h2>
        <div className="mt-3 space-y-2">
          {(opsSummary?.recurringFailures || []).map((item) => (
            <div key={item.equipmentId} className="flex items-center justify-between text-sm">
              <span className="font-mono">{item.equipmentId}</span>
              <span className="font-semibold">{item.failures}</span>
            </div>
          ))}
          {!opsSummary?.recurringFailures?.length ? <p className="text-sm text-muted-foreground">Нет данных.</p> : null}
        </div>
      </Card>
    </div>
  );
}
