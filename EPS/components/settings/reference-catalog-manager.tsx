"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { notifyError, notifySuccess } from "@/lib/client/notify";

type ReferenceValue = {
  id: string;
  value: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
};

type ReferenceField = {
  id: string;
  entityType: "EQUIPMENT";
  key: string;
  label: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  values: ReferenceValue[];
};

const defaultFieldForm = {
  key: "",
  label: "",
  description: "",
  sortOrder: 0
};

type FieldEditForm = {
  key: string;
  label: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
};

type ValueEditForm = {
  value: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

const presetFields: Array<{ key: string; label: string; description: string }> = [
  { key: "type", label: "Тип оборудования", description: "Классификация по типу оборудования" },
  { key: "category", label: "Группа оборудования", description: "Категория/группа оборудования в реестре" },
  { key: "department", label: "Подразделение", description: "Владелец или ответственное подразделение" },
  { key: "location", label: "Расположение", description: "Производственная площадка, цех, зона или участок" },
  { key: "manufacturer", label: "Производитель", description: "Завод-изготовитель оборудования" },
  { key: "supplier", label: "Поставщик", description: "Организация-поставщик оборудования" }
];

async function parseApiError(res: Response, fallback: string) {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

export function ReferenceCatalogManager() {
  const [items, setItems] = useState<ReferenceField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [fieldForm, setFieldForm] = useState(defaultFieldForm);
  const [showCreateField, setShowCreateField] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  const [fieldQuery, setFieldQuery] = useState("");
  const [valueQuery, setValueQuery] = useState("");
  const [activeFieldId, setActiveFieldId] = useState<string>("");

  const [valueForms, setValueForms] = useState<Record<string, { value: string; label: string; sortOrder: number }>>({});
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [fieldEdits, setFieldEdits] = useState<Record<string, FieldEditForm>>({});
  const [valueEdits, setValueEdits] = useState<Record<string, ValueEditForm>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reference/fields?entityType=EQUIPMENT&includeInactive=1", { cache: "no-store" });
      if (!res.ok) {
        setError(await parseApiError(res, "Не удалось загрузить справочник"));
        return;
      }
      const data = (await res.json()) as ReferenceField[];
      setItems(data);
      if (data.length > 0) {
        setActiveFieldId((prev) => (prev && data.some((x) => x.id === prev) ? prev : data[0].id));
      } else {
        setActiveFieldId("");
      }
    } catch {
      setError("Сетевая ошибка при загрузке справочника");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredFields = useMemo(() => {
    const q = fieldQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((field) =>
      field.label.toLowerCase().includes(q) || field.key.toLowerCase().includes(q) || (field.description || "").toLowerCase().includes(q)
    );
  }, [items, fieldQuery]);

  const activeField = items.find((field) => field.id === activeFieldId) || null;

  const filteredValues = useMemo(() => {
    if (!activeField) return [];
    const q = valueQuery.trim().toLowerCase();
    if (!q) return activeField.values;
    return activeField.values.filter((value) => value.label.toLowerCase().includes(q) || value.value.toLowerCase().includes(q));
  }, [activeField, valueQuery]);

  const createField = async () => {
    const normalizedKey = fieldForm.key.trim().toLowerCase();
    if (!normalizedKey || !fieldForm.label.trim()) {
      setError("Заполните код и название поля справочника");
      notifyError("Заполните код и название поля");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/reference/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "EQUIPMENT",
          key: normalizedKey,
          label: fieldForm.label.trim(),
          description: fieldForm.description.trim() || undefined,
          sortOrder: Number(fieldForm.sortOrder) || 0
        })
      });
      if (!res.ok) {
        const msg = await parseApiError(res, "Не удалось создать поле справочника");
        setError(msg);
        notifyError(msg);
        return;
      }
      setFieldForm(defaultFieldForm);
      setShowCreateField(false);
      setMessage("Категория добавлена");
      notifySuccess("Категория добавлена");
      await load();
    } catch {
      setError("Сетевая ошибка при создании поля");
      notifyError("Сетевая ошибка при создании поля");
    } finally {
      setSaving(false);
    }
  };

  const addPresetField = (preset: { key: string; label: string; description: string }) => {
    setFieldForm({ key: preset.key, label: preset.label, description: preset.description, sortOrder: items.length });
    setShowCreateField(true);
    setError(null);
    setMessage(`Шаблон "${preset.label}" подставлен`);
  };

  const addMissingPresets = async () => {
    const existingKeys = new Set(items.map((field) => field.key));
    const missing = presetFields.filter((preset) => !existingKeys.has(preset.key));
    if (missing.length === 0) {
      setMessage("Все типовые категории уже добавлены");
      notifySuccess("Все типовые категории уже добавлены");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      for (let i = 0; i < missing.length; i += 1) {
        const preset = missing[i];
        const res = await fetch("/api/reference/fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType: "EQUIPMENT",
            key: preset.key,
            label: preset.label,
            description: preset.description,
            sortOrder: items.length + i
          })
        });
        if (!res.ok) {
          const msg = await parseApiError(res, `Не удалось добавить категорию ${preset.label}`);
          setError(msg);
          notifyError(msg);
          return;
        }
      }
      setMessage(`Добавлено типовых категорий: ${missing.length}`);
      notifySuccess(`Добавлено типовых категорий: ${missing.length}`);
      await load();
    } catch {
      setError("Не удалось добавить типовые категории");
      notifyError("Не удалось добавить типовые категории");
    } finally {
      setSaving(false);
    }
  };

  const beginFieldEdit = (field: ReferenceField) => {
    setEditingFieldId(field.id);
    setEditingValueId(null);
    setFieldEdits((prev) => ({
      ...prev,
      [field.id]: {
        key: field.key,
        label: field.label,
        description: field.description || "",
        sortOrder: field.sortOrder,
        isActive: field.isActive
      }
    }));
  };

  const saveField = async (fieldId: string) => {
    const draft = fieldEdits[fieldId];
    if (!draft || !draft.key.trim() || !draft.label.trim()) {
      setError("Для категории заполните код и название");
      notifyError("Для категории заполните код и название");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reference/fields/${fieldId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "EQUIPMENT",
          key: draft.key.trim().toLowerCase(),
          label: draft.label.trim(),
          description: draft.description.trim() || undefined,
          sortOrder: Number(draft.sortOrder) || 0,
          isActive: draft.isActive
        })
      });
      if (!res.ok) {
        const msg = await parseApiError(res, "Не удалось сохранить категорию");
        setError(msg);
        notifyError(msg);
        return;
      }
      setEditingFieldId(null);
      notifySuccess("Категория обновлена");
      await load();
    } catch {
      setError("Сетевая ошибка при сохранении категории");
      notifyError("Сетевая ошибка при сохранении категории");
    } finally {
      setSaving(false);
    }
  };

  const toggleFieldActive = async (field: ReferenceField) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reference/fields/${field.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !field.isActive })
      });
      if (!res.ok) {
        const msg = await parseApiError(res, "Не удалось обновить состояние категории");
        setError(msg);
        notifyError(msg);
        return;
      }
      notifySuccess(field.isActive ? "Категория отключена" : "Категория включена");
      await load();
    } catch {
      setError("Сетевая ошибка при обновлении категории");
      notifyError("Сетевая ошибка при обновлении категории");
    } finally {
      setSaving(false);
    }
  };

  const deleteField = async (field: ReferenceField) => {
    const confirmed = window.confirm(`Удалить категорию "${field.label}"? Будут удалены и все ее значения.`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reference/fields/${field.id}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await parseApiError(res, "Не удалось удалить категорию");
        setError(msg);
        notifyError(msg);
        return;
      }
      setEditingFieldId(null);
      notifySuccess("Категория удалена");
      await load();
    } catch {
      setError("Сетевая ошибка при удалении категории");
      notifyError("Сетевая ошибка при удалении категории");
    } finally {
      setSaving(false);
    }
  };

  const createValue = async (fieldId: string) => {
    const form = valueForms[fieldId] || { value: "", label: "", sortOrder: 0 };
    if (!form.value.trim() || !form.label.trim()) {
      setError("Заполните код и название значения");
      notifyError("Заполните код и название значения");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reference/fields/${fieldId}/values`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: form.value.trim(),
          label: form.label.trim(),
          sortOrder: Number(form.sortOrder) || 0
        })
      });
      if (!res.ok) {
        const msg = await parseApiError(res, "Не удалось добавить значение");
        setError(msg);
        notifyError(msg);
        return;
      }
      setValueForms((prev) => ({ ...prev, [fieldId]: { value: "", label: "", sortOrder: 0 } }));
      notifySuccess("Значение добавлено");
      await load();
    } catch {
      setError("Сетевая ошибка при добавлении значения");
      notifyError("Сетевая ошибка при добавлении значения");
    } finally {
      setSaving(false);
    }
  };

  const beginValueEdit = (value: ReferenceValue) => {
    setEditingValueId(value.id);
    setValueEdits((prev) => ({
      ...prev,
      [value.id]: {
        value: value.value,
        label: value.label,
        sortOrder: value.sortOrder,
        isActive: value.isActive
      }
    }));
  };

  const saveValue = async (valueId: string) => {
    const draft = valueEdits[valueId];
    if (!draft || !draft.value.trim() || !draft.label.trim()) {
      setError("Для значения заполните код и название");
      notifyError("Для значения заполните код и название");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reference/values/${valueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: draft.value.trim(),
          label: draft.label.trim(),
          sortOrder: Number(draft.sortOrder) || 0,
          isActive: draft.isActive
        })
      });
      if (!res.ok) {
        const msg = await parseApiError(res, "Не удалось сохранить значение");
        setError(msg);
        notifyError(msg);
        return;
      }
      setEditingValueId(null);
      notifySuccess("Значение обновлено");
      await load();
    } catch {
      setError("Сетевая ошибка при сохранении значения");
      notifyError("Сетевая ошибка при сохранении значения");
    } finally {
      setSaving(false);
    }
  };

  const toggleValueActive = async (value: ReferenceValue) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reference/values/${value.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !value.isActive })
      });
      if (!res.ok) {
        const msg = await parseApiError(res, "Не удалось обновить состояние значения");
        setError(msg);
        notifyError(msg);
        return;
      }
      notifySuccess(value.isActive ? "Значение отключено" : "Значение включено");
      await load();
    } catch {
      setError("Сетевая ошибка при обновлении значения");
      notifyError("Сетевая ошибка при обновлении значения");
    } finally {
      setSaving(false);
    }
  };

  const deleteValue = async (value: ReferenceValue) => {
    const confirmed = window.confirm(`Удалить значение "${value.label}"?`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reference/values/${value.id}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await parseApiError(res, "Не удалось удалить значение");
        setError(msg);
        notifyError(msg);
        return;
      }
      setEditingValueId(null);
      notifySuccess("Значение удалено");
      await load();
    } catch {
      setError("Сетевая ошибка при удалении значения");
      notifyError("Сетевая ошибка при удалении значения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Категории и значения справочника</p>
            <p className="text-xs text-muted-foreground">Сначала выберите категорию слева, затем редактируйте ее значения справа.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowPresets((prev) => !prev)}>
              {showPresets ? "Скрыть шаблоны" : "Шаблоны"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void addMissingPresets()} disabled={saving}>
              Добавить типовые
            </Button>
            <Button size="sm" onClick={() => setShowCreateField((prev) => !prev)}>
              {showCreateField ? "Скрыть форму" : "Новая категория"}
            </Button>
          </div>
        </div>

        {showPresets ? (
          <div className="flex flex-wrap gap-2 rounded-md border border-border bg-muted/20 p-3">
            {presetFields.map((preset) => (
              <Button key={preset.key} variant="outline" size="sm" onClick={() => addPresetField(preset)}>
                {preset.label}
              </Button>
            ))}
          </div>
        ) : null}

        {showCreateField ? (
          <div className="grid grid-cols-1 gap-3 rounded-md border border-border bg-muted/10 p-3 md:grid-cols-5">
            <Input placeholder="Код категории (type)" value={fieldForm.key} onChange={(e) => setFieldForm((prev) => ({ ...prev, key: e.target.value }))} />
            <Input placeholder="Название категории" value={fieldForm.label} onChange={(e) => setFieldForm((prev) => ({ ...prev, label: e.target.value }))} />
            <Input className="md:col-span-2" placeholder="Описание" value={fieldForm.description} onChange={(e) => setFieldForm((prev) => ({ ...prev, description: e.target.value }))} />
            <div className="flex gap-2">
              <Input type="number" min={0} placeholder="Сорт." value={fieldForm.sortOrder} onChange={(e) => setFieldForm((prev) => ({ ...prev, sortOrder: Number(e.target.value || 0) }))} />
              <Button onClick={() => void createField()} disabled={saving}>Добавить</Button>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-status-error">{error}</p> : null}
        {message ? <p className="text-sm text-status-success">{message}</p> : null}
      </Card>

      {loading ? (
        <Card className="p-4 text-sm text-muted-foreground">Загрузка справочника...</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Card className="space-y-3 p-4 lg:col-span-4">
            <Input placeholder="Поиск категории" value={fieldQuery} onChange={(e) => setFieldQuery(e.target.value)} />
            <div className="space-y-2">
              {filteredFields.map((field) => (
                <button
                  key={field.id}
                  type="button"
                  onClick={() => {
                    setActiveFieldId(field.id);
                    setEditingFieldId(null);
                    setEditingValueId(null);
                    setValueQuery("");
                  }}
                  className={`w-full rounded-md border p-3 text-left transition ${
                    activeFieldId === field.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{field.label}</p>
                    <Badge className={`border-0 ${field.isActive ? "bg-status-success/20 text-status-success" : "bg-status-error/20 text-status-error"}`}>
                      {field.isActive ? "Активна" : "Отключена"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{field.key} • значений: {field.values.length}</p>
                </button>
              ))}
              {filteredFields.length === 0 ? <p className="text-sm text-muted-foreground">Категории не найдены.</p> : null}
            </div>
          </Card>

          <Card className="space-y-3 p-4 lg:col-span-8">
            {!activeField ? (
              <p className="text-sm text-muted-foreground">Выберите категорию слева, чтобы редактировать значения.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold">{activeField.label}</p>
                      <Badge className="border-0 bg-muted text-muted-foreground">{activeField.key}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{activeField.description || "Описание не заполнено"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => beginFieldEdit(activeField)} disabled={saving}>Редактировать</Button>
                    <Button variant="outline" size="sm" onClick={() => void toggleFieldActive(activeField)} disabled={saving}>
                      {activeField.isActive ? "Отключить" : "Включить"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void deleteField(activeField)} disabled={saving}>Удалить</Button>
                  </div>
                </div>

                {editingFieldId === activeField.id ? (
                  <div className="grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/10 p-3 md:grid-cols-5">
                    <Input value={fieldEdits[activeField.id]?.key ?? ""} onChange={(e) => setFieldEdits((prev) => ({ ...prev, [activeField.id]: { ...(prev[activeField.id] || { key: "", label: "", description: "", sortOrder: 0, isActive: true }), key: e.target.value } }))} placeholder="Код" />
                    <Input value={fieldEdits[activeField.id]?.label ?? ""} onChange={(e) => setFieldEdits((prev) => ({ ...prev, [activeField.id]: { ...(prev[activeField.id] || { key: "", label: "", description: "", sortOrder: 0, isActive: true }), label: e.target.value } }))} placeholder="Название" />
                    <Input value={fieldEdits[activeField.id]?.description ?? ""} onChange={(e) => setFieldEdits((prev) => ({ ...prev, [activeField.id]: { ...(prev[activeField.id] || { key: "", label: "", description: "", sortOrder: 0, isActive: true }), description: e.target.value } }))} placeholder="Описание" />
                    <Input type="number" min={0} value={fieldEdits[activeField.id]?.sortOrder ?? 0} onChange={(e) => setFieldEdits((prev) => ({ ...prev, [activeField.id]: { ...(prev[activeField.id] || { key: "", label: "", description: "", sortOrder: 0, isActive: true }), sortOrder: Number(e.target.value || 0) } }))} placeholder="Сортировка" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void saveField(activeField.id)} disabled={saving}>Сохранить</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingFieldId(null)} disabled={saving}>Отмена</Button>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-md border border-border bg-muted/10 p-3">
                  <p className="text-sm font-semibold">Добавить значение</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
                    <Input placeholder="Код значения" value={valueForms[activeField.id]?.value ?? ""} onChange={(e) => setValueForms((prev) => ({ ...prev, [activeField.id]: { ...(prev[activeField.id] || { value: "", label: "", sortOrder: 0 }), value: e.target.value } }))} />
                    <Input placeholder="Название значения" value={valueForms[activeField.id]?.label ?? ""} onChange={(e) => setValueForms((prev) => ({ ...prev, [activeField.id]: { ...(prev[activeField.id] || { value: "", label: "", sortOrder: 0 }), label: e.target.value } }))} />
                    <Input type="number" min={0} placeholder="Сортировка" value={valueForms[activeField.id]?.sortOrder ?? 0} onChange={(e) => setValueForms((prev) => ({ ...prev, [activeField.id]: { ...(prev[activeField.id] || { value: "", label: "", sortOrder: 0 }), sortOrder: Number(e.target.value || 0) } }))} />
                    <Button variant="outline" onClick={() => void createValue(activeField.id)} disabled={saving}>Добавить</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Input placeholder="Поиск значения" value={valueQuery} onChange={(e) => setValueQuery(e.target.value)} />
                  {filteredValues.map((value) => (
                    <div key={value.id} className="rounded-md border border-border p-3">
                      {editingValueId === value.id ? (
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                          <Input value={valueEdits[value.id]?.value ?? ""} onChange={(e) => setValueEdits((prev) => ({ ...prev, [value.id]: { ...(prev[value.id] || { value: "", label: "", sortOrder: 0, isActive: true }), value: e.target.value } }))} placeholder="Код" />
                          <Input value={valueEdits[value.id]?.label ?? ""} onChange={(e) => setValueEdits((prev) => ({ ...prev, [value.id]: { ...(prev[value.id] || { value: "", label: "", sortOrder: 0, isActive: true }), label: e.target.value } }))} placeholder="Название" />
                          <Input type="number" min={0} value={valueEdits[value.id]?.sortOrder ?? 0} onChange={(e) => setValueEdits((prev) => ({ ...prev, [value.id]: { ...(prev[value.id] || { value: "", label: "", sortOrder: 0, isActive: true }), sortOrder: Number(e.target.value || 0) } }))} placeholder="Сортировка" />
                          <div className="flex items-center rounded-md border border-border px-3 text-sm">
                            <input
                              type="checkbox"
                              checked={valueEdits[value.id]?.isActive ?? true}
                              onChange={(e) => setValueEdits((prev) => ({ ...prev, [value.id]: { ...(prev[value.id] || { value: "", label: "", sortOrder: 0, isActive: true }), isActive: e.target.checked } }))}
                            />
                            <span className="ml-2">Активно</span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => void saveValue(value.id)} disabled={saving}>Сохранить</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingValueId(null)} disabled={saving}>Отмена</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{value.label}</p>
                            <p className="text-xs text-muted-foreground">{value.value}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`border-0 ${value.isActive ? "bg-status-success/20 text-status-success" : "bg-status-error/20 text-status-error"}`}>
                              {value.isActive ? "Активно" : "Отключено"}
                            </Badge>
                            <Button variant="outline" size="sm" onClick={() => beginValueEdit(value)} disabled={saving}>Редактировать</Button>
                            <Button variant="outline" size="sm" onClick={() => void toggleValueActive(value)} disabled={saving}>
                              {value.isActive ? "Отключить" : "Включить"}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => void deleteValue(value)} disabled={saving}>Удалить</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredValues.length === 0 ? <p className="text-sm text-muted-foreground">Значения не найдены.</p> : null}
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
