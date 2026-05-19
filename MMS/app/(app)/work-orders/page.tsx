"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DetailsDrawer } from "@/components/ui/details-drawer";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { notifyError, notifySuccess } from "@/lib/client/notify";
import { clearDraft, useDraftState } from "@/lib/client/use-draft";

type WorkOrder = {
  id: string;
  equipmentId: string;
  title: string;
  type: "PLANNED" | "CORRECTIVE" | "EMERGENCY";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "NEW" | "APPROVED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELED";
  assignedTo?: string | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
};

type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

export default function WorkOrdersPage() {
  const [items, setItems] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [creating, setCreating] = useState(false);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);

  const [form, setForm] = useState({
    equipmentId: "",
    title: "",
    type: "CORRECTIVE",
    priority: "MEDIUM",
    assignedTo: "",
    plannedStartAt: "",
    plannedEndAt: ""
  });
  useDraftState("mms:draft:work-order", form, setForm);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const drawerOrder = items.find((item) => item.id === drawerOrderId) || null;
  const stats = useMemo(
    () => ({
      active: items.filter((x) => ["NEW", "APPROVED", "IN_PROGRESS", "ON_HOLD"].includes(x.status)).length,
      critical: items.filter((x) => x.priority === "CRITICAL").length,
      completed: items.filter((x) => x.status === "COMPLETED").length
    }),
    [items]
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), q });
      if (status !== "all") params.set("status", status);
      if (priority !== "all") params.set("priority", priority);
      const res = await fetch(`/api/maintenance/work-orders?${params.toString()}`);
      if (!res.ok) {
        setError("Не удалось загрузить наряды");
        return;
      }
      const data = (await res.json()) as Paged<WorkOrder>;
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setError("Сетевая ошибка при загрузке нарядов");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [q, status, priority, page, pageSize]);

  const createOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.equipmentId.trim() || !form.title.trim()) {
      notifyError("Укажите equipmentId и заголовок");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/maintenance/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipmentId: form.equipmentId.trim(),
          title: form.title.trim(),
          type: form.type,
          priority: form.priority,
          assignedTo: form.assignedTo || undefined,
          plannedStartAt: form.plannedStartAt || undefined,
          plannedEndAt: form.plannedEndAt || undefined
        })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        notifyError(data.error || "Не удалось создать наряд");
        return;
      }
      notifySuccess("Наряд создан");
      setForm({ equipmentId: "", title: "", type: "CORRECTIVE", priority: "MEDIUM", assignedTo: "", plannedStartAt: "", plannedEndAt: "" });
      clearDraft("mms:draft:work-order");
      setPage(1);
      await load();
    } catch {
      notifyError("Сетевая ошибка при создании наряда");
    } finally {
      setCreating(false);
    }
  };

  const quickStatus = async (id: string, nextStatus: WorkOrder["status"]) => {
    const res = await fetch(`/api/maintenance/work-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      notifyError(data.error || "Не удалось обновить статус");
      return;
    }
    notifySuccess("Статус обновлен");
    await load();
  };

  const fmt = (value?: string | null) => (value ? new Date(value).toLocaleString("ru-RU") : "-");

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Наряды ТОиР" }]} />
        <h1 className="mt-4 text-3xl font-bold">Work Orders и SLA</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Наряды на странице" value={items.length} hint={`Всего: ${total}`} />
        <KpiCard label="Активные" value={stats.active} tone="warning" />
        <KpiCard label="Critical" value={stats.critical} tone="critical" />
        <KpiCard label="Completed" value={stats.completed} tone="positive" />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Новый наряд</h2>
        <form className="grid grid-cols-1 gap-3 md:grid-cols-4" onSubmit={(e) => void createOrder(e)}>
          <Input placeholder="equipmentId" value={form.equipmentId} onChange={(e) => setForm((p) => ({ ...p, equipmentId: e.target.value }))} />
          <Input placeholder="Заголовок работ" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <AppSelect value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
            <option value="PLANNED">PLANNED</option>
            <option value="CORRECTIVE">CORRECTIVE</option>
            <option value="EMERGENCY">EMERGENCY</option>
          </AppSelect>
          <AppSelect value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </AppSelect>
          <Input placeholder="Исполнитель" value={form.assignedTo} onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value }))} />
          <Input type="datetime-local" value={form.plannedStartAt} onChange={(e) => setForm((p) => ({ ...p, plannedStartAt: e.target.value }))} />
          <Input type="datetime-local" value={form.plannedEndAt} onChange={(e) => setForm((p) => ({ ...p, plannedEndAt: e.target.value }))} />
          <Button type="submit" disabled={creating}>{creating ? "Создание..." : "Создать"}</Button>
        </form>
      </Card>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <Input placeholder="Поиск..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <AppSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">Все статусы</option>
            <option value="NEW">NEW</option>
            <option value="APPROVED">APPROVED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="ON_HOLD">ON_HOLD</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELED">CANCELED</option>
          </AppSelect>
          <AppSelect value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
            <option value="all">Все приоритеты</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </AppSelect>
          <Button variant="outline" onClick={() => void load()}>Обновить</Button>
          <div className="flex items-center justify-end text-sm text-muted-foreground">Всего: {total}</div>
        </div>
      </Card>

      {loading ? <LoadingState text="Загрузка нарядов..." /> : null}
      {!loading && error ? <ErrorState text={error} onRetry={() => void load()} /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState text="Наряды не найдены." /> : null}
      {!loading && !error && items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Название</th>
                  <th className="px-4 py-3 text-left font-semibold">Оборудование</th>
                  <th className="px-4 py-3 text-left font-semibold">Приоритет</th>
                  <th className="px-4 py-3 text-left font-semibold">Статус</th>
                  <th className="px-4 py-3 text-left font-semibold">План</th>
                  <th className="px-4 py-3 text-left font-semibold">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDrawerOrderId(item.id)}>
                    <td className="px-4 py-3">{item.title}</td>
                    <td className="px-4 py-3 font-mono">{item.equipmentId}</td>
                    <td className="px-4 py-3"><StatusBadge status={item.priority} group="severity" /></td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} group="task" /></td>
                    <td className="px-4 py-3">{fmt(item.plannedStartAt)} - {fmt(item.plannedEndAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); void quickStatus(item.id, "IN_PROGRESS"); }}>В работу</Button>
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); void quickStatus(item.id, "COMPLETED"); }}>Закрыть</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
            label="Наряды"
          />
        </Card>
      ) : null}

      <DetailsDrawer open={Boolean(drawerOrder)} title="Детали наряда" onClose={() => setDrawerOrderId(null)}>
        {drawerOrder ? (
          <>
            <p><span className="text-muted-foreground">ID:</span> {drawerOrder.id}</p>
            <p><span className="text-muted-foreground">Название:</span> {drawerOrder.title}</p>
            <p><span className="text-muted-foreground">Оборудование:</span> {drawerOrder.equipmentId}</p>
            <p><span className="text-muted-foreground">Тип:</span> {drawerOrder.type}</p>
            <p><span className="text-muted-foreground">Приоритет:</span> {drawerOrder.priority}</p>
            <p><span className="text-muted-foreground">Статус:</span> {drawerOrder.status}</p>
            <p><span className="text-muted-foreground">Исполнитель:</span> {drawerOrder.assignedTo || "-"}</p>
          </>
        ) : null}
      </DetailsDrawer>
    </div>
  );
}
