"use client";

import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { AppSelect } from "@/components/ui/app-select";
import { FilterPanel } from "@/components/ui/filter-panel";

type Summary = {
  total_items: number;
  active_items: number;
  active_warehouses: number;
  low_stock_items: number;
  active_reservations: number;
  active_reserved_quantity: number;
  movements_period_count: number;
};

type Usage = { items: Array<{ item_id: string; sku: string; name: string; issue_count: number; issued_quantity: number }> };
type Trend = { items: Array<{ date: string; issue: number; receipt: number; transfer: number; adjustment: number }> };
type Sla = { target_hours: number; total: number; overdue: number; fulfilled: number };
type Policy = { central_issue_items: number; distributed_consumables_items: number; issued_quantity_central_policy: number; issued_quantity_consumables: number };

function MiniBar({ value, max, tone = "bg-primary" }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-24 rounded bg-muted">
      <div className={`h-2 rounded ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function WmsAnalyticsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [usage, setUsage] = useState<Usage>({ items: [] });
  const [trend, setTrend] = useState<Trend>({ items: [] });
  const [sla, setSla] = useState<Sla | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [days, setDays] = useState("30");

  const maxUsage = useMemo(() => usage.items.reduce((m, x) => Math.max(m, x.issued_quantity), 0), [usage.items]);
  const slaRiskRate = useMemo(() => {
    if (!sla || sla.total <= 0) return 0;
    return Math.round((sla.overdue / sla.total) * 100);
  }, [sla]);

  const load = async () => {
    const [s, u, t, sl, pm] = await Promise.all([
      fetch("/api/wms/analytics/summary", { cache: "no-store" }),
      fetch(`/api/wms/analytics/usage-by-item?days=${days}`, { cache: "no-store" }),
      fetch(`/api/wms/analytics/movements?days=${days}`, { cache: "no-store" }),
      fetch("/api/wms/internal-requests/sla?targetHours=24", { cache: "no-store" }),
      fetch("/api/wms/reports/policy-metrics", { cache: "no-store" })
    ]);
    if (s.ok) setSummary(await s.json());
    if (u.ok) setUsage(await u.json());
    if (t.ok) setTrend(await t.json());
    if (sl.ok) setSla(await sl.json());
    if (pm.ok) setPolicy(await pm.json());
  };

  useEffect(() => { void load(); }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: "WMS", href: "/wms" }, { label: "Аналитика" }]} />
          <h1 className="mt-4 text-3xl font-bold">Аналитика WMS</h1>
        </div>
        <div className="w-72">
          <FilterPanel title="Период отчета">
            <AppSelect value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="7">Период: 7 дней</option>
              <option value="30">Период: 30 дней</option>
              <option value="90">Период: 90 дней</option>
            </AppSelect>
          </FilterPanel>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Активные склады" value={summary?.active_warehouses || 0} />
        <KpiCard label="Активные позиции" value={summary?.active_items || 0} />
        <KpiCard label="Низкий остаток" value={summary?.low_stock_items || 0} tone="warning" />
        <KpiCard label="Активные резервы" value={summary?.active_reservations || 0} tone="critical" />
        <KpiCard label={`Движений (${days}д)`} value={summary?.movements_period_count || 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="SLA просрочено" value={sla?.overdue || 0} tone="warning" />
        <KpiCard label="SLA выполнено" value={sla?.fulfilled || 0} tone="positive" />
        <KpiCard label="Центр. политика (шт)" value={policy?.issued_quantity_central_policy || 0} />
        <KpiCard label="Расходники (шт)" value={policy?.issued_quantity_consumables || 0} />
      </div>
      <Card className="p-4">
        <h2 className="text-lg font-semibold">Управленческий риск-блок</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
          <div className="rounded border border-border p-3">Доля просрочки SLA: <span className="font-semibold">{slaRiskRate}%</span></div>
          <div className="rounded border border-border p-3">Активные заявки SLA: <span className="font-semibold">{sla?.total || 0}</span></div>
          <div className="rounded border border-border p-3">Резервов в работе: <span className="font-semibold">{summary?.active_reservations || 0}</span></div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-lg font-semibold">Топ выдаваемых позиций</h2>
          <div className="mt-3 space-y-2 text-sm">
            {usage.items.slice(0, 10).map((row) => (
              <div key={row.item_id} className="flex items-center justify-between gap-3 rounded border border-border p-2">
                <div className="min-w-0">
                  <p className="truncate">{row.sku} | {row.name}</p>
                  <p className="text-xs text-muted-foreground">Выдач: {row.issue_count}</p>
                </div>
                <div className="flex items-center gap-2">
                  <MiniBar value={row.issued_quantity} max={maxUsage} />
                  <p className="w-16 text-right font-semibold">{row.issued_quantity}</p>
                </div>
              </div>
            ))}
            {usage.items.length === 0 ? <p className="text-sm text-muted-foreground">Нет данных.</p> : null}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold">Движения по дням</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left">Дата</th>
                  <th className="px-3 py-2 text-left">Приход</th>
                  <th className="px-3 py-2 text-left">Выдача</th>
                  <th className="px-3 py-2 text-left">Перемещ.</th>
                  <th className="px-3 py-2 text-left">Корр.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {trend.items.map((row) => (
                  <tr key={row.date}>
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2">{row.receipt}</td>
                    <td className="px-3 py-2">{row.issue}</td>
                    <td className="px-3 py-2">{row.transfer}</td>
                    <td className="px-3 py-2">{row.adjustment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
