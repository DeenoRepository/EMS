"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";

type Summary = {
  total_items: number;
  active_items: number;
  active_warehouses: number;
  factual_positions: number;
  factual_balance_rows: number;
  total_available_quantity: number;
  low_stock_items: number;
  active_reservations: number;
  active_reserved_quantity: number;
  movements_period_count: number;
};

type LowStock = { items: Array<{ item_id: string; sku: string; name: string; available_quantity: number; min_quantity: number | null; warehouse_name: string }> };
type Movements = { items: Array<{ id: string; movementType: string; quantity: number; createdAt: string; item?: { name: string; sku: string } }> };
type Reservations = { items: Array<{ id: string; createdAt: string; status: "ACTIVE" | "ISSUED" | "CANCELLED"; item?: { name: string; sku: string } }> };

export default function WmsDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [low, setLow] = useState<LowStock>({ items: [] });
  const [movements, setMovements] = useState<Movements>({ items: [] });
  const [reservations, setReservations] = useState<Reservations>({ items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, l, m, r] = await Promise.all([
        fetch("/api/wms/analytics/summary", { cache: "no-store" }),
        fetch("/api/wms/analytics/low-stock", { cache: "no-store" }),
        fetch("/api/wms/movements?page=1&pageSize=10", { cache: "no-store" }),
        fetch("/api/wms/reservations?page=1&pageSize=5&status=ACTIVE", { cache: "no-store" })
      ]);

      if (!s.ok) {
        setError("Не удалось загрузить dashboard WMS");
        return;
      }

      setSummary((await s.json()) as Summary);
      if (l.ok) setLow((await l.json()) as LowStock);
      if (m.ok) setMovements((await m.json()) as Movements);
      if (r.ok) setReservations((await r.json()) as Reservations);
    } catch {
      setError("Сетевая ошибка загрузки WMS dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (loading) return <LoadingState text="Загрузка WMS dashboard..." />;
  if (error) return <ErrorState text={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: "WMS" }]} />
          <h1 className="mt-4 text-3xl font-bold">Панель управления</h1>
          <p className="mt-1 text-muted-foreground">Операционная сводка склада и быстрый переход к ключевым действиям.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Активные склады" value={summary?.active_warehouses || 0} hint="Площадки в работе" />
        <KpiCard label="Активные позиции" value={summary?.active_items || 0} hint={`Всего в справочнике: ${summary?.total_items || 0}`} />
        <KpiCard label="Позиции в наличии" value={summary?.factual_positions || 0} tone="positive" hint={`Доступно к использованию: ${summary?.total_available_quantity || 0}`} />
        <KpiCard label="Низкий остаток" value={summary?.low_stock_items || 0} tone="warning" hint="Требуют пополнения" />
        <KpiCard label="Активные резервы" value={summary?.active_reservations || 0} tone="critical" hint={`Зарезервировано: ${summary?.active_reserved_quantity || 0}`} />
        <KpiCard label="Движений (30д)" value={summary?.movements_period_count || 0} hint="Интенсивность операций" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Требует внимания</h2>
            <Link href="/wms/analytics" className="text-sm text-primary hover:underline">Открыть аналитику</Link>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded border border-border p-2">Low stock позиций: <span className="font-semibold">{summary?.low_stock_items || 0}</span></div>
            <div className="rounded border border-border p-2">Активных резервов: <span className="font-semibold">{summary?.active_reservations || 0}</span></div>
            {reservations.items.map((row) => (
              <div key={row.id} className="rounded border border-border p-2">
                <p className="font-medium">{row.item?.sku || "-"} | {row.item?.name || "-"}</p>
                <p className="text-xs text-muted-foreground">В работе с {new Date(row.createdAt).toLocaleString("ru-RU")}</p>
              </div>
            ))}
            {reservations.items.length === 0 ? <p className="text-sm text-muted-foreground">Критичных резервов нет.</p> : null}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Позиции ниже минимального остатка</h2>
            <Link href="/wms/balances" className="text-sm text-primary hover:underline">Открыть остатки</Link>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {low.items.slice(0, 8).map((row) => (
              <div key={`${row.item_id}-${row.warehouse_name}`} className="flex items-center justify-between rounded border border-border p-2">
                <div>
                  <p className="font-medium">{row.sku} | {row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.warehouse_name}</p>
                </div>
                <p className="font-semibold text-status-warning">{row.available_quantity} / мин {row.min_quantity ?? "-"}</p>
              </div>
            ))}
            {low.items.length === 0 ? <p className="text-sm text-muted-foreground">Нет позиций в low stock.</p> : null}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Последние движения</h2>
            <Link href="/wms/movements" className="text-sm text-primary hover:underline">Открыть журнал</Link>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {movements.items.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded border border-border p-2">
                <div>
                  <p className="font-medium">{row.item?.sku || "-"} | {row.item?.name || "-"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString("ru-RU")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge group="wms_movement" status={row.movementType} />
                  <p className="font-semibold">{row.quantity}</p>
                </div>
              </div>
            ))}
            {movements.items.length === 0 ? <p className="text-sm text-muted-foreground">Движений пока нет.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
