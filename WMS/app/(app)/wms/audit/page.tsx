"use client";

import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useWmsScope } from "@/lib/client/use-wms-scope";

type AuditEntry = {
  id: string;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: unknown;
  createdAt: string;
};
type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

export default function WmsAuditPage() {
  const { scope } = useWmsScope();
  const canUse = scope?.access === "ADMIN" || scope?.access === "CENTRAL";
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityType, setEntityType] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const load = async () => {
    if (!canUse) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (entityType.trim()) q.set("entityType", entityType.trim());
      if (actorEmail.trim()) q.set("actorEmail", actorEmail.trim());
      const res = await fetch(`/api/wms/audit?${q.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Не удалось загрузить журнал аудита.");
        return;
      }
      const data = (await res.json()) as Paged<AuditEntry>;
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setError("Сетевая ошибка загрузки журнала аудита.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [canUse, page, entityType, actorEmail]);

  const stats = useMemo(
    () => ({
      total,
      users: new Set(items.map((x) => x.actorEmail || "system")).size,
      updates: items.filter((x) => x.action === "UPDATE").length
    }),
    [items, total]
  );

  if (!canUse) return <ErrorState text="Раздел «Аудит» доступен только центральному складу и администратору." />;
  if (loading && items.length === 0) return <LoadingState text="Загрузка журнала аудита..." />;
  if (error && items.length === 0) return <ErrorState text={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6 p-6">
      <div>
        <Breadcrumbs items={[{ label: "WMS", href: "/wms" }, { label: "Аудит" }]} />
        <h1 className="mt-4 text-3xl font-bold">Журнал аудита</h1>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Всего записей</p><p className="mt-2 text-2xl font-semibold">{stats.total}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Пользователи (страница)</p><p className="mt-2 text-2xl font-semibold">{stats.users}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Изменения (страница)</p><p className="mt-2 text-2xl font-semibold">{stats.updates}</p></Card>
      </div>

      <Card className="space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input placeholder="Тип сущности (например WMS_SETTINGS)" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} />
          <Input placeholder="Пользователь (email)" value={actorEmail} onChange={(e) => { setActorEmail(e.target.value); setPage(1); }} />
          <AppSelect value={String(pageSize)} disabled>
            <option value="20">20 строк</option>
          </AppSelect>
          <Button variant="outline" onClick={() => void load()}>Обновить</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left">Дата</th>
                <th className="px-4 py-3 text-left">Пользователь</th>
                <th className="px-4 py-3 text-left">Действие</th>
                <th className="px-4 py-3 text-left">Сущность</th>
                <th className="px-4 py-3 text-left">Метаданные</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3">{new Date(entry.createdAt).toLocaleString("ru-RU")}</td>
                  <td className="px-4 py-3">{entry.actorEmail || "система"}</td>
                  <td className="px-4 py-3">{entry.action}</td>
                  <td className="px-4 py-3">{entry.entityType}:{entry.entityId}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <code>{entry.metadata ? `${JSON.stringify(entry.metadata).slice(0, 120)}${JSON.stringify(entry.metadata).length > 120 ? "..." : ""}` : "-"}</code>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? <tr><td className="px-4 py-4 text-muted-foreground" colSpan={5}>Записей не найдено.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Страница {page} из {pageCount}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Назад</Button>
          <Button variant="outline" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Вперед</Button>
        </div>
      </div>
    </div>
  );
}
