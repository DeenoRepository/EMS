"use client";

import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { notifyError, notifySuccess } from "@/lib/client/notify";
import { useWmsScope } from "@/lib/client/use-wms-scope";

type Warehouse = { id: string; name: string; type: "PRIMARY" | "AUXILIARY" };
type WarehousePolicy = { primary: { id: string } | null };
type Item = { id: string; sku: string; name: string };
type ReqLine = { id: string; status: string; requestedQty: string; reservedQty: string; issuedQty: string; resolutionNote?: string | null; item: Item };
type Req = { id: string; requestNumber: string; status: string; fromWarehouse: Warehouse; toWarehouse: Warehouse; lines: ReqLine[] };
type DraftLine = { itemId: string; quantity: string; query: string };
type QueueItem = { id: string; request_number: string; from_warehouse: string; sku: string; name: string; requested_qty: number; status: string; resolution_note?: string | null };

export default function InternalRequestsPage() {
  const { scope } = useWmsScope();
  const canProcessDeficit = scope?.access === "ADMIN" || scope?.access === "CENTRAL";
  const canCreateRequests = scope?.access === "ADMIN" || scope?.access === "AUXILIARY";
  const canManageIncoming = scope?.access === "ADMIN" || scope?.access === "CENTRAL";

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [rows, setRows] = useState<Req[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [draft, setDraft] = useState<DraftLine[]>([{ itemId: "", quantity: "", query: "" }]);
  const [openPickerIndex, setOpenPickerIndex] = useState<number | null>(null);
  const [centralStockByItem, setCentralStockByItem] = useState<Record<string, number>>({});
  const [policy, setPolicy] = useState<WarehousePolicy>({ primary: null });

  const load = async () => {
    const requests = [
      fetch("/api/wms/warehouses?page=1&pageSize=200&status=ACTIVE", { cache: "no-store" }),
      fetch("/api/wms/items?page=1&pageSize=500&status=ACTIVE", { cache: "no-store" }),
      fetch("/api/wms/internal-requests?page=1&pageSize=100", { cache: "no-store" }),
      fetch("/api/wms/warehouses/policy", { cache: "no-store" })
    ] as const;

    const [w, i, r, p] = await Promise.all(requests);
    if (w.ok) setWarehouses((await w.json()).items || []);
    if (i.ok) setItems((await i.json()).items || []);
    if (r.ok) setRows((await r.json()).items || []);
    if (p.ok) setPolicy(await p.json());

    if (canProcessDeficit) {
      const q = await fetch("/api/wms/internal-requests/queue", { cache: "no-store" });
      if (q.ok) setQueue((await q.json()).items || []);
    } else {
      setQueue([]);
    }
  };

  useEffect(() => {
    void load();
  }, [canProcessDeficit]);

  const myAuxWarehouses = useMemo(() => {
    const aux = warehouses.filter((w) => w.type === "AUXILIARY");
    if (!scope || scope.access === "ADMIN") return aux;
    if (scope.access === "AUXILIARY") return aux.filter((w) => scope.responsibleWarehouseIds.includes(w.id));
    return aux;
  }, [warehouses, scope]);
  const centralWarehouseId = useMemo(() => policy.primary?.id || "", [policy.primary?.id]);

  useEffect(() => {
    if (!fromWarehouseId && myAuxWarehouses.length > 0) {
      setFromWarehouseId(myAuxWarehouses[0].id);
    }
  }, [myAuxWarehouses, fromWarehouseId]);

  useEffect(() => {
    const fetchCentralAvailability = async (ids: string[]) => {
      if (!centralWarehouseId || !ids.length) return;
      const missing = ids.filter((id) => !(id in centralStockByItem));
      if (!missing.length) return;
      const entries = await Promise.all(
        missing.map(async (id) => {
          try {
            const res = await fetch(`/api/wms/items/${encodeURIComponent(id)}/availability`, { cache: "no-store" });
            if (!res.ok) return [id, 0] as const;
            const data = (await res.json()) as { balances?: Array<{ warehouse_id: string; available_quantity: number }> };
            const central = (data.balances || [])
              .filter((b) => b.warehouse_id === centralWarehouseId)
              .reduce((sum, b) => sum + Number(b.available_quantity || 0), 0);
            return [id, central] as const;
          } catch {
            return [id, 0] as const;
          }
        })
      );
      setCentralStockByItem((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    };

    const selectedIds = Array.from(new Set(draft.map((d) => d.itemId).filter(Boolean)));
    const suggestionIds = Array.from(
      new Set(
        draft.flatMap((d) =>
          items
            .filter((it) => {
              const q = d.query.trim().toLowerCase();
              if (!q) return true;
              return `${it.sku} ${it.name}`.toLowerCase().includes(q);
            })
            .slice(0, 12)
            .map((it) => it.id)
        )
      )
    );
    void fetchCentralAvailability([...selectedIds, ...suggestionIds]);
  }, [centralWarehouseId, draft, items, centralStockByItem]);

  const createRequest = async () => {
    const effectiveFromWarehouseId =
      fromWarehouseId ||
      (scope?.access === "AUXILIARY" ? (scope.responsibleWarehouseIds[0] || "") : "") ||
      (myAuxWarehouses[0]?.id || "");
    const lines = draft.filter((x) => x.itemId && Number(x.quantity) > 0).map((x) => ({ itemId: x.itemId, quantity: Number(x.quantity) }));
    if (!effectiveFromWarehouseId || lines.length === 0) return notifyError("Не удалось определить ваш склад или не заполнены строки заявки.");

    const res = await fetch("/api/wms/internal-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromWarehouseId: effectiveFromWarehouseId, lines })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return notifyError((data as { error?: string }).error || "Не удалось создать заявку.");

    notifySuccess("Заявка создана");
    setDraft([{ itemId: "", quantity: "", query: "" }]);
    await load();
  };

  const reserveRequest = async (id: string) => {
    const res = await fetch(`/api/wms/internal-requests/${id}/reserve`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return notifyError((data as { error?: string }).error || "Не удалось выполнить резервирование.");
    notifySuccess("Резервирование выполнено");
    await load();
  };

  const fulfillRequest = async (id: string, status: string) => {
    if (status === "NEW" || status === "PARTIAL") {
      const reserveRes = await fetch(`/api/wms/internal-requests/${id}/reserve`, { method: "POST" });
      const reserveData = await reserveRes.json().catch(() => ({}));
      if (!reserveRes.ok) return notifyError((reserveData as { error?: string }).error || "Не удалось выполнить резервирование.");
    }
    const res = await fetch(`/api/wms/internal-requests/${id}/fulfill`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return notifyError((data as { error?: string }).error || "Не удалось исполнить заявку.");
    notifySuccess("Заявка исполнена");
    await load();
  };

  const canReserveRequest = (status: string) => ["NEW", "PARTIAL"].includes(status);
  const canFulfillRequest = (status: string) => ["NEW", "RESERVED", "PARTIAL"].includes(status);

  const resolve = async (id: string, action: "TO_PROCUREMENT" | "ANALOG_SUGGESTED" | "REJECTED") => {
    const res = await fetch(`/api/wms/internal-requests/lines/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: notes[id] || undefined })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return notifyError((data as { error?: string }).error || "Не удалось обновить строку дефицита.");
    notifySuccess("Строка дефицита обновлена");
    await load();
  };

  const searchItems = (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items
      .filter((it) => `${it.sku} ${it.name}`.toLowerCase().includes(q))
      .slice(0, 12);
  };

  const totalDraftQty = draft.reduce((sum, line) => sum + (Number(line.quantity) > 0 ? Number(line.quantity) : 0), 0);
  const preparedDraftLines = draft.filter((line) => Boolean(line.itemId) && Number(line.quantity) > 0).length;
  const activeRequests = rows.filter((r) => !["FULFILLED", "CANCELLED"].includes(r.status)).length;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "WMS", href: "/wms" }, { label: "Мои заявки" }]} />
        <h1 className="mt-4 text-3xl font-bold">Мои заявки</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {scope?.access === "CENTRAL"
            ? "Список входящих заявок от вспомогательных складов."
            : "Полный цикл: подготовка потребности, резервирование на центральном складе и исполнение заявок."}
        </p>
      </div>

      {canCreateRequests ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Активные заявки</p>
            <p className="mt-2 text-2xl font-semibold">{activeRequests}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Подготовлено строк</p>
            <p className="mt-2 text-2xl font-semibold">{preparedDraftLines}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Общий объем заявки</p>
            <p className="mt-2 text-2xl font-semibold">{totalDraftQty}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Склад отправителя</p>
            <p className="mt-2 line-clamp-2 text-sm font-semibold">
              {myAuxWarehouses.find((w) => w.id === fromWarehouseId)?.name || "не определен"}
            </p>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {canCreateRequests ? (
        <Card className="space-y-4 p-4 xl:col-span-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Новая заявка</h2>
              <p className="text-xs text-muted-foreground">Сформируйте потребность вспомогательного склада.</p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
              Авто-склад: <span className="font-semibold">{myAuxWarehouses.find((w) => w.id === fromWarehouseId)?.name || "не определен"}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setDraft((p) => [...p, { itemId: "", quantity: "", query: "" }])}>
              Добавить позицию
            </Button>
            <Button type="button" onClick={() => void createRequest()}>
              Подать заявку
            </Button>
          </div>

          <div className="space-y-3">
            {draft.map((line, idx) => (
              <div key={idx} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Позиция #{idx + 1}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={draft.length === 1}
                    onClick={() => setDraft((p) => p.filter((_, i) => i !== idx))}
                  >
                    Удалить
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    placeholder="Поиск позиции: SKU или наименование"
                    value={line.query}
                    onFocus={() => setOpenPickerIndex(idx)}
                    onBlur={() => setTimeout(() => setOpenPickerIndex((current) => (current === idx ? null : current)), 120)}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDraft((p) => p.map((x, i) => (i === idx ? { ...x, query: value, itemId: "" } : x)));
                      setOpenPickerIndex(idx);
                    }}
                  />
                  {openPickerIndex === idx ? (
                    <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-background shadow-lg">
                      {searchItems(line.query).map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setDraft((p) =>
                              p.map((x, i) =>
                                i === idx
                                  ? { ...x, itemId: it.id, query: `${it.sku} | ${it.name}` }
                                  : x
                              )
                            );
                            setOpenPickerIndex(null);
                          }}
                        >
                          <span className="font-medium">{it.sku} | {it.name}</span>
                          <span className="text-xs text-muted-foreground">Центр: {centralStockByItem[it.id] ?? 0}</span>
                        </button>
                      ))}
                      {searchItems(line.query).length === 0 ? <div className="px-3 py-2 text-sm text-muted-foreground">Ничего не найдено</div> : null}
                    </div>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Input
                    placeholder="Количество"
                    value={line.quantity}
                    onChange={(e) => setDraft((p) => p.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                  />
                  <div className="flex items-center rounded-md border border-border bg-muted/20 px-3 text-xs text-muted-foreground">
                    Доступно на центральном: <span className="ml-1 font-semibold text-foreground">{line.itemId ? (centralStockByItem[line.itemId] ?? 0) : "-"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        ) : null}

        <Card className={`overflow-hidden ${canCreateRequests ? "xl:col-span-7" : "xl:col-span-12"}`}>
          <div className="border-b border-border bg-muted/40 px-4 py-3 text-sm font-medium">Реестр заявок</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>
                  <th className="px-4 py-3 text-left">№</th>
                  <th className="px-4 py-3 text-left">Маршрут</th>
                  <th className="px-4 py-3 text-left">Позиции</th>
                  <th className="px-4 py-3 text-left">Статус</th>
                  {canManageIncoming ? <th className="px-4 py-3 text-left">Действия</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3 font-medium">{r.requestNumber}</td>
                    <td className="px-4 py-3 text-xs">
                      <p>{r.fromWarehouse?.name}</p>
                      <p className="text-muted-foreground">→ {r.toWarehouse?.name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.lines.map((l) => (
                        <p key={l.id}>
                          {l.item.sku} x {l.requestedQty} · {l.status}
                        </p>
                      ))}
                    </td>
                    <td className="px-4 py-3"><StatusBadge group="wms_request" status={r.status} /></td>
                    {canManageIncoming ? (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" disabled={!canReserveRequest(r.status)} onClick={() => void reserveRequest(r.id)}>Резерв</Button>
                          <Button size="sm" disabled={!canFulfillRequest(r.status)} onClick={() => void fulfillRequest(r.id, r.status)}>Исполнить</Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td className="px-4 py-4 text-muted-foreground" colSpan={canManageIncoming ? 5 : 4}>Заявок пока нет.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {canProcessDeficit ? (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Очередь дефицита</div>
            <div className="text-xs text-muted-foreground">Обработка: в закупку, подбор аналога или отклонение</div>
          </div>
          {queue.map((r) => (
            <div key={r.id} className="rounded border border-border p-3 text-sm">
              <p className="font-medium">{r.request_number} | {r.sku} | {r.name}</p>
              <p className="text-muted-foreground">{r.from_warehouse} | qty {r.requested_qty} | {r.status}</p>
              <div className="mt-2 flex gap-2">
                <Input value={notes[r.id] || ""} onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))} placeholder={r.resolution_note || "Комментарий"} />
                <Button variant="outline" onClick={() => void resolve(r.id, "TO_PROCUREMENT")}>В закупку</Button>
                <Button variant="outline" onClick={() => void resolve(r.id, "ANALOG_SUGGESTED")}>Аналог</Button>
                <Button variant="destructive" onClick={() => void resolve(r.id, "REJECTED")}>Отклонить</Button>
              </div>
            </div>
          ))}
          {queue.length === 0 ? <p className="text-sm text-muted-foreground">Очередь пуста.</p> : null}
        </Card>
      ) : null}
    </div>
  );
}
