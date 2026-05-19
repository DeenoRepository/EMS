"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { useUnsavedChangesGuard } from "@/lib/client/use-unsaved-changes";
import { notifyError, notifySuccess } from "@/lib/client/notify";

type UserOption = { id: string; displayName: string; email: string };
type RuntimeSettings = { workflow?: { equipmentChangesRequireApproval?: boolean } };
type ReferenceOption = { id: string; value: string; label: string };
type ReferenceOptionsResponse = { options: Record<string, ReferenceOption[]> };
type EquipmentTypeAttributeDefinition = {
  id: string;
  typeValue: string;
  key: string;
  label: string;
  dataType: "TEXT" | "NUMBER" | "DATE" | "SELECT";
  required: boolean;
  options?: Array<{ value: string; label: string }> | null;
  description?: string | null;
  isActive: boolean;
};

type EquipmentFormData = {
  name: string;
  type: string;
  category: string;
  model: string;
  serialNumber: string;
  inventoryNumber: string;
  manufacturer: string;
  supplier: string;
  productionDate: string;
  deliveryDate: string;
  commissioningDate: string;
  department: string;
  location: string;
  responsibleUserId: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "DECOMMISSIONED";
  lifecycleStage: "PLANNED" | "COMMISSIONED" | "IN_OPERATION" | "MAINTENANCE" | "RETIRED";
  warrantyExpiration: string;
  serviceDueDate: string;
  notes: string;
  changeSummary: string;
  customAttributes: Record<string, string>;
};

type BaseFieldKey = Exclude<keyof EquipmentFormData, "customAttributes">;

const defaultData: EquipmentFormData = {
  name: "",
  type: "",
  category: "",
  model: "",
  serialNumber: "",
  inventoryNumber: "",
  manufacturer: "",
  supplier: "",
  productionDate: "",
  deliveryDate: "",
  commissioningDate: "",
  department: "",
  location: "",
  responsibleUserId: "",
  status: "DRAFT",
  lifecycleStage: "PLANNED",
  warrantyExpiration: "",
  serviceDueDate: "",
  notes: "",
  changeSummary: "",
  customAttributes: {}
};

const requiredFields: BaseFieldKey[] = [
  "name",
  "type",
  "category",
  "model",
  "serialNumber",
  "inventoryNumber",
  "department",
  "location",
  "responsibleUserId"
];

function toIsoDate(dateValue: string) {
  return dateValue ? new Date(`${dateValue}T00:00:00.000Z`).toISOString() : undefined;
}

type Props = {
  mode: "create" | "edit";
  equipmentId?: string;
  initialData?: Partial<EquipmentFormData>;
};

