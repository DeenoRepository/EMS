"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { notifyError, notifySuccess } from "@/lib/client/notify";

type Item = { id: string; sku: string; name: string; status: "ACTIVE" | "INACTIVE" | "ARCHIVED"; category?: string; unit: string };
type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

const STATUS_LABEL: Record<Item["status"], string> = {
  ACTIVE: "Активна",
  INACTIVE: "Неактивна",
  ARCHIVED: "Архив"
};

function StatusBadge({ status }: { status: Item["status"] }) {
  const cls =
    status === "ACTIVE"
      ? "bg-status-success/15 text-status-success"
      : status === "INACTIVE"
        ? "bg-status-warning/15 text-status-warning"
        : "bg-muted text-muted-foreground";
  return <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${cls}`}>{STATUS_LABEL[status]}</span>;
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), q });
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/wms/items?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Не удалось загрузить номенклатуру");
        setItems([]);
        setTotal(0);
        return;
      }
      const data = (await res.json()) as Paged<Item>;
      setItems(data.items || []);
      setTotal(data.total || 0);
      setSelectedIds([]);
    } catch {
      setError("Сетевая ошибка загрузки номенклатуры");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, pageSize, q, status]);

  const applySearch = () => {
    setPage(1);
    setQ(qInput.trim());
  };

  const resetFilters = () => {
    setQInput("");
    setQ("");
    setStatus("all");
    setPage(1);
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? items.map((i) => i.id) : []);
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const bulkArchive = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Архивировать/удалить выбранные позиции: ${selectedIds.length}?`)) return;

    const results = await Promise.allSettled(
      selectedIds.map(async (id) => {
        const res = await fetch(`/api/wms/items/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(id);
      })
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;
    if (failed > 0) {
      alert(`Обработано: ${ok}. Ошибок: ${failed}.`);
    }
    void load();
  };

  const toggleStatus = async (item: Item) => {
    const next = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await fetch(`/api/wms/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: item.sku,
        name: item.name,
        category: item.category,
        unit: item.unit,
        status: next
      })
    });
    const raw = await res.text();
    const data = raw ? JSON.parse(raw) : {};
    if (!res.ok) return notifyError((data as any).error || "Не удалось изменить статус");
    notifySuccess("Статус обновлен");
    await load();
  };

  if (loading && items.length === 0) return <LoadingState text="Загрузка номенклатуры..." />;
  if (error && items.length === 0) return <ErrorState text={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: "WMS", href: "/wms" }, { label: "Номенклатура" }]} />
          <h1 className="mt-4 text-3xl font-bold">Номенклатура</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} позиций в реестре</p>
        </div>
        <Link href="/wms/items/new"><Button>Новая позиция</Button></Link>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            placeholder="Поиск по SKU или названию"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch();
            }}
          />
          <AppSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">Все статусы</option>
            <option value="ACTIVE">Активна</option>
            <option value="INACTIVE">Неактивна</option>
            <option value="ARCHIVED">Архив</option>
          </AppSelect>
          <AppSelect value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            <option value="20">20 строк</option>
            <option value="50">50 строк</option>
            <option value="100">100 строк</option>
          </AppSelect>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={applySearch}>Найти</Button>
            <Button variant="outline" className="flex-1" onClick={resetFilters}>Сброс</Button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Выбрано: {selectedIds.length}</p>
          <Button variant="outline" disabled={selectedIds.length === 0} onClick={() => void bulkArchive()}>
            Архивировать выбранные
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.length === items.length}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Наименование</th>
                <th className="px-4 py-3 text-left">Категория</th>
                <th className="px-4 py-3 text-left">Ед.</th>
                <th className="px-4 py-3 text-left">Статус</th>
                <th className="px-4 py-3 text-left">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={(e) => toggleOne(item.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">{item.category || "-"}</td>
                  <td className="px-4 py-3">{item.unit}</td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link href={`/wms/items/${item.id}`} className="text-primary hover:underline">Открыть</Link>
                      {item.status !== "ARCHIVED" ? (
                        <button className="text-xs text-muted-foreground hover:underline" onClick={() => void toggleStatus(item)}>
                          {item.status === "ACTIVE" ? "Деактивировать" : "Активировать"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? <tr><td className="px-4 py-4 text-muted-foreground" colSpan={7}>Позиции не найдены.</td></tr> : null}
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
