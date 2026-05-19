"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { notifyError, notifySuccess } from "@/lib/client/notify";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";

type Reservation = {
  id: string;
  item?: { sku: string; name: string };
  warehouse?: { name: string };
  quantity: number;
  status: "ACTIVE" | "ISSUED" | "CANCELLED";
  mmsWorkOrderId: string;
  mmsRequiredPartId: string;
  createdAt: string;
};

type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };
type StockItem = { id: string; sku: string; name: string };
type Warehouse = { id: string; code: string; name: string };
type WarehousePolicy = { primary: { id: string; code: string; name: string } | null };
type WorkOrderSuggestion = { id?: string; code?: string; number?: string; title?: string };
type RequiredPartSuggestion = { id?: string; part_id?: string; code?: string; name?: string };

export default function ReservationsPage() {
  const [items, setItems] = useState<Reservation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState("all");
  const [workOrder, setWorkOrder] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [workOrderSuggestions, setWorkOrderSuggestions] = useState<WorkOrderSuggestion[]>([]);
  const [partSuggestions, setPartSuggestions] = useState<RequiredPartSuggestion[]>([]);
  const [policy, setPolicy] = useState<WarehousePolicy>({ primary: null });

  const [form, setForm] = useState({ itemId: "", warehouseId: "", mmsWorkOrderId: "", mmsRequiredPartId: "", quantity: "" });

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (status !== "all") params.set("status", status);
      if (workOrder) params.set("mmsWorkOrderId", workOrder);
      const res = await fetch(`/api/wms/reservations?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Не удалось загрузить резервы");
        setItems([]);
        setTotal(0);
        return;
      }
      const data = (await res.json()) as Paged<Reservation>;
      setItems(data.items || []);
      setTotal(data.total || 0);
      setSelectedIds([]);
    } catch {
      setError("Сетевая ошибка загрузки резервов");
    } finally {
      setLoading(false);
    }
  };

  const loadReferences = async () => {
    try {
      const [itemsRes, whRes] = await Promise.all([
        fetch("/api/wms/items?page=1&pageSize=200&status=ACTIVE", { cache: "no-store" }),
        fetch("/api/wms/warehouses?page=1&pageSize=200&status=ACTIVE", { cache: "no-store" })
      ]);
      if (itemsRes.ok) {
        const data = (await itemsRes.json()) as Paged<StockItem>;
        setStockItems(data.items || []);
      }
      if (whRes.ok) {
        const data = (await whRes.json()) as Paged<Warehouse>;
        setWarehouses(data.items || []);
      }
      const policyRes = await fetch("/api/wms/warehouses/policy", { cache: "no-store" });
      if (policyRes.ok) {
        setPolicy(await policyRes.json());
      }
    } catch {
      // no-op
    }
  };

  useEffect(() => { void load(); }, [page, pageSize, status, workOrder]);
  useEffect(() => { void loadReferences(); }, []);
  useEffect(() => {
    if (!form.warehouseId && policy.primary?.id) {
      setForm((p) => ({ ...p, warehouseId: policy.primary?.id || "" }));
    }
  }, [form.warehouseId, policy.primary?.id]);
  useEffect(() => {
    const run = async () => {
      const q = form.mmsWorkOrderId.trim();
      if (q.length < 2) return setWorkOrderSuggestions([]);
      const res = await fetch(`/api/wms/integrations/mms/work-orders?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (!res.ok) return setWorkOrderSuggestions([]);
      const data = await res.json();
      setWorkOrderSuggestions(Array.isArray(data.items) ? data.items.slice(0, 10) : []);
    };
    void run();
  }, [form.mmsWorkOrderId]);
  useEffect(() => {
    const run = async () => {
      const workOrderId = form.mmsWorkOrderId.trim();
      if (!workOrderId) return setPartSuggestions([]);
      const q = form.mmsRequiredPartId.trim();
      const res = await fetch(`/api/wms/integrations/mms/required-parts?workOrderId=${encodeURIComponent(workOrderId)}&q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (!res.ok) return setPartSuggestions([]);
      const data = await res.json();
      setPartSuggestions(Array.isArray(data.items) ? data.items.slice(0, 10) : []);
    };
    void run();
  }, [form.mmsWorkOrderId, form.mmsRequiredPartId]);

  const createReservation = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      itemId: form.itemId,
      warehouseId: form.warehouseId || undefined,
      mmsWorkOrderId: form.mmsWorkOrderId.trim(),
      mmsRequiredPartId: form.mmsRequiredPartId.trim(),
      quantity: Number(form.quantity || "0")
    };
    if (!payload.itemId || !payload.mmsWorkOrderId || !payload.mmsRequiredPartId || !(payload.quantity > 0)) {
      return notifyError("Заполните позицию, заявку MMS, часть MMS и количество больше 0.");
    }
    const res = await fetch("/api/wms/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    let data: Record<string, unknown> = {};
    try {
      const raw = await res.text();
      data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      data = {};
    }
    if (!res.ok) return notifyError(typeof data.error === "string" ? data.error : "Не удалось создать резерв");
    notifySuccess("Резерв создан");
    setForm({ itemId: "", warehouseId: "", mmsWorkOrderId: "", mmsRequiredPartId: "", quantity: "" });
    await load();
  };

  const cancel = async (id: string) => {
    if (!window.confirm("Отменить резерв?")) return;
    const res = await fetch(`/api/wms/reservations/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const data = await res.json();
    if (!res.ok) return notifyError(data.error || "Не удалось отменить резерв");
    notifySuccess("Резерв отменен");
    await load();
  };

  const issue = async (id: string) => {
    if (!window.confirm("Выдать резерв и списать остаток?")) return;
    const res = await fetch(`/api/wms/reservations/${id}/issue`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const data = await res.json();
    if (!res.ok) return notifyError(data.error || "Не удалось выдать резерв");
    if (data.mms_sync_warning) notifyError("Выдача выполнена, но MMS не синхронизирован (mms_sync_warning)");
    else notifySuccess("Резерв выдан");
    await load();
  };

  const toggleAll = (checked: boolean) => {
    const active = items.filter((x) => x.status === "ACTIVE").map((x) => x.id);
    setSelectedIds(checked ? active : []);
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const bulkCancel = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Отменить выбранные резервы: ${selectedIds.length}?`)) return;
    await Promise.allSettled(selectedIds.map((id) => fetch(`/api/wms/reservations/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })));
    await load();
  };

  const bulkIssue = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Выдать выбранные резервы: ${selectedIds.length}?`)) return;
    await Promise.allSettled(selectedIds.map((id) => fetch(`/api/wms/reservations/${id}/issue`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })));
    await load();
  };

  const getSla = (row: Reservation) => {
    if (row.status !== "ACTIVE") return { label: "Закрыт", key: "IN SLA" };
    const hours = (Date.now() - new Date(row.createdAt).getTime()) / 36e5;
    if (hours >= 24) return { label: "SLA нарушен", key: "SLA VIOLATED" };
    if (hours >= 8) return { label: "Риск SLA", key: "SLA RISK" };
    return { label: "В SLA", key: "IN SLA" };
  };

  const getPriority = (row: Reservation) => {
    const hours = (Date.now() - new Date(row.createdAt).getTime()) / 36e5;
    if (row.status === "ACTIVE" && (hours >= 24 || row.quantity >= 10)) return { label: "Высокий", key: "HIGH" };
    if (row.status === "ACTIVE" && (hours >= 8 || row.quantity >= 5)) return { label: "Средний", key: "MEDIUM" };
    return { label: "Низкий", key: "LOW" };
  };

  if (loading && items.length === 0) return <LoadingState text="Загрузка резервов..." />;
  if (error && items.length === 0) return <ErrorState text={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "WMS", href: "/wms" }, { label: "Резервы" }]} />
        <h1 className="mt-4 text-3xl font-bold">Резервы</h1>
      </div>

      <Card className="p-4">
        <h2 className="text-lg font-semibold">Создание резерва</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          По умолчанию резерв создается на центральном складе{policy.primary ? `: ${policy.primary.code} | ${policy.primary.name}` : ""}.
        </p>
        <form className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3" onSubmit={(e) => void createReservation(e)}>
          <AppSelect value={form.itemId} onChange={(e) => setForm((p) => ({ ...p, itemId: e.target.value }))}>
            <option value="">Позиция</option>
            {stockItems.map((it) => <option key={it.id} value={it.id}>{it.sku} | {it.name}</option>)}
          </AppSelect>
          <AppSelect value={form.warehouseId} onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}>
            <option value="">Склад (опционально)</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} | {w.name}</option>)}
          </AppSelect>
          <Input list="mms-work-orders-list" placeholder="mms_work_order_id" value={form.mmsWorkOrderId} onChange={(e) => setForm((p) => ({ ...p, mmsWorkOrderId: e.target.value }))} />
          <datalist id="mms-work-orders-list">
            {workOrderSuggestions.map((w, idx) => {
              const value = w.id || w.code || w.number || "";
              const label = w.title || w.number || w.code || w.id || "";
              return value ? <option key={`${value}-${idx}`} value={value} label={label} /> : null;
            })}
          </datalist>
          <Input list="mms-required-parts-list" placeholder="mms_required_part_id" value={form.mmsRequiredPartId} onChange={(e) => setForm((p) => ({ ...p, mmsRequiredPartId: e.target.value }))} />
          <datalist id="mms-required-parts-list">
            {partSuggestions.map((p, idx) => {
              const value = p.id || p.part_id || p.code || "";
              const label = p.name || p.code || p.part_id || p.id || "";
              return value ? <option key={`${value}-${idx}`} value={value} label={label} /> : null;
            })}
          </datalist>
          <Input placeholder="quantity" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
          <Button>Создать резерв</Button>
        </form>
      </Card>

      <TableToolbar
        title="Фильтры и массовые действия"
        hint="Выбор статуса, заявки MMS и пакетная обработка."
        actions={
          <>
            <Button variant="outline" disabled={selectedIds.length === 0} onClick={() => void bulkCancel()}>Массово отменить</Button>
            <Button disabled={selectedIds.length === 0} onClick={() => void bulkIssue()}>Массово выдать</Button>
            <p className="self-center text-xs text-muted-foreground">Выбрано активных: {selectedIds.length}</p>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input placeholder="Фильтр по mms_work_order_id" value={workOrder} onChange={(e) => { setWorkOrder(e.target.value); setPage(1); }} />
          <AppSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">Все статусы</option>
            <option value="ACTIVE">Активен</option>
            <option value="ISSUED">Выдан</option>
            <option value="CANCELLED">Отменен</option>
          </AppSelect>
          <AppSelect value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            <option value="20">20 строк</option>
            <option value="50">50 строк</option>
            <option value="100">100 строк</option>
          </AppSelect>
          <Button variant="outline" onClick={() => void load()}>Обновить</Button>
        </div>
      </TableToolbar>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} checked={items.filter((x) => x.status === "ACTIVE").length > 0 && selectedIds.length === items.filter((x) => x.status === "ACTIVE").length} />
                </th>
                <th className="px-4 py-3 text-left">Позиция</th>
                <th className="px-4 py-3 text-left">Склад</th>
                <th className="px-4 py-3 text-left">MMS WO</th>
                <th className="px-4 py-3 text-left">MMS Part</th>
                <th className="px-4 py-3 text-left">Кол-во</th>
                <th className="px-4 py-3 text-left">Статус</th>
                <th className="px-4 py-3 text-left">SLA</th>
                <th className="px-4 py-3 text-left">Приоритет</th>
                <th className="px-4 py-3 text-left">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <input type="checkbox" disabled={r.status !== "ACTIVE"} checked={selectedIds.includes(r.id)} onChange={(e) => toggleOne(r.id, e.target.checked)} />
                  </td>
                  <td className="px-4 py-3">{r.item?.sku || "-"} | {r.item?.name || "-"}</td>
                  <td className="px-4 py-3">{r.warehouse?.name || "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.mmsWorkOrderId}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.mmsRequiredPartId}</td>
                  <td className="px-4 py-3">{r.quantity}</td>
                  <td className="px-4 py-3"><StatusBadge group="wms_reservation" status={r.status} /></td>
                  <td className="px-4 py-3"><StatusBadge group="wms_sla" status={getSla(r).key} /></td>
                  <td className="px-4 py-3"><StatusBadge group="wms_priority" status={getPriority(r).key} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={r.status !== "ACTIVE"} onClick={() => void cancel(r.id)}>Отменить</Button>
                      <Button size="sm" disabled={r.status !== "ACTIVE"} onClick={() => void issue(r.id)}>Выдать</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? <tr><td className="px-4 py-4 text-muted-foreground" colSpan={10}>Резервов нет.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Страница {page} из {totalPages} · всего {total}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Назад</Button>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Вперед</Button>
        </div>
      </div>
    </div>
  );
}