export function EquipmentForm({ mode, equipmentId, initialData }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [referenceOptions, setReferenceOptions] = useState<Record<string, ReferenceOption[]>>({});
  const [typeAttributeDefinitions, setTypeAttributeDefinitions] = useState<EquipmentTypeAttributeDefinition[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [equipmentApprovalRequired, setEquipmentApprovalRequired] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<EquipmentFormData>({ ...defaultData, ...initialData });
  const [isDirty, setIsDirty] = useState(false);

  useUnsavedChangesGuard({ enabled: isDirty && !submitting });

  useEffect(() => {
    const loadRuntime = async () => {
      try {
        const settingsRes = await fetch("/api/settings/public", { cache: "no-store" });
        if (!settingsRes.ok) return;
        const settingsData: RuntimeSettings = await settingsRes.json();
        setEquipmentApprovalRequired(settingsData.workflow?.equipmentChangesRequireApproval !== false);
      } catch {
        setEquipmentApprovalRequired(true);
      }
    };

    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const [usersRes, refsRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/reference/options?entityType=EQUIPMENT", { cache: "no-store" })
        ]);
        if (usersRes.ok) {
          const userData: UserOption[] = await usersRes.json();
          setUsers(userData);
        }
        if (refsRes.ok) {
          const refsData: ReferenceOptionsResponse = await refsRes.json();
          setReferenceOptions(refsData.options || {});
        }
      } finally {
        setLoadingUsers(false);
      }
    };
    void loadRuntime();
    void loadUsers();
  }, []);

  useEffect(() => {
    const loadTypeAttributes = async () => {
      if (!form.type) {
        setTypeAttributeDefinitions([]);
        return;
      }
      try {
        const res = await fetch(`/api/equipment-type-attributes?type=${encodeURIComponent(form.type)}`, { cache: "no-store" });
        if (!res.ok) {
          setTypeAttributeDefinitions([]);
          return;
        }
        const data: EquipmentTypeAttributeDefinition[] = await res.json();
        setTypeAttributeDefinitions(data || []);
        setForm((prev) => {
          const nextCustom: Record<string, string> = { ...(prev.customAttributes || {}) };
          for (const item of data || []) {
            if (nextCustom[item.key] == null) nextCustom[item.key] = "";
          }
          return { ...prev, customAttributes: nextCustom };
        });
      } catch {
        setTypeAttributeDefinitions([]);
      }
    };
    void loadTypeAttributes();
  }, [form.type]);

  const title = useMemo(() => (mode === "create" ? "Создание оборудования" : "Редактирование оборудования"), [mode]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    for (const field of requiredFields) {
      if (!form[field]) nextErrors[field] = "Обязательное поле";
    }
    for (const attribute of typeAttributeDefinitions.filter((item) => item.required)) {
      const value = form.customAttributes?.[attribute.key];
      if (!value || String(value).trim() === "") {
        nextErrors[`customAttributes.${attribute.key}`] = "Обязательный атрибут";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const payload = (submitForApproval: boolean, forceDraft: boolean) => ({
    ...(mode === "create" ? { equipmentCode: `EQP-${Date.now().toString().slice(-6)}` } : {}),
    name: form.name,
    type: form.type,
    category: form.category,
    model: form.model,
    serialNumber: form.serialNumber,
    inventoryNumber: form.inventoryNumber,
    manufacturer: form.manufacturer,
    supplier: form.supplier,
    productionDate: toIsoDate(form.productionDate),
    deliveryDate: toIsoDate(form.deliveryDate),
    commissioningDate: toIsoDate(form.commissioningDate),
    department: form.department,
    location: form.location,
    responsibleUserId: form.responsibleUserId,
    status: forceDraft ? "DRAFT" : form.status,
    lifecycleStage: form.lifecycleStage,
    warrantyExpiration: toIsoDate(form.warrantyExpiration),
    serviceDueDate: toIsoDate(form.serviceDueDate),
    notes: form.notes,
    changeSummary: form.changeSummary,
    customAttributes: form.customAttributes,
    submitForApproval
  });

  const persist = async (action: "save" | "draft" | "submit") => {
    if (!validate()) return;
    if (action === "submit" && equipmentApprovalRequired) {
      const confirmed = window.confirm("Отправить изменения на согласование?");
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      const submitForApproval = action === "submit" && equipmentApprovalRequired;
      const forceDraft = action === "draft";
      const endpoint = mode === "create" ? "/api/equipment" : `/api/equipment/${equipmentId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(submitForApproval, forceDraft))
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrors((prev) => ({ ...prev, submit: data.error || "Не удалось сохранить оборудование" }));
        notifyError("Не удалось сохранить оборудование");
        return;
      }

      const saved: { id: string } = await res.json();
      setIsDirty(false);
      notifySuccess(
        action === "submit"
          ? "Изменения отправлены на согласование"
          : action === "draft"
            ? "Черновик оборудования сохранен"
            : "Изменения оборудования сохранены"
      );
      router.push(`/equipment/${saved.id || equipmentId}`);
      router.refresh();
    } catch (caught) {
      setErrors((prev) => ({
        ...prev,
        submit: caught instanceof Error ? caught.message : "Сетевая ошибка при сохранении оборудования"
      }));
      notifyError("Сетевая ошибка при сохранении оборудования");
    } finally {
      setSubmitting(false);
    }
  };

  const setValue = (key: BaseFieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const setCustomAttributeValue = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      customAttributes: {
        ...(prev.customAttributes || {}),
        [key]: value
      }
    }));
    setIsDirty(true);
    const errorKey = `customAttributes.${key}`;
    if (errors[errorKey]) setErrors((prev) => ({ ...prev, [errorKey]: "" }));
  };

  const renderField = (label: string, key: BaseFieldKey, type: "text" | "date" = "text") => (
    <div>
      <label className="text-sm font-medium text-foreground">{label}</label>
      <Input type={type} className={`mt-2 ${errors[key] ? "border-status-error" : ""}`} value={form[key]} onChange={(e) => setValue(key, e.target.value)} />
      {errors[key] ? <p className="mt-1 text-xs text-status-error">{errors[key]}</p> : null}
    </div>
  );

  const renderCatalogField = (label: string, key: BaseFieldKey, optionKey: string) => {
    const options = referenceOptions[optionKey] || [];
    if (options.length === 0) return renderField(label, key);

    return (
      <div>
        <label className="text-sm font-medium text-foreground">{label}</label>
        <AppSelect
          className={`mt-2 ${errors[key] ? "border-status-error" : ""}`}
          value={form[key]}
          onChange={(e) => setValue(key, e.target.value)}
        >
          <option value="">Выберите значение</option>
          {options.map((option) => (
            <option key={option.id} value={option.value}>
              {option.label}
            </option>
          ))}
        </AppSelect>
        {errors[key] ? <p className="mt-1 text-xs text-status-error">{errors[key]}</p> : null}
      </div>
    );
  };

  const renderTypeAttributeField = (attribute: EquipmentTypeAttributeDefinition) => {
    const value = form.customAttributes?.[attribute.key] || "";
    const errorKey = `customAttributes.${attribute.key}`;
    const baseClass = `mt-2 w-full rounded-md border border-input bg-white px-3 text-sm ${errors[errorKey] ? "border-status-error" : ""}`;

    return (
      <div key={attribute.id}>
        <label className="text-sm font-medium text-foreground">
          {attribute.label}
          {attribute.required ? <span className="ml-1 text-status-error">*</span> : null}
        </label>
        {attribute.dataType === "SELECT" ? (
          <AppSelect className={baseClass} value={value} onChange={(e) => setCustomAttributeValue(attribute.key, e.target.value)}>
            <option value="">Выберите значение</option>
            {(attribute.options || []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AppSelect>
        ) : (
          <Input
            type={attribute.dataType === "NUMBER" ? "number" : attribute.dataType === "DATE" ? "date" : "text"}
            className={baseClass}
            value={value}
            onChange={(e) => setCustomAttributeValue(attribute.key, e.target.value)}
          />
        )}
        {attribute.description ? <p className="mt-1 text-xs text-muted-foreground">{attribute.description}</p> : null}
        {errors[errorKey] ? <p className="mt-1 text-xs text-status-error">{errors[errorKey]}</p> : null}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24">
      <Card className="p-6">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Заполните обязательные поля и укажите комментарий к изменению для аудита и согласования.</p>
      </Card>

      <Card className="space-y-6 p-6">
        <h3 className="text-lg font-semibold">Основная информация</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {renderField("Наименование", "name")}
          {renderCatalogField("Тип", "type", "type")}
          {renderCatalogField("Категория", "category", "category")}
          {renderField("Модель", "model")}
          {renderField("Серийный номер", "serialNumber")}
          {renderField("Инвентарный номер", "inventoryNumber")}
          {renderField("Производитель", "manufacturer")}
          {renderField("Поставщик", "supplier")}
          {renderField("Дата производства", "productionDate", "date")}
          {renderField("Дата поставки", "deliveryDate", "date")}
          {renderField("Дата ввода в эксплуатацию", "commissioningDate", "date")}
        </div>
      </Card>

      <Card className="space-y-6 p-6">
        <h3 className="text-lg font-semibold">Ответственные и жизненный цикл</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {renderCatalogField("Подразделение", "department", "department")}
          {renderCatalogField("Локация", "location", "location")}

          <div>
            <label className="text-sm font-medium text-foreground">Ответственный пользователь</label>
            <AppSelect className={`mt-2 ${errors.responsibleUserId ? "border-status-error" : ""}`} value={form.responsibleUserId} onChange={(e) => setValue("responsibleUserId", e.target.value)} disabled={loadingUsers}>
              <option value="">Выберите пользователя</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.displayName} ({user.email})</option>)}
            </AppSelect>
            {errors.responsibleUserId ? <p className="mt-1 text-xs text-status-error">{errors.responsibleUserId}</p> : null}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Статус</label>
            <AppSelect className="mt-2" value={form.status} onChange={(e) => setValue("status", e.target.value)}>
              <option value="DRAFT">Черновик</option>
              <option value="ACTIVE">В работе</option>
              <option value="INACTIVE">Обслуживание</option>
              <option value="DECOMMISSIONED">Списано</option>
            </AppSelect>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Этап жизненного цикла</label>
            <AppSelect className="mt-2" value={form.lifecycleStage} onChange={(e) => setValue("lifecycleStage", e.target.value)}>
              <option value="PLANNED">Планирование</option>
              <option value="COMMISSIONED">Ввод в эксплуатацию</option>
              <option value="IN_OPERATION">Эксплуатация</option>
              <option value="MAINTENANCE">Обслуживание</option>
              <option value="RETIRED">Выведено</option>
            </AppSelect>
          </div>

          {renderField("Окончание гарантии", "warrantyExpiration", "date")}
          {renderField("Дата следующего ТО", "serviceDueDate", "date")}
        </div>
      </Card>

      {typeAttributeDefinitions.length > 0 ? (
        <Card className="space-y-6 p-6">
          <h3 className="text-lg font-semibold">Дополнительные атрибуты типа оборудования</h3>
          <p className="text-sm text-muted-foreground">
            Атрибуты для типа <span className="font-medium">{form.type}</span>. Обязательные поля помечены звездочкой.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {typeAttributeDefinitions.map((attribute) => renderTypeAttributeField(attribute))}
          </div>
        </Card>
      ) : null}

      <Card className="space-y-4 p-6">
        <h3 className="text-lg font-semibold">Примечания и комментарий к изменению</h3>
        {!equipmentApprovalRequired ? (
          <div className="rounded-md border border-status-success/30 bg-status-success/10 p-3 text-sm text-status-success">
            Согласование изменений оборудования отключено в настройках. Сохранение применяет изменения сразу.
          </div>
        ) : null}
        <div>
          <label className="text-sm font-medium text-foreground">Примечания</label>
          <Textarea className="mt-2" value={form.notes} onChange={(e) => setValue("notes", e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Комментарий к изменению</label>
          <Textarea className="mt-2" value={form.changeSummary} onChange={(e) => setValue("changeSummary", e.target.value)} />
        </div>
        {errors.submit ? <p className="text-sm text-status-error">{errors.submit}</p> : null}
      </Card>

      <div className="fixed bottom-0 left-64 right-0 z-30 border-t border-border bg-card/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-2">
          <Button variant="outline" disabled={submitting} onClick={() => void persist("draft")}>Сохранить черновик</Button>
          <Button variant="outline" disabled={submitting} onClick={() => void persist("save")}>Сохранить</Button>
          {equipmentApprovalRequired ? (
            <Button disabled={submitting} onClick={() => void persist("submit")}>Отправить на согласование</Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
