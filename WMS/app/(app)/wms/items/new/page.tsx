"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/client/notify";

export default function NewItemPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ sku: "", name: "", description: "", category: "", unit: "pcs", minQuantity: "", status: "ACTIVE" });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/wms/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, minQuantity: form.minQuantity ? Number(form.minQuantity) : undefined })
      });
      const data = await res.json();
      if (!res.ok) return notifyError(data.error || "Не удалось создать позицию");
      notifySuccess("Позиция создана");
      router.push(`/wms/items/${data.id}`);
    } catch {
      notifyError("Сетевая ошибка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "WMS", href: "/wms" }, { label: "Номенклатура", href: "/wms/items" }, { label: "Новая позиция" }]} />
        <h1 className="mt-4 text-3xl font-bold">Новая позиция</h1>
      </div>

      <Card className="p-4">
        <form className="grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
          <Input placeholder="SKU" value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} />
          <Input placeholder="Название" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input placeholder="Категория" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
          <Input placeholder="Ед. изм." value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />
          <Input placeholder="Минимальный остаток" value={form.minQuantity} onChange={(e) => setForm((p) => ({ ...p, minQuantity: e.target.value }))} />
          <AppSelect value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </AppSelect>
          <Input className="md:col-span-2" placeholder="Описание" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <Button disabled={saving}>{saving ? "Сохранение..." : "Создать"}</Button>
        </form>
      </Card>
    </div>
  );
}
