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
import { useWmsScope } from "@/lib/client/use-wms-scope";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";

type Movement = {
  id: string;
  movementType: string;
  quantity: number;
  createdAt: string;
  item?: { sku: string; name: string };
  warehouse?: { name: string };
  toWarehouse?: { name: string };
};
type StockItem = { id: string; sku: string; name: string; status: "ACTIVE" | "INACTIVE" | "ARCHIVED" };
type Warehouse = { id: string; name: string; code: string; status: "ACTIVE" | "INACTIVE" };
type WarehousePolicy = { primary: Warehouse | null; auxiliaries: Warehouse[] };
type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };
type Availability = {
  available_quantity: number;
  balances: Array<{
    warehouse_id: string;
    available_quantity: number;
  }>;
};
type BalanceRow = {
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
};
type EpsEquipmentSuggestion = { id?: string; code?: string; inventory_number?: string; name?: string; title?: string; responsible?: string; responsible_name?: string };

const TYPE_LABEL: Record<string, string> = {
  RECEIPT: "Приход",
  ISSUE: "Выдача",
  TRANSFER: "Перемещение",
  ADJUSTMENT: "Корректировка"
};

function getSlaLabel(createdAt: string) {
  const minutes = (Date.now() - new Date(createdAt).getTime()) / 60000;
  if (minutes <= 15) return { label: "Только что", key: "IN SLA" };
  if (minutes <= 120) return { label: "Сегодня", key: "SLA RISK" };
  return { label: "Историческое", key: "SLA VIOLATED" };
}

function getPriorityLabel(type: string, qty: number) {
  if (type === "ISSUE" && qty >= 10) return { label: "Высокий", key: "HIGH" };
  if ((type === "ISSUE" && qty >= 5) || (type === "TRANSFER" && qty >= 10)) return { label: "Средний", key: "MEDIUM" };
  return { label: "Низкий", key: "LOW" };
}

function parseLocaleNumber(raw: string) {
  const normalized = raw.replace(",", ".").trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}

function toErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

