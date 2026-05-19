"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/client/notify";

type Item = { id: string; sku: string; name: string; description?: string; category?: string; unit: string; minQuantity?: number | null; status: "ACTIVE" | "INACTIVE" | "ARCHIVED" };

type BalanceResp = { items: Array<{ id: string; warehouse?: { name: string }; location?: { name: string } | null; quantity: number; reservedQuantity: number; availableQuantity: number }> };

export default function ItemDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [item, setItem] = useState<Item | null>(null);
  const [balances, setBalances] = useState<BalanceResp>({ items: [] });

  const load = async () => {
    const [i, b] = await Promise.all([
      fetch(`/api/wms/items/${id}`, { cache: "no-store" }),
      fetch(`/api/wms/items/${id}/balances`, { cache: "no-store" })
    ]);
    if (i.ok) setItem(await i.json());
    if (b.ok) setBalances(await b.json());
  };

  useEffect(() => { void load(); }, [id]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!item) return;
    const payload = {
      sku: item.sku.trim(),
      name: item.name.trim(),
      description: (item.description || "").trim() || undefined,
      category: (item.category || "").trim() || undefined,
      unit: item.unit.trim(),
      minQuantity: typeof item.minQuantity === "number" && Number.isFinite(item.minQuantity) ? item.minQuantity : undefined,
      status: item.status
    };
    const res = await fetch(`/api/wms/items/${id}`, {
      method: "PUT",
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
    if (!res.ok) return notifyError(typeof data.error === "string" ? data.error : "Не удалось сохранить");
    notifySuccess("Позиция обновлена");
    setItem(data as unknown as Item);
  };

  const archiveOrDelete = async () => {
    const res = await fetch(`/api/wms/items/${id}`, { method: "DELETE" });
    let data: Record<string, unknown> = {};
    try {
      const raw = await res.text();
      data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      data = {};
    }
    if (!res.ok) return notifyError(typeof data.error === "string" ? data.error : "Не удалось удалить/архивировать");
    notifySuccess("Операция выполнена");
    router.push("/wms/items");
  };

  if (!item) return <div className="p-6">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "WMS", href: "/wms" }, { label: "Номенклатура", href: "/wms/items" }, { label: item.name }]} />
        <h1 className="mt-4 text-3xl font-bold">{item.sku} | {item.name}</h1>
      </div>

      <Card className="p-4">
        <form className="grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={(e) => void save(e)}>
          <Input value={item.sku} onChange={(e) => setItem((p) => p ? { ...p, sku: e.target.value } : p)} />
          <Input value={item.name} onChange={(e) => setItem((p) => p ? { ...p, name: e.target.value } : p)} />
          <Input value={item.category || ""} onChange={(e) => setItem((p) => p ? { ...p, category: e.target.value } : p)} placeholder="Категория" />
          <Input value={item.unit} onChange={(e) => setItem((p) => p ? { ...p, unit: e.target.value } : p)} />
          <Input value={item.minQuantity?.toString() || ""} onChange={(e) => setItem((p) => p ? { ...p, minQuantity: e.target.value ? Number(e.target.value) : null } : p)} placeholder="Мин. остаток" />
          <AppSelect value={item.status} onChange={(e) => setItem((p) => p ? { ...p, status: e.target.value as any } : p)}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </AppSelect>
          <Input className="md:col-span-2" value={item.description || ""} onChange={(e) => setItem((p) => p ? { ...p, description: e.target.value } : p)} placeholder="Описание" />
          <div className="flex gap-2">
            <Button>Сохранить</Button>
            <Button type="button" variant="destructive" onClick={() => void archiveOrDelete()}>Удалить/Архивировать</Button>
          </div>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-semibold">Остатки по позиции</h2>
        <div className="mt-3 space-y-2 text-sm">
          {balances.items.map((b) => (
            <div key={b.id} className="rounded border border-border p-2">
              <p className="font-medium">{b.warehouse?.name || "-"} {b.location?.name ? `| ${b.location.name}` : ""}</p>
              <p className="text-xs text-muted-foreground">qty={b.quantity}, reserved={b.reservedQuantity}, available={b.availableQuantity}</p>
            </div>
          ))}
          {balances.items.length === 0 ? <p className="text-sm text-muted-foreground">Остатков пока нет.</p> : null}
        </div>
      </Card>
    </div>
  );
}
