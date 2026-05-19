"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/client/notify";

type Warehouse = {
  id: string;
  name: string;
  code: string;
  description?: string;
  responsibleEmail?: string | null;
  status: "ACTIVE" | "INACTIVE";
  type: "PRIMARY" | "AUXILIARY";
};

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const raw = await res.text();
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export default function WarehouseDetailsPage() {
  const params = useParams<{ id: string | string[] }>();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);

  const load = async () => {
    if (!id) {
      notifyError("Идентификатор склада не найден");
      router.push("/wms/warehouses");
      return;
    }
    const w = await fetch(`/api/wms/warehouses/${id}`, { cache: "no-store" });
    if (w.ok) setWarehouse(await w.json());
    else if (w.status === 404) {
      notifyError("Склад не найден");
      router.push("/wms/warehouses");
      return;
    }
  };

  useEffect(() => { void load(); }, [id]);

  const saveWarehouse = async (e: FormEvent) => {
    e.preventDefault();
    if (!warehouse) return;
    const res = await fetch(`/api/wms/warehouses/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(warehouse) });
    const data = await safeJson(res);
    if (!res.ok) return notifyError(typeof data.error === "string" ? data.error : "Не удалось сохранить склад");
    notifySuccess("Склад обновлен");
    setWarehouse(data as unknown as Warehouse);
  };

  const removeWarehouse = async () => {
    const res = await fetch(`/api/wms/warehouses/${id}`, { method: "DELETE" });
    const data = await safeJson(res);
    if (!res.ok) return notifyError(typeof data.error === "string" ? data.error : "Не удалось удалить склад");
    notifySuccess("Склад удален");
    router.push("/wms/warehouses");
  };

  if (!warehouse) return <div className="p-6">Загрузка...</div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <Breadcrumbs items={[{ label: "WMS", href: "/wms" }, { label: "Склады", href: "/wms/warehouses" }, { label: warehouse.name }]} />
        <h1 className="mt-4 text-3xl font-bold">{warehouse.name}</h1>
      </div>

      <Card className="p-4">
        <form className="grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={(e) => void saveWarehouse(e)}>
          <Input value={warehouse.name} onChange={(e) => setWarehouse((p) => p ? { ...p, name: e.target.value } : p)} />
          <Input value={warehouse.code} onChange={(e) => setWarehouse((p) => p ? { ...p, code: e.target.value } : p)} />
          <AppSelect value={warehouse.status} onChange={(e) => setWarehouse((p) => p ? { ...p, status: e.target.value as any } : p)}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </AppSelect>
          <AppSelect value={warehouse.type} onChange={(e) => setWarehouse((p) => p ? { ...p, type: e.target.value as "PRIMARY" | "AUXILIARY" } : p)}>
            <option value="PRIMARY">Основной</option>
            <option value="AUXILIARY">Вспомогательный</option>
          </AppSelect>
          <Input value={warehouse.responsibleEmail || ""} onChange={(e) => setWarehouse((p) => p ? { ...p, responsibleEmail: e.target.value } : p)} placeholder="Ответственный (email)" />
          <Input value={warehouse.description || ""} onChange={(e) => setWarehouse((p) => p ? { ...p, description: e.target.value } : p)} placeholder="Описание" />
          <div className="flex gap-2">
            <Button>Сохранить</Button>
            <Button type="button" variant="destructive" onClick={() => void removeWarehouse()}>Удалить</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
