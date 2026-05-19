"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppSelect } from "@/components/ui/app-select";
import { notifyError, notifySuccess } from "@/lib/client/notify";

type ReferenceOption = { id: string; value: string; label: string };
type ReferenceOptionsResponse = { options: Record<string, ReferenceOption[]> };

type EquipmentTypeAttribute = {
  id: string;
  typeValue: string;
  key: string;
  label: string;
  dataType: "TEXT" | "NUMBER" | "DATE" | "SELECT";
  required: boolean;
  options?: Array<{ value: string; label: string }> | null;
  isActive: boolean;
  sortOrder: number;
  description?: string | null;
};

const defaultForm = {
  key: "",
  label: "",
  dataType: "TEXT" as EquipmentTypeAttribute["dataType"],
  required: false,
  optionsText: "",
  sortOrder: 0,
  description: ""
};

type AttributeEditForm = {
  key: string;
  label: string;
  dataType: EquipmentTypeAttribute["dataType"];
  required: boolean;
  optionsText: string;
  sortOrder: number;
  description: string;
  isActive: boolean;
};

async function parseApiError(res: Response, fallback: string) {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

export function EquipmentTypeAttributesManager() {
  const [typeOptions, setTypeOptions] = useState<ReferenceOption[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [items, setItems] = useState<EquipmentTypeAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");

  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, AttributeEditForm>>({});

  const canCreate = useMemo(() => !!selectedType, [selectedType]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      item.label.toLowerCase().includes(q) ||
      item.key.toLowerCase().includes(q) ||
      (item.description || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const loadTypes = async () => {
    try {
      const res = await fetch("/api/reference/options?entityType=EQUIPMENT", { cache: "no-store" });
      if (!res.ok) return;
      const data: ReferenceOptionsResponse = await res.json();
      const types = data.options?.type || [];
      setTypeOptions(types);
      if (!selectedType && types.length > 0) {
        setSelectedType(types[0].value);
      }
    } catch {
      // ignore
    }
  };

  const loadItems = async (typeValue: string) => {
    if (!typeValue) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/equipment-type-attributes?type=${encodeURIComponent(typeValue)}&includeInactive=1`, { cache: "no-store" });
      if (!res.ok) {
        setError(await parseApiError(res, "Не удалось загрузить атрибуты типа оборудования"));
        return;
      }
      const data: EquipmentTypeAttribute[] = await res.json();
      setItems(data || []);
    } catch {
      setError("Сетевая ошибка при загрузке атрибутов");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTypes();
  }, []);

  useEffect(() => {
    void loadItems(selectedType);
  }, [selectedType]);

  const createAttribute = async () => {
    if (!selectedType) {
      setError("Сначала выберите тип оборудования");
      notifyError("Сначала выберите тип оборудования");
      return;
    }
    if (!form.key.trim() || !form.label.trim()) {
      setError("Заполните код и название атрибута");
      notifyError("Заполните код и название атрибута");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const options =
        form.dataType === "SELECT"
          ? form.optionsText
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
              .map((value) => ({ value, label: value }))
          : undefined;

      const res = await fetch("/api/equipment-type-attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeValue: selectedType,
          key: form.key.trim().toLowerCase(),
          label: form.label.trim(),
          dataType: form.dataType,
          required: form.required,
          options,
          sortOrder: Number(form.sortOrder) || 0,
          description: form.description.trim() || undefined
        })
      });

      if (!res.ok) {
        const msg = await parseApiError(res, "Не удалось создать атрибут");
        setError(msg);
        notifyError(msg);
        return;
      }

      setForm(defaultForm);
      setShowCreate(false);
      setMessage("Атрибут добавлен");
      notifySuccess("Атрибут добавлен");
      await loadItems(selectedType);
    } catch {
      setError("Сетевая ошибка при создании атрибута");
      notifyError("Сетевая ошибка при создании атрибута");
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (item: EquipmentTypeAttribute) => {
    setEditingId(item.id);
    setEdits((prev) => ({
      ...prev,
      [item.id]: {
        key: item.key,
        label: item.label,
        dataType: item.dataType,
        required: item.required,
        optionsText: item.options?.map((option) => option.value).join(", ") || "",
        sortOrder: item.sortOrder,
        description: item.description || "",
        isActive: item.isActive
      }
    }));
  };

  const saveEdit = async (itemId: string) => {
    const draft = edits[itemId];
    if (!draft || !draft.key.trim() || !draft.label.trim()) {
      setError("Заполните код и название атрибута");
      notifyError("Заполните код и название атрибута");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const options =
        draft.dataType === "SELECT"
          ? draft.optionsText
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
              .map((value) => ({ value, label: value }))
          : undefined;

      const res = await fetch(`/api/equipment-type-attributes/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: draft.key.trim().toLowerCase(),
          label: draft.label.trim(),
          dataType: draft.dataType,
          required: draft.required,
          options,
          sortOrder: Number(draft.sortOrder) || 0,
          description: draft.description.trim() || undefined,
          isActive: draft.isActive
        })
      });
      if (!res.ok) {
        const msg = await parseApiError(res, "Не удалось сохранить атрибут");
        setError(msg);
        notifyError(msg);
        return;
      }
      setEditingId(null);
      notifySuccess("Атрибут обновлен");
      await loadItems(selectedType);
    } catch {
      setError("Сетевая ошибка при сохранении атрибута");
      notifyError("Сетевая ошибка при сохранении атрибута");
    } finally {
      setSaving(false);
    }
  };

  const toggleAttribute = async (item: EquipmentTypeAttribute) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/equipment-type-attributes/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive })
      });
      if (!res.ok) {
        const msg = await parseApiError(res, "Не удалось обновить атрибут");
        setError(msg);
        notifyError(msg);
        return;
      }
      notifySuccess(item.isActive ? "Атрибут отключен" : "Атрибут включен");
      await loadItems(selectedType);
    } catch {
      setError("Сетевая ошибка при обновлении атрибута");
      notifyError("Сетевая ошибка при обновлении атрибута");
    } finally {
      setSaving(false);
    }
  };

  const deleteAttribute = async (item: EquipmentTypeAttribute) => {
    const confirmed = window.confirm(`Удалить атрибут "${item.label}"?`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/equipment-type-attributes/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await parseApiError(res, "Не удалось удалить атрибут");
        setError(msg);
        notifyError(msg);
        return;
      }
      setEditingId(null);
      notifySuccess("Атрибут удален");
      await loadItems(selectedType);
    } catch {
      setError("Сетевая ошибка при удалении атрибута");
      notifyError("Сетевая ошибка при удалении атрибута");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Атрибуты по типу оборудования</p>
          <p className="text-xs text-muted-foreground">Выберите тип оборудования и управляйте атрибутами в компактном списке.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((prev) => !prev)} disabled={!canCreate}>
          {showCreate ? "Скрыть форму" : "Новый атрибут"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Тип оборудования</label>
          <AppSelect className="mt-2" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
            <option value="">Выберите тип</option>
            {typeOptions.map((option) => (
              <option key={option.id} value={option.value}>{option.label}</option>
            ))}
          </AppSelect>
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium">Поиск атрибутов</label>
          <Input className="mt-2" placeholder="Название, код или описание" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {showCreate ? (
        <div className="grid grid-cols-1 gap-3 rounded-md border border-border bg-muted/10 p-3 md:grid-cols-4">
          <Input placeholder="Код атрибута (pressure_class)" value={form.key} onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))} />
          <Input placeholder="Название (Класс давления)" value={form.label} onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))} />
          <AppSelect value={form.dataType} onChange={(e) => setForm((prev) => ({ ...prev, dataType: e.target.value as EquipmentTypeAttribute["dataType"] }))}>
            <option value="TEXT">Текст</option>
            <option value="NUMBER">Число</option>
            <option value="DATE">Дата</option>
            <option value="SELECT">Список</option>
          </AppSelect>
          <label className="flex items-center gap-2 rounded-md border border-border px-3 text-sm">
            <input type="checkbox" checked={form.required} onChange={(e) => setForm((prev) => ({ ...prev, required: e.target.checked }))} />
            Обязательный
          </label>

          {form.dataType === "SELECT" ? (
            <Input className="md:col-span-2" placeholder="Варианты через запятую" value={form.optionsText} onChange={(e) => setForm((prev) => ({ ...prev, optionsText: e.target.value }))} />
          ) : null}
          <Input placeholder="Порядок" type="number" min={0} value={form.sortOrder} onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: Number(e.target.value || 0) }))} />
          <Input placeholder="Описание" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          <div className="md:col-span-4">
            <Button onClick={() => void createAttribute()} disabled={saving || !canCreate}>Добавить атрибут</Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-status-error">{error}</p> : null}
      {message ? <p className="text-sm text-status-success">{message}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка атрибутов...</p>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div key={item.id} className="rounded-md border border-border p-3">
              {editingId === item.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                    <Input value={edits[item.id]?.key ?? ""} onChange={(e) => setEdits((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] || { key: "", label: "", dataType: "TEXT", required: false, optionsText: "", sortOrder: 0, description: "", isActive: true }), key: e.target.value } }))} placeholder="Код" />
                    <Input value={edits[item.id]?.label ?? ""} onChange={(e) => setEdits((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] || { key: "", label: "", dataType: "TEXT", required: false, optionsText: "", sortOrder: 0, description: "", isActive: true }), label: e.target.value } }))} placeholder="Название" />
                    <AppSelect value={edits[item.id]?.dataType ?? "TEXT"} onChange={(e) => setEdits((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] || { key: "", label: "", dataType: "TEXT", required: false, optionsText: "", sortOrder: 0, description: "", isActive: true }), dataType: e.target.value as EquipmentTypeAttribute["dataType"] } }))}>
                      <option value="TEXT">Текст</option>
                      <option value="NUMBER">Число</option>
                      <option value="DATE">Дата</option>
                      <option value="SELECT">Список</option>
                    </AppSelect>
                    <label className="flex items-center gap-2 rounded-md border border-border px-3 text-sm">
                      <input type="checkbox" checked={edits[item.id]?.required ?? false} onChange={(e) => setEdits((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] || { key: "", label: "", dataType: "TEXT", required: false, optionsText: "", sortOrder: 0, description: "", isActive: true }), required: e.target.checked } }))} />
                      Обязательный
                    </label>
                  </div>
                  {(edits[item.id]?.dataType ?? "TEXT") === "SELECT" ? (
                    <Input placeholder="Варианты через запятую" value={edits[item.id]?.optionsText ?? ""} onChange={(e) => setEdits((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] || { key: "", label: "", dataType: "TEXT", required: false, optionsText: "", sortOrder: 0, description: "", isActive: true }), optionsText: e.target.value } }))} />
                  ) : null}
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <Input type="number" min={0} value={edits[item.id]?.sortOrder ?? 0} onChange={(e) => setEdits((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] || { key: "", label: "", dataType: "TEXT", required: false, optionsText: "", sortOrder: 0, description: "", isActive: true }), sortOrder: Number(e.target.value || 0) } }))} placeholder="Сортировка" />
                    <Input value={edits[item.id]?.description ?? ""} onChange={(e) => setEdits((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] || { key: "", label: "", dataType: "TEXT", required: false, optionsText: "", sortOrder: 0, description: "", isActive: true }), description: e.target.value } }))} placeholder="Описание" />
                    <label className="flex items-center gap-2 rounded-md border border-border px-3 text-sm">
                      <input type="checkbox" checked={edits[item.id]?.isActive ?? true} onChange={(e) => setEdits((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] || { key: "", label: "", dataType: "TEXT", required: false, optionsText: "", sortOrder: 0, description: "", isActive: true }), isActive: e.target.checked } }))} />
                      Активный
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void saveEdit(item.id)} disabled={saving}>Сохранить</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={saving}>Отмена</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.key} • {item.dataType}{item.required ? " • обязательный" : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`border-0 ${item.isActive ? "bg-status-success/20 text-status-success" : "bg-status-error/20 text-status-error"}`}>
                      {item.isActive ? "Активен" : "Отключен"}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => beginEdit(item)} disabled={saving || editingId === item.id}>Редактировать</Button>
                    <Button variant="outline" size="sm" onClick={() => void toggleAttribute(item)} disabled={saving}>{item.isActive ? "Отключить" : "Включить"}</Button>
                    <Button variant="ghost" size="sm" onClick={() => void deleteAttribute(item)} disabled={saving}>Удалить</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {filteredItems.length === 0 ? <p className="text-sm text-muted-foreground">Для выбранного типа атрибуты не найдены.</p> : null}
        </div>
      )}
    </Card>
  );
}
