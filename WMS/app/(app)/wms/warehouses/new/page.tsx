"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/client/notify";

export default function NewWarehousePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "", responsibleEmail: "", status: "ACTIVE", type: "AUXILIARY" });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/wms/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) return notifyError(data.error || "Не удалось создать склад");
      notifySuccess("Склад создан");
      const createdId = typeof data?.id === "string" ? data.id : "";
      if (!createdId) {
        notifyError("Склад создан, но id не получен. Откройте список складов.");
        router.push("/wms/warehouses");
        return;
      }
      router.push(`/wms/warehouses/${encodeURIComponent(createdId)}`);
    } catch {
      notifyError("Сетевая ошибка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <Breadcrumbs items={[{ label: "WMS", href: "/wms" }, { label: "Склады", href: "/wms/warehouses" }, { label: "Новый" }]} />
        <h1 className="mt-4 text-3xl font-bold">Новый склад</h1>
      </div>

      <Card className="p-4">
        <form className="grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
          <Input placeholder="Название" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input placeholder="Код" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
          <AppSelect value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </AppSelect>
          <AppSelect value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
            <option value="PRIMARY">Основной</option>
            <option value="AUXILIARY">Вспомогательный</option>
          </AppSelect>
          <Input placeholder="Ответственный (email)" value={form.responsibleEmail} onChange={(e) => setForm((p) => ({ ...p, responsibleEmail: e.target.value }))} />
          <Input placeholder="Описание" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <Button disabled={saving}>{saving ? "Сохранение..." : "Создать"}</Button>
        </form>
      </Card>
    </div>
  );
}
