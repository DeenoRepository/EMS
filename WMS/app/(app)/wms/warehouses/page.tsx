"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";

type Warehouse = {
  id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  type: "PRIMARY" | "AUXILIARY";
  description?: string;
};

type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

export default function WarehousesPage() {
  const [items, setItems] = useState<Warehouse[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const load = async () => {
    const params = new URLSearchParams({ page: "1", pageSize: "100", q });
    if (status !== "all") params.set("status", status);
    const res = await fetch(`/api/wms/warehouses?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return setItems([]);
    const data = (await res.json()) as Paged<Warehouse>;
    setItems(data.items || []);
  };

  useEffect(() => { void load(); }, [q, status]);

  const toggleStatus = async (item: Warehouse) => {
    const next = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await fetch(`/api/wms/warehouses/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, status: next })
    });
    if (!res.ok) return;
    await load();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: "WMS", href: "/wms" }, { label: "Склады" }]} />
          <h1 className="mt-4 text-3xl font-bold">Склады</h1>
        </div>
        <Link href="/wms/warehouses/new"><Button>Новый склад</Button></Link>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input placeholder="Поиск по имени/коду" value={q} onChange={(e) => setQ(e.target.value)} />
          <AppSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Все статусы</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </AppSelect>
          <Button variant="outline" onClick={() => void load()}>Обновить</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left">Код</th>
                <th className="px-4 py-3 text-left">Название</th>
                <th className="px-4 py-3 text-left">Тип</th>
                <th className="px-4 py-3 text-left">Статус</th>
                <th className="px-4 py-3 text-left">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.code}</td>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">{item.type === "PRIMARY" ? "Основной" : "Вспомогательный"}</td>
                  <td className="px-4 py-3">{item.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link href={`/wms/warehouses/${item.id}`} className="text-primary hover:underline">Открыть</Link>
                      <button className="text-xs text-muted-foreground hover:underline" onClick={() => void toggleStatus(item)}>
                        {item.status === "ACTIVE" ? "Деактивировать" : "Активировать"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? <tr><td className="px-4 py-4 text-muted-foreground" colSpan={5}>Склады не найдены.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
