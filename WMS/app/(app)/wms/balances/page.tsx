"use client";

import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useWmsScope } from "@/lib/client/use-wms-scope";

type Row = {
  id: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  isLowStock: boolean;
  item: { sku: string; name: string };
  warehouse: { name: string };
};

type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };
type StockItem = { id: string; sku: string; name: string };
type Warehouse = { id: string; name: string; type: "PRIMARY" | "AUXILIARY" };
type WarehousePolicy = { primary: Warehouse | null; auxiliaries: Warehouse[] };

export default function BalancesPage() {
  const { scope } = useWmsScope();
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [itemValue, setItemValue] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [lowStock, setLowStock] = useState("false");
  const [factualOnly, setFactualOnly] = useState("true");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const lowCount = useMemo(() => items.filter((x) => x.isLowStock).length, [items]);
  const displayItems = items;
  const itemOptions = useMemo(() => {
    const q = itemQuery.replace(/\|/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    const filtered = q
      ? stockItems.filter((it) => `${it.sku} ${it.name}`.replace(/\s+/g, " ").toLowerCase().includes(q))
      : stockItems;
    return filtered.slice(0, 20).map((it) => ({ id: it.id, label: `${it.sku} | ${it.name}` }));
  }, [itemQuery, stockItems]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), lowStock, factualOnly });
      if (itemId) params.set("itemId", itemId);
      if (warehouseId) params.set("warehouseId", warehouseId);
      const res = await fetch(`/api/wms/balances?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Не удалось загрузить остатки");
        setItems([]);
        setTotal(0);
        return;
      }
      const data = (await res.json()) as Paged<Row>;
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setError("Сетевая ошибка загрузки остатков");
    } finally {
      setLoading(false);
    }
  };

  const loadReferences = async () => {
    try {
      const itemsRes = await fetch("/api/wms/items?page=1&pageSize=200&status=ACTIVE", { cache: "no-store" });
      if (itemsRes.ok) {
        const data = (await itemsRes.json()) as Paged<StockItem>;
        setStockItems(data.items || []);
      }
      const policyRes = await fetch("/api/wms/warehouses/policy", { cache: "no-store" });
      if (policyRes.ok) {
        const policy = (await policyRes.json()) as WarehousePolicy;
        const all = [policy.primary, ...(policy.auxiliaries || [])].filter(Boolean) as Warehouse[];
        setWarehouses(all);
      }
    } catch {
      // no-op
    }
  };

  useEffect(() => { void load(); }, [page, pageSize, itemId, warehouseId, lowStock, factualOnly]);
  useEffect(() => { void loadReferences(); }, []);
  useEffect(() => {
    setPickerIndex(0);
  }, [itemQuery]);
  useEffect(() => {
    if (!itemValue.trim()) {
      setItemId("");
      return;
    }
    const hit = stockItems.find((it) => `${it.sku} | ${it.name}` === itemValue);
    if (hit) setItemId(hit.id);
  }, [itemValue, stockItems]);

  if (loading && items.length === 0) return <LoadingState text="Загрузка остатков..." />;
  if (error && items.length === 0) return <ErrorState text={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "WMS", href: "/wms" }, { label: "Остатки" }]} />
        <h1 className="mt-4 text-3xl font-bold">Остатки</h1>
        <p className="mt-1 text-sm text-muted-foreground">Всего позиций: {total}. В low stock на странице: {lowCount}.</p>
      </div>

      <TableToolbar title="Фильтры остатков" hint="Быстрый отбор по позиции и режиму отображения.">
        <div className={`grid grid-cols-1 gap-3 ${scope?.access === "CENTRAL" || scope?.access === "ADMIN" ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
          <div className="relative">
            <Input
              placeholder="Позиция (поиск по SKU/названию)"
              value={itemValue}
              onFocus={() => setPickerOpen(true)}
              onBlur={() => setTimeout(() => setPickerOpen(false), 120)}
              onKeyDown={(e) => {
                if (!itemOptions.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setPickerOpen(true);
                  setPickerIndex((i) => Math.min(i + 1, itemOptions.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setPickerIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && pickerOpen) {
                  e.preventDefault();
                  if (pickerIndex === 0) {
                    setItemValue("");
                    setItemQuery("");
                    setItemId("");
                  } else {
                    const row = itemOptions[pickerIndex - 1];
                    if (!row) return;
                    setItemValue(row.label);
                    setItemQuery(row.label);
                    setItemId(row.id);
                  }
                  setPage(1);
                  setPickerOpen(false);
                } else if (e.key === "Escape") {
                  setPickerOpen(false);
                }
              }}
              onChange={(e) => {
                const value = e.target.value;
                setItemValue(value);
                setItemQuery(value);
                setPage(1);
                if (!value.trim()) setItemId("");
                setPickerOpen(true);
              }}
            />
            {pickerOpen ? (
              <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-background shadow-lg">
                <button
                  type="button"
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${pickerIndex === 0 ? "bg-muted" : "hover:bg-muted/60"}`}
                  onMouseEnter={() => setPickerIndex(0)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setItemValue("");
                    setItemQuery("");
                    setItemId("");
                    setPage(1);
                    setPickerOpen(false);
                  }}
                >
                  <span className="font-medium">Все позиции</span>
                </button>
                {itemOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Ничего не найдено</div>
                ) : (
                  itemOptions.map((row, index) => (
                    <button
                      key={row.id}
                      type="button"
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                        index + 1 === pickerIndex ? "bg-muted" : "hover:bg-muted/60"
                      }`}
                      onMouseEnter={() => setPickerIndex(index + 1)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setItemValue(row.label);
                        setItemQuery(row.label);
                        setItemId(row.id);
                        setPage(1);
                        setPickerOpen(false);
                      }}
                    >
                      <span className="font-medium">{row.label}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          {(scope?.access === "CENTRAL" || scope?.access === "ADMIN") ? (
            <AppSelect value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}>
              <option value="">Все склады</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </AppSelect>
          ) : null}
          <AppSelect value={lowStock} onChange={(e) => { setLowStock(e.target.value); setPage(1); }}>
            <option value="false">Все остатки</option>
            <option value="true">Только low stock</option>
          </AppSelect>
          <AppSelect value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            <option value="20">20 строк</option>
            <option value="50">50 строк</option>
            <option value="100">100 строк</option>
          </AppSelect>
          <AppSelect value={factualOnly} onChange={(e) => { setFactualOnly(e.target.value); setPage(1); }}>
            <option value="true">Только фактические</option>
            <option value="false">Показывать все</option>
          </AppSelect>
        </div>
      </TableToolbar>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Позиция</th>
                <th className="px-4 py-3 text-left">Склад</th>
                <th className="px-4 py-3 text-left">Остаток</th>
                <th className="px-4 py-3 text-left">Резерв</th>
                <th className="px-4 py-3 text-left">Доступно</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayItems.map((row) => (
                <tr key={row.id} className={row.isLowStock ? "bg-status-warning/10" : "hover:bg-muted/20"}>
                  <td className="px-4 py-3 font-mono text-xs">{row.item.sku}</td>
                  <td className="px-4 py-3">{row.item.name}</td>
                  <td className="px-4 py-3">{row.warehouse?.name || "Все склады"}</td>
                  <td className="px-4 py-3">{row.quantity}</td>
                  <td className="px-4 py-3">{row.reservedQuantity}</td>
                  <td className="px-4 py-3 font-semibold">{row.availableQuantity}</td>
                </tr>
              ))}
              {displayItems.length === 0 ? <tr><td className="px-4 py-4 text-muted-foreground" colSpan={6}>Остатков не найдено.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Страница {page} из {totalPages}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Назад</Button>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Вперед</Button>
        </div>
      </div>
    </div>
  );
}