export default function MovementsPage() {
  const { scope } = useWmsScope();
  const [items, setItems] = useState<Movement[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [policy, setPolicy] = useState<WarehousePolicy>({ primary: null, auxiliaries: [] });
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [stockHint, setStockHint] = useState<BalanceRow | null>(null);
  const [availableItemIds, setAvailableItemIds] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState("RECEIPT");
  const [tableTypeFilter, setTableTypeFilter] = useState("ALL");
  const [tableItemQuery, setTableItemQuery] = useState("");
  const [formItemQuery, setFormItemQuery] = useState("");
  const [formItemValue, setFormItemValue] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemPickerIndex, setItemPickerIndex] = useState(0);
  const [equipmentSuggestions, setEquipmentSuggestions] = useState<EpsEquipmentSuggestion[]>([]);
  const [form, setForm] = useState<Record<string, string>>({
    itemId: "",
    warehouseId: "",
    toWarehouseId: "",
    quantity: "",
    comment: "",
    recipientType: "",
    recipientName: ""
  });

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const isAuxiliaryScope = scope?.access === "AUXILIARY";
  const allowedCreateTypes = useMemo(
    () => (isAuxiliaryScope ? ["ISSUE", "TRANSFER", "ADJUSTMENT"] : ["RECEIPT", "ISSUE", "TRANSFER", "ADJUSTMENT"]),
    [isAuxiliaryScope]
  );
  const myAuxWarehouses = useMemo(() => {
    if (!isAuxiliaryScope || !scope) return policy.auxiliaries;
    return policy.auxiliaries.filter((w) => scope.responsibleWarehouseIds.includes(w.id));
  }, [isAuxiliaryScope, policy.auxiliaries, scope]);
  const autoWarehouseId = useMemo(() => {
    if (!scope) return "";
    if (scope.access === "CENTRAL") return policy.primary?.id || "";
    if (scope.access === "AUXILIARY") return myAuxWarehouses[0]?.id || "";
    if (scope.access === "ADMIN") return policy.primary?.id || "";
    return "";
  }, [scope, policy.primary?.id, myAuxWarehouses]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (tableTypeFilter !== "ALL") params.set("movementType", tableTypeFilter);
      if (tableItemQuery.trim()) params.set("q", tableItemQuery.trim());
      const res = await fetch(`/api/wms/movements?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Не удалось загрузить движения");
        setItems([]);
        setTotal(0);
        return;
      }
      const data = (await res.json()) as Paged<Movement>;
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setError("Сетевая ошибка загрузки движений");
    } finally {
      setLoading(false);
    }
  };

  const loadReferences = async () => {
    try {
      const [itemsRes, warehousesRes, policyRes] = await Promise.all([
        fetch("/api/wms/items?page=1&pageSize=200&status=ACTIVE", { cache: "no-store" }),
        fetch("/api/wms/warehouses?page=1&pageSize=200&status=ACTIVE", { cache: "no-store" }),
        fetch("/api/wms/warehouses/policy", { cache: "no-store" })
      ]);
      if (itemsRes.ok) {
        const data = (await itemsRes.json()) as Paged<StockItem>;
        setStockItems(data.items || []);
      }
      if (warehousesRes.ok) {
        const data = (await warehousesRes.json()) as Paged<Warehouse>;
        setWarehouses(data.items || []);
      }
      if (policyRes.ok) {
        const data = (await policyRes.json()) as WarehousePolicy;
        setPolicy(data);
      }
    } catch {
      notifyError("Не удалось загрузить справочники WMS");
    }
  };

  useEffect(() => { void load(); }, [page, pageSize, tableTypeFilter, tableItemQuery]);
  useEffect(() => { void loadReferences(); }, []);
  useEffect(() => {
    if (!allowedCreateTypes.includes(type)) {
      setType(allowedCreateTypes[0]);
    }
  }, [allowedCreateTypes, type]);
  useEffect(() => {
    if (!policy.primary) return;
    if (type === "RECEIPT") {
      setForm((p) => ({ ...p, warehouseId: policy.primary?.id || "", toWarehouseId: "" }));
      return;
    }
    if (type === "TRANSFER") {
      setForm((p) => {
        const source = autoWarehouseId || policy.primary?.id || "";
        const allowedTargets =
          scope?.access === "CENTRAL"
            ? policy.auxiliaries.map((x) => x.id)
            : scope?.access === "AUXILIARY"
              ? [
                  ...(policy.primary ? [policy.primary.id] : []),
                  ...policy.auxiliaries.map((x) => x.id).filter((id) => id !== source)
                ]
              : warehouses.map((x) => x.id).filter((id) => id !== source);
        const target = allowedTargets.includes(p.toWarehouseId) ? p.toWarehouseId : (allowedTargets[0] || "");
        return { ...p, warehouseId: source, toWarehouseId: target };
      });
      return;
    }
    if (type === "ISSUE" || type === "ADJUSTMENT") {
      setForm((p) => ({ ...p, warehouseId: autoWarehouseId }));
    }
  }, [type, policy.primary?.id, policy.auxiliaries.length, isAuxiliaryScope, myAuxWarehouses, scope, autoWarehouseId, warehouses]);

  useEffect(() => {
    const run = async () => {
      try {
        const sourceWarehouseId =
          type === "ISSUE" ? form.warehouseId :
          type === "TRANSFER" ? (form.warehouseId || "") :
          "";
        if (!sourceWarehouseId) {
          setAvailableItemIds([]);
          return;
        }
        const res = await fetch(`/api/wms/balances?warehouseId=${encodeURIComponent(sourceWarehouseId)}&page=1&pageSize=500`, { cache: "no-store" });
        if (!res.ok) return setAvailableItemIds([]);
        const data = (await res.json()) as Paged<{ itemId: string; availableQuantity: number }>;
        const ids = (data.items || [])
          .filter((x) => x.availableQuantity > 0)
          .map((x) => x.itemId);
        setAvailableItemIds(Array.from(new Set(ids)));
      } catch {
        setAvailableItemIds([]);
      }
    };
    if (type === "ISSUE" || type === "TRANSFER") void run();
    else setAvailableItemIds([]);
  }, [type, form.warehouseId, policy.primary?.id]);
  const requestedQty = parseLocaleNumber(form.quantity || "0");
  const scopedAvailable = useMemo(() => {
    if (!availability) return null;
    const sourceWarehouseId = form.warehouseId || "";
    if (!sourceWarehouseId) return availability.available_quantity;
    const rows = availability.balances.filter((b) => b.warehouse_id === sourceWarehouseId);
    return rows.reduce((sum, row) => sum + row.available_quantity, 0);
  }, [availability, form.warehouseId]);

  const selectableItems = useMemo(() => {
    const scoped = (type === "ISSUE" || type === "TRANSFER")
      ? stockItems.filter((it) => availableItemIds.includes(it.id))
      : stockItems;
    const q = formItemQuery.replace(/\|/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((it) => `${it.sku} ${it.name}`.replace(/\s+/g, " ").toLowerCase().includes(q));
  }, [stockItems, availableItemIds, type, formItemQuery]);

  const selectableItemLabels = useMemo(
    () => selectableItems.map((it) => `${it.sku} | ${it.name}`),
    [selectableItems]
  );

  const inferredItemId = useMemo(() => {
    if (selectedItemId) return selectedItemId;
    const q = formItemValue.trim().toLowerCase();
    if (!q) return "";
    const exact = selectableItems.find((it) => `${it.sku} | ${it.name}`.toLowerCase() === q);
    if (exact) return exact.id;
    const bySku = selectableItems.filter((it) => it.sku.toLowerCase() === q);
    if (bySku.length === 1) return bySku[0].id;
    return "";
  }, [selectedItemId, formItemValue, selectableItems]);

  useEffect(() => {
    const run = async () => {
      if ((type !== "ISSUE" && type !== "TRANSFER") || !inferredItemId) {
        setAvailability(null);
        return;
      }
      try {
        const res = await fetch(`/api/wms/items/${encodeURIComponent(inferredItemId)}/availability`, { cache: "no-store" });
        if (!res.ok) return setAvailability(null);
        const data = (await res.json()) as Availability;
        setAvailability(data);
      } catch {
        setAvailability(null);
      }
    };
    void run();
  }, [type, inferredItemId]);

  useEffect(() => {
    const run = async () => {
      const warehouseId = form.warehouseId || "";
      if (!inferredItemId || !warehouseId) {
        setStockHint(null);
        return;
      }
      try {
        const res = await fetch(
          `/api/wms/balances?itemId=${encodeURIComponent(inferredItemId)}&warehouseId=${encodeURIComponent(warehouseId)}&page=1&pageSize=200`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          setStockHint(null);
          return;
        }
        const data = (await res.json()) as Paged<BalanceRow>;
        const rows = data.items || [];
        if (!rows.length) {
          setStockHint({ quantity: 0, reservedQuantity: 0, availableQuantity: 0 });
          return;
        }
        const sum = rows.reduce(
          (acc, row) => ({
            quantity: acc.quantity + Number(row.quantity || 0),
            reservedQuantity: acc.reservedQuantity + Number(row.reservedQuantity || 0),
            availableQuantity: acc.availableQuantity + Number(row.availableQuantity || 0)
          }),
          { quantity: 0, reservedQuantity: 0, availableQuantity: 0 }
        );
        setStockHint(sum);
      } catch {
        setStockHint(null);
      }
    };
    void run();
  }, [inferredItemId, form.warehouseId]);

  const itemPickerRows = useMemo(
    () => selectableItems.slice(0, 20).map((it) => ({ id: it.id, label: `${it.sku} | ${it.name}` })),
    [selectableItems]
  );

  useEffect(() => {
    if (!formItemValue.trim()) {
      setSelectedItemId("");
      return;
    }
    const hit = selectableItems.find((it) => `${it.sku} | ${it.name}` === formItemValue);
    setSelectedItemId(hit?.id || "");
  }, [formItemValue, selectableItems]);

  useEffect(() => {
    setItemPickerIndex(0);
  }, [formItemQuery, type, form.warehouseId]);
  useEffect(() => {
    const run = async () => {
      if (!(type === "ISSUE" && form.recipientType === "EQUIPMENT")) {
        setEquipmentSuggestions([]);
        return;
      }
      const q = (form.recipientName || "").trim();
      if (q.length < 2) {
        setEquipmentSuggestions([]);
        return;
      }
      try {
        const res = await fetch(`/api/wms/integrations/eps/equipment?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        if (!res.ok) return setEquipmentSuggestions([]);
        const data = await res.json();
        setEquipmentSuggestions(Array.isArray(data.items) ? data.items.slice(0, 12) : []);
      } catch {
        setEquipmentSuggestions([]);
      }
    };
    void run();
  }, [type, form.recipientType, form.recipientName]);

  const cannotSubmit = useMemo(() => {
    if (!inferredItemId) return true;
    if ((type === "RECEIPT" || type === "ADJUSTMENT" || type === "ISSUE" || type === "TRANSFER") && !form.warehouseId) return true;
    if (type === "TRANSFER" && (!form.warehouseId || !form.toWarehouseId)) return true;
    if (type === "TRANSFER" && form.warehouseId && form.toWarehouseId && form.warehouseId === form.toWarehouseId) return true;
    if (type === "ISSUE" && (!form.recipientType || !form.recipientName?.trim())) return true;
    if (!(requestedQty > 0) && type !== "ADJUSTMENT") return true;
    if ((type === "ISSUE" || type === "TRANSFER") && scopedAvailable !== null && requestedQty > scopedAvailable) return true;
    return false;
  }, [inferredItemId, form.warehouseId, form.toWarehouseId, form.recipientType, form.recipientName, type, requestedQty, scopedAvailable]);
  const submitBlockReason = useMemo(() => {
    if (!inferredItemId) return "Выберите позицию из подсказок поиска.";
    if ((type === "RECEIPT" || type === "ADJUSTMENT" || type === "ISSUE" || type === "TRANSFER") && !form.warehouseId) return "Не удалось определить склад по вашей роли.";
    if (type === "TRANSFER" && (!form.warehouseId || !form.toWarehouseId)) return "Выберите склад-источник и склад-получатель.";
    if (type === "TRANSFER" && form.warehouseId && form.toWarehouseId && form.warehouseId === form.toWarehouseId) return "Склад-получатель должен отличаться от склада-источника.";
    if (type === "ISSUE" && (!form.recipientType || !form.recipientName?.trim())) return "Для выдачи укажите получателя: оборудование или сотрудник.";
    if (!(requestedQty > 0) && type !== "ADJUSTMENT") return "Количество должно быть больше 0.";
    if ((type === "ISSUE" || type === "TRANSFER") && scopedAvailable !== null && requestedQty > scopedAvailable) return `Недостаточно остатка: доступно ${scopedAvailable}.`;
    return "";
  }, [form.toWarehouseId, form.warehouseId, form.recipientType, form.recipientName, inferredItemId, requestedQty, scopedAvailable, type]);

  const endpointByType: Record<string, string> = {
    RECEIPT: "/api/wms/movements/receipt",
    ISSUE: "/api/wms/movements/issue",
    TRANSFER: "/api/wms/movements/transfer",
    ADJUSTMENT: "/api/wms/movements/adjustment"
  };

  const submit = async (e: FormEvent) => {
    try {
      e.preventDefault();
      if ((type === "ISSUE" || type === "TRANSFER") && scopedAvailable !== null && requestedQty > scopedAvailable) {
        notifyError(`Недостаточно доступного остатка. Доступно: ${scopedAvailable}, запрошено: ${requestedQty}.`);
        return;
      }

      const cleanId = (value?: string) => {
        const v = (value || "").trim();
        return v.length > 0 ? v : undefined;
      };

      const payload: Record<string, unknown> = {
        ...form,
        itemId: cleanId(inferredItemId),
        warehouseId: cleanId(form.warehouseId),
        toWarehouseId: cleanId(form.toWarehouseId),
        recipientType: cleanId(form.recipientType),
        recipientName: cleanId(form.recipientName),
        comment: (form.comment || "").trim() || undefined
      };
      if (type === "ADJUSTMENT") payload.quantityDelta = parseLocaleNumber(form.quantity || "0");
      else payload.quantity = parseLocaleNumber(form.quantity || "0");

      if (type === "TRANSFER") {
        payload.fromWarehouseId = cleanId(form.warehouseId);
        payload.toWarehouseId = cleanId(form.toWarehouseId);
        delete payload.warehouseId;
      }

      const res = await fetch(endpointByType[type], {
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
      if (!res.ok) {
        const message = typeof data.error === "string" ? data.error : "Операция не выполнена";
        return notifyError(message);
      }

      notifySuccess("Движение сохранено");
      setForm({
        itemId: "",
        warehouseId: "",
        toWarehouseId: "",
        quantity: "",
        comment: "",
        recipientType: "",
        recipientName: ""
      });
      setSelectedItemId("");
      setFormItemValue("");
      setFormItemQuery("");
      setItemPickerOpen(false);
      await load();
    } catch (error) {
      notifyError(toErrorMessage(error, "Не удалось выполнить операцию"));
    }
  };

  if (loading && items.length === 0) return <LoadingState text="Загрузка движений..." />;
  if (error && items.length === 0) return <ErrorState text={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "WMS", href: "/wms" }, { label: "Движения" }]} />
        <h1 className="mt-4 text-3xl font-bold">Движения</h1>
      </div>

      <Card className="p-4">
        <h2 className="text-lg font-semibold">Новое движение</h2>
        <form className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12 md:items-start" onSubmit={(e) => void submit(e)}>
          <div className="space-y-1 md:col-span-3">
            <p className="text-xs font-medium text-muted-foreground">Тип движения</p>
            <AppSelect value={type} onChange={(e) => setType(e.target.value)}>
              {allowedCreateTypes.includes("RECEIPT") ? <option value="RECEIPT">Приход</option> : null}
              {allowedCreateTypes.includes("ISSUE") ? <option value="ISSUE">Выдача</option> : null}
              {allowedCreateTypes.includes("TRANSFER") ? <option value="TRANSFER">Перемещение</option> : null}
              {allowedCreateTypes.includes("ADJUSTMENT") ? <option value="ADJUSTMENT">Корректировка</option> : null}
            </AppSelect>
          </div>
          <div className="space-y-1 md:col-span-3">
            <p className="text-xs font-medium text-muted-foreground">Получатель</p>
            {type === "ISSUE" ? (
              <AppSelect value={form.recipientType || ""} onChange={(e) => setForm((p) => ({ ...p, recipientType: e.target.value }))}>
                <option value="">Выберите тип получателя</option>
                <option value="EQUIPMENT">Оборудование</option>
                <option value="EMPLOYEE">Сотрудник</option>
              </AppSelect>
            ) : type === "TRANSFER" ? (
              <AppSelect value={form.toWarehouseId || ""} onChange={(e) => setForm((p) => ({ ...p, toWarehouseId: e.target.value }))}>
                <option value="">Выберите склад получателя</option>
                {(scope?.access === "CENTRAL"
                  ? policy.auxiliaries
                  : scope?.access === "AUXILIARY"
                    ? [
                        ...(policy.primary ? [policy.primary] : []),
                        ...policy.auxiliaries.filter((w) => w.id !== form.warehouseId)
                      ]
                    : warehouses.filter((w) => w.id !== form.warehouseId)
                ).map((w) => <option key={w.id} value={w.id}>{w.code} | {w.name}</option>)}
              </AppSelect>
            ) : (
              <Input value="Не требуется для этого типа" disabled />
            )}
          </div>
          <div className="relative md:col-span-6">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Позиция</p>
            <Input
              placeholder="Позиция (поиск по SKU/названию)"
              value={formItemValue}
              onFocus={() => setItemPickerOpen(true)}
              onBlur={() => setTimeout(() => setItemPickerOpen(false), 120)}
              onKeyDown={(e) => {
                if (!itemPickerRows.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setItemPickerOpen(true);
                  setItemPickerIndex((i) => Math.min(i + 1, itemPickerRows.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setItemPickerIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && itemPickerOpen) {
                  e.preventDefault();
                  const row = itemPickerRows[itemPickerIndex];
                  if (!row) return;
                  setFormItemValue(row.label);
                  setFormItemQuery(row.label);
                  setSelectedItemId(row.id);
                  setItemPickerOpen(false);
                } else if (e.key === "Escape") {
                  setItemPickerOpen(false);
                }
              }}
              onChange={(e) => {
                const value = e.target.value;
                setFormItemValue(value);
                setFormItemQuery(value);
                setItemPickerOpen(true);
              }}
            />
            {itemPickerOpen ? (
              <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-background shadow-lg">
                {itemPickerRows.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Ничего не найдено</div>
                ) : (
                  itemPickerRows.map((row, index) => (
                    <button
                      key={row.id}
                      type="button"
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                        index === itemPickerIndex ? "bg-muted" : "hover:bg-muted/60"
                      }`}
                      onMouseEnter={() => setItemPickerIndex(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setFormItemValue(row.label);
                        setFormItemQuery(row.label);
                        setSelectedItemId(row.id);
                        setItemPickerOpen(false);
                      }}
                    >
                      <span className="font-medium">{row.label}</span>
                      <span className="text-xs text-muted-foreground">{index + 1}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <div className="min-h-5 text-xs text-muted-foreground md:col-span-12">
            {type === "RECEIPT"
              ? `Найдено позиций: ${selectableItemLabels.length}`
              : `Доступно на складе позиций: ${selectableItemLabels.length}`}
          </div>
          {type !== "ISSUE" ? (
            <div className="md:col-span-3" aria-hidden="true" />
          ) : (
            <div className="space-y-1 md:col-span-3">
              <p className="text-xs font-medium text-muted-foreground">Наименование получателя</p>
              {form.recipientType === "EQUIPMENT" ? (
                <>
                  <Input
                    list="eps-equipment-list"
                    placeholder="Оборудование из EPS (поиск)"
                    value={form.recipientName || ""}
                    onChange={(e) => setForm((p) => ({ ...p, recipientName: e.target.value }))}
                  />
                  <datalist id="eps-equipment-list">
                    {equipmentSuggestions.map((eq, idx) => {
                      const code = eq.inventory_number || eq.code || eq.id || "";
                      const name = eq.name || eq.title || "";
                      const responsible = eq.responsible_name || eq.responsible || "";
                      const value = [code, name].filter(Boolean).join(" | ");
                      const label = responsible ? `Ответственный: ${responsible}` : "";
                      return value ? <option key={`${value}-${idx}`} value={value} label={label} /> : null;
                    })}
                  </datalist>
                </>
              ) : (
                <Input
                  placeholder="ФИО сотрудника"
                  value={form.recipientName || ""}
                  onChange={(e) => setForm((p) => ({ ...p, recipientName: e.target.value }))}
                />
              )}
            </div>
          )}
          <div className="space-y-1 md:col-span-3">
            <p className="text-xs font-medium text-muted-foreground">{type === "ADJUSTMENT" ? "Корректировка количества" : "Количество"}</p>
            <Input placeholder={type === "ADJUSTMENT" ? "Например: -2 или 5" : "Например: 5"} value={form.quantity || ""} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
          </div>
          <div className="space-y-1 md:col-span-6">
            <p className="text-xs font-medium text-muted-foreground">Комментарий</p>
            <Input placeholder="Комментарий (опционально)" value={form.comment || ""} onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))} />
          </div>
          {stockHint ? (
            <div className="text-xs text-muted-foreground md:col-span-6">
              Остаток на складе: <span className="font-semibold">{stockHint.quantity}</span> ·
              Резерв: <span className="font-semibold"> {stockHint.reservedQuantity}</span> ·
              Доступно: <span className="font-semibold"> {stockHint.availableQuantity}</span>
            </div>
          ) : null}
          {type === "ISSUE" || type === "TRANSFER" ? (
            <div className="text-xs text-muted-foreground md:col-span-6">
              Доступно в источнике: <span className="font-semibold">{scopedAvailable ?? "-"}</span>
            </div>
          ) : null}
          <div className="md:col-span-12 flex items-center justify-between gap-3 pt-1">
            <p className="min-h-5 text-xs text-muted-foreground">{cannotSubmit ? submitBlockReason : "Форма валидна. Можно проводить операцию."}</p>
            <Button disabled={cannotSubmit} className="min-w-36">Провести</Button>
          </div>
        </form>
      </Card>

      <TableToolbar title="Фильтры журнала" hint="Поиск по позиции и типу движения.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            placeholder="Поиск по позиции (SKU/название)"
            value={tableItemQuery}
            onChange={(e) => { setTableItemQuery(e.target.value); setPage(1); }}
          />
          <AppSelect value={tableTypeFilter} onChange={(e) => { setTableTypeFilter(e.target.value); setPage(1); }}>
            <option value="ALL">Все типы</option>
            <option value="RECEIPT">Приход</option>
            <option value="ISSUE">Выдача</option>
            <option value="TRANSFER">Перемещение</option>
            <option value="ADJUSTMENT">Корректировка</option>
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
                <th className="px-4 py-3 text-left">Дата</th>
                <th className="px-4 py-3 text-left">Тип</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Позиция</th>
                <th className="px-4 py-3 text-left">Склады</th>
                <th className="px-4 py-3 text-left">Кол-во</th>
                <th className="px-4 py-3 text-left">SLA</th>
                <th className="px-4 py-3 text-left">Приоритет</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">{new Date(row.createdAt).toLocaleString("ru-RU")}</td>
                  <td className="px-4 py-3"><StatusBadge group="wms_movement" status={row.movementType} /></td>
                  <td className="px-4 py-3 font-mono text-xs">{row.item?.sku || "-"}</td>
                  <td className="px-4 py-3">{row.item?.name || "-"}</td>
                  <td className="px-4 py-3">
                    {row.movementType === "TRANSFER"
                      ? `${row.warehouse?.name || "-"} -> ${row.toWarehouse?.name || "-"}`
                      : `${row.warehouse?.name || "-"}`}
                  </td>
                  <td className="px-4 py-3 font-semibold">{row.quantity}</td>
                  <td className="px-4 py-3"><StatusBadge group="wms_sla" status={getSlaLabel(row.createdAt).key} /></td>
                  <td className="px-4 py-3"><StatusBadge group="wms_priority" status={getPriorityLabel(row.movementType, row.quantity).key} /></td>
                </tr>
              ))}
              {items.length === 0 ? <tr><td className="px-4 py-4 text-muted-foreground" colSpan={8}>Движений нет.</td></tr> : null}
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
