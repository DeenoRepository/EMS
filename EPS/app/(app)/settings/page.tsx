"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AppSelect } from "@/components/ui/app-select";
import { SummaryCard } from "@/components/ui/summary-card";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { hasAnyRole } from "@/lib/client/auth";
import { ErrorState } from "@/components/states/error-state";
import { ReferenceCatalogManager } from "@/components/settings/reference-catalog-manager";
import { EquipmentTypeAttributesManager } from "@/components/settings/equipment-type-attributes-manager";
import { useUnsavedChangesGuard } from "@/lib/client/use-unsaved-changes";
import { notifyError, notifySuccess } from "@/lib/client/notify";
import { RefreshCw, RotateCcw, Wand2 } from "lucide-react";

type ProjectSettings = {
  general: {
    companyName: string;
    siteName: string;
    timezone: string;
    locale: string;
  };
  workflow: {
    equipmentChangesRequireApproval: boolean;
    documentChangesRequireApproval: boolean;
    rollbackEnabledForApprover: boolean;
    enforceAuditTrail: boolean;
  };
  documents: {
    requiredByEquipmentType: Record<string, string[]>;
  };
  ui: {
    defaultPageSize: number;
    dateFormat: string;
    desktopFirst: boolean;
  };
  storage: {
    localMode: "UPLOADS" | "NETWORK_DRIVE";
    networkDiskPath: string;
  };
  integrations: {
    ldapEnabled: boolean;
    ldapUrl: string;
    ldapBaseDn: string;
    ldapUserBaseDn: string;
    ldapGroupBaseDn: string;
  };
};

type Health = {
  ok: boolean;
  provider: string;
  message: string;
  latencyMs?: number;
  url?: string;
};

type SettingsResponse = {
  settings: ProjectSettings;
  system: {
    appVersion: string;
    nodeVersion: string;
    provider: string;
    database: string;
    ldapHealth: Health;
    counts: {
      equipmentTotal: number;
      documentsTotal: number;
      approvalsPending: number;
      usersActive: number;
    };
  };
};

const tabs = ["overview", "general", "workflow", "documents", "reference", "integrations", "users", "ui"] as const;
type Tab = (typeof tabs)[number];
const tabLabels: Record<Tab, string> = {
  overview: "Обзор",
  general: "Общие",
  workflow: "Согласования",
  documents: "Документы",
  reference: "Справочники",
  integrations: "Интеграции",
  users: "Права доступа",
  ui: "Интерфейс"
};

type AccessRole = "VIEWER" | "EDITOR" | "APPROVER" | "ADMIN";
type ManagedUser = {
  id: string;
  email: string;
  displayName: string;
  roles: AccessRole[];
};

function deepSortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => deepSortValue(item));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, item]) => [key, deepSortValue(item)]));
  }
  return value;
}

function buildSettingsSnapshot(form: ProjectSettings, requiredDocsJson: string) {
  let docsMap: Record<string, string[]> = form.documents.requiredByEquipmentType;
  try {
    docsMap = JSON.parse(requiredDocsJson) as Record<string, string[]>;
  } catch {
    // Keep existing docs map if JSON textarea is temporarily invalid.
  }

  const normalized = {
    ...form,
    documents: {
      requiredByEquipmentType: docsMap
    }
  };

  return JSON.stringify(deepSortValue(normalized));
}

function SettingsField({
  title,
  description,
  children,
  className = ""
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border bg-card p-4 ${className}`}>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SettingsToggle({
  checked,
  onChange,
  title,
  description,
  className = ""
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <label className={`flex items-start gap-3 rounded-lg border border-border p-4 ${className}`}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const canUse = hasAnyRole(user, ["ADMIN"]);

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get("tab");
    return tabs.includes(tab as Tab) ? (tab as Tab) : "overview";
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingLdap, setCheckingLdap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [system, setSystem] = useState<SettingsResponse["system"] | null>(null);
  const [form, setForm] = useState<ProjectSettings | null>(null);
  const [requiredDocsJson, setRequiredDocsJson] = useState("{}");
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");
  const [lastLoadedForm, setLastLoadedForm] = useState<ProjectSettings | null>(null);
  const [lastLoadedDocsJson, setLastLoadedDocsJson] = useState<string>("{}");
  const [referenceSection, setReferenceSection] = useState<"catalog" | "attributes">("catalog");
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingRoleUserId, setSavingRoleUserId] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AccessRole>>({});

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const data = (await res.json()) as SettingsResponse;
      if (!res.ok) {
        setError("Не удалось загрузить настройки");
        return;
      }
      setForm(data.settings);
      setSystem(data.system);
      const docsJson = JSON.stringify(data.settings.documents.requiredByEquipmentType, null, 2);
      setRequiredDocsJson(docsJson);
      setLastLoadedForm(data.settings);
      setLastLoadedDocsJson(docsJson);
      setInitialSnapshot(buildSettingsSnapshot(data.settings, docsJson));
    } catch {
      setError("Сетевая ошибка при загрузке настроек");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadManagedUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = (await res.json().catch(() => [])) as ManagedUser[];
      if (!res.ok) {
        notifyError("Не удалось загрузить пользователей");
        return;
      }
      setManagedUsers(data);
      const nextDrafts: Record<string, AccessRole> = {};
      for (const user of data) {
        const preferred = (user.roles.includes("ADMIN")
          ? "ADMIN"
          : user.roles.includes("APPROVER")
            ? "APPROVER"
            : user.roles.includes("EDITOR")
              ? "EDITOR"
              : "VIEWER") as AccessRole;
        nextDrafts[user.id] = preferred;
      }
      setRoleDrafts(nextDrafts);
    } catch {
      notifyError("Сетевая ошибка при загрузке пользователей");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users" && canUse) {
      void loadManagedUsers();
    }
  }, [activeTab, canUse]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", activeTab);
    router.replace(`/settings?${next.toString()}`, { scroll: false });
  }, [activeTab, router, searchParams]);

  const isDirty = Boolean(form && buildSettingsSnapshot(form, requiredDocsJson) !== initialSnapshot);
  const docsValidation = useMemo(() => {
    try {
      const parsed = JSON.parse(requiredDocsJson) as Record<string, unknown>;
      const invalidEntry = Object.entries(parsed).find(([, value]) => !Array.isArray(value) || value.some((item) => typeof item !== "string"));
      if (invalidEntry) {
        return { ok: false, message: `Ключ "${invalidEntry[0]}" должен содержать массив строк` };
      }
      return { ok: true, message: `Правило(а): ${Object.keys(parsed).length}` };
    } catch {
      return { ok: false, message: "Невалидный JSON" };
    }
  }, [requiredDocsJson]);

  useUnsavedChangesGuard({ enabled: isDirty && !saving });

  const setBoolean = (path: "workflow" | "ui" | "integrations", key: string, checked: boolean) => {
    if (!form) return;
    setForm({
      ...form,
      [path]: {
        ...form[path],
        [key]: checked
      }
    });
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    let docsMap: Record<string, string[]> = {};
    try {
      docsMap = JSON.parse(requiredDocsJson) as Record<string, string[]>;
    } catch {
      setSaving(false);
      setError("Поле 'Обязательные документы' должно содержать валидный JSON");
      notifyError("Поле обязательных документов содержит невалидный JSON");
      return;
    }

    try {
      const payload: ProjectSettings = {
        ...form,
        documents: {
          requiredByEquipmentType: docsMap
        }
      };

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as { ok?: boolean; settings?: ProjectSettings; error?: string };

      if (!res.ok) {
        setError(data.error || "Не удалось сохранить настройки");
        notifyError(data.error || "Не удалось сохранить настройки");
        return;
      }

      if (data.settings) {
        const docsJson = JSON.stringify(data.settings.documents.requiredByEquipmentType, null, 2);
        setForm(data.settings);
        setRequiredDocsJson(docsJson);
        setLastLoadedForm(data.settings);
        setLastLoadedDocsJson(docsJson);
        setInitialSnapshot(buildSettingsSnapshot(data.settings, docsJson));
      }

      setMessage("Настройки сохранены");
      notifySuccess("Настройки сохранены");
      void loadSettings();
    } catch {
      setError("Сетевая ошибка при сохранении");
      notifyError("Сетевая ошибка при сохранении настроек");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      if (!isDirty || saving || loading || !docsValidation.ok) return;
      event.preventDefault();
      void save();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDirty, saving, loading, docsValidation.ok, form, requiredDocsJson]);

  const resetChanges = () => {
    if (!lastLoadedForm) return;
    setForm(lastLoadedForm);
    setRequiredDocsJson(lastLoadedDocsJson);
    setMessage(null);
    setError(null);
  };

  const runLdapHealth = async () => {
    setCheckingLdap(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/ldap-health", { cache: "no-store" });
      const data = (await res.json()) as Health;
      setSystem((prev) =>
        prev
          ? {
              ...prev,
              ldapHealth: data
            }
          : prev
      );
      if (!res.ok) {
        setError(data.message || "LDAP недоступен");
        notifyError(data.message || "LDAP недоступен");
      } else {
        notifySuccess("Проверка LDAP выполнена");
      }
    } catch {
      setError("Сетевая ошибка при проверке LDAP");
      notifyError("Сетевая ошибка при проверке LDAP");
    } finally {
      setCheckingLdap(false);
    }
  };

  const saveUserRole = async (user: ManagedUser) => {
    const role = roleDrafts[user.id] || "VIEWER";
    setSavingRoleUserId(user.id);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role })
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        notifyError(data.error || "Не удалось назначить роль");
        return;
      }
      notifySuccess(`Права пользователя ${user.displayName} обновлены: ${role}`);
      await loadManagedUsers();
    } catch {
      notifyError("Сетевая ошибка при назначении роли");
    } finally {
      setSavingRoleUserId(null);
    }
  };

  if (!canUse) {
    return <ErrorState text="Раздел доступен только администраторам." />;
  }

  const formatDocsJson = () => {
    try {
      const parsed = JSON.parse(requiredDocsJson);
      setRequiredDocsJson(JSON.stringify(parsed, null, 2));
      notifySuccess("JSON форматирован");
    } catch {
      notifyError("Невозможно форматировать: JSON невалиден");
    }
  };

  const applyDocsTemplate = () => {
    setRequiredDocsJson(
      JSON.stringify(
        {
          PRESS: ["PASSPORT", "CERTIFICATE"],
          PUMP: ["PASSPORT", "OPERATION_MANUAL"],
          DEFAULT: ["PASSPORT"]
        },
        null,
        2
      )
    );
    notifySuccess("Шаблон правил применен");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Breadcrumbs items={[{ label: "Настройки" }]} />
          <h1 className="mt-4 text-3xl font-bold">Настройки проекта</h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Централизованное управление поведением системы. Здесь вы настраиваете, как работает согласование,
            обязательные документы, LDAP и параметры интерфейса.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="border-0 bg-primary/10 text-primary">Только для администратора</Badge>
          {isDirty ? <Badge className="border-0 bg-status-warning/20 text-status-warning">Есть несохраненные изменения</Badge> : null}
        </div>
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-status-danger">{error}</p>
        </Card>
      ) : null}

      {message ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-status-success">{message}</p>
        </Card>
      ) : null}

      {loading || !form || !system ? (
        <Card className="p-6 text-sm text-muted-foreground">Загрузка настроек...</Card>
      ) : (
        <>
          <Card className="p-0">
            <div className="flex overflow-x-auto border-b border-border">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  className={`border-b-2 px-5 py-3 text-sm font-medium ${
                    activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tabLabels[tab]}
                </button>
              ))}
            </div>
          </Card>

          {activeTab === "overview" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <SummaryCard label="Оборудование" value={system.counts.equipmentTotal} />
                <SummaryCard label="Документы" value={system.counts.documentsTotal} />
                <SummaryCard label="Согласования в очереди" value={system.counts.approvalsPending} />
                <SummaryCard label="Активные пользователи" value={system.counts.usersActive} />
              </div>

              <Card className="space-y-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Состояние системных интеграций</p>
                    <p className="text-sm text-muted-foreground">Проверка БД, провайдера авторизации и LDAP подключения.</p>
                  </div>
                  <Button variant="outline" onClick={() => void runLdapHealth()} disabled={checkingLdap}>
                    {checkingLdap ? "Проверка LDAP..." : "Проверить LDAP"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Система</p>
                    <p className="mt-1 text-sm">Версия приложения: {system.appVersion}</p>
                    <p className="text-sm">Node.js: {system.nodeVersion}</p>
                    <p className="text-sm">Провайдер авторизации: {system.provider}</p>
                    <p className="text-sm">База данных: {system.database}</p>
                  </div>

                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs uppercase text-muted-foreground">LDAP</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge
                        className={`border-0 ${
                          system.ldapHealth.ok ? "bg-status-success/20 text-status-success" : "bg-status-danger/20 text-status-danger"
                        }`}
                      >
                        {system.ldapHealth.ok ? "Доступен" : "Недоступен"}
                      </Badge>
                      {typeof system.ldapHealth.latencyMs === "number" ? (
                        <span className="text-xs text-muted-foreground">{system.ldapHealth.latencyMs} ms</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm">{system.ldapHealth.message}</p>
                    {system.ldapHealth.url ? <p className="text-xs text-muted-foreground">{system.ldapHealth.url}</p> : null}
                  </div>
                </div>
              </Card>

            </div>
          ) : null}

          {activeTab === "general" ? (
            <div className="space-y-3">
              <Card className="p-4">
                <p className="text-sm font-semibold">Превью брендинга и региональных настроек</p>
                <div className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                  <p className="rounded-md border border-border bg-muted/20 px-3 py-2">
                    Компания: <span className="font-semibold">{form.general.companyName || "—"}</span>
                  </p>
                  <p className="rounded-md border border-border bg-muted/20 px-3 py-2">
                    Название системы: <span className="font-semibold">{form.general.siteName || "—"}</span>
                  </p>
                  <p className="rounded-md border border-border bg-muted/20 px-3 py-2">
                    Часовой пояс: <span className="font-semibold">{form.general.timezone || "—"}</span>
                  </p>
                  <p className="rounded-md border border-border bg-muted/20 px-3 py-2">
                    Локаль: <span className="font-semibold">{form.general.locale || "—"}</span>
                  </p>
                </div>
              </Card>
              <Card className="space-y-3 p-4">
              <div className="mb-1">
                <p className="text-sm font-semibold">Общие параметры системы</p>
                <p className="text-xs text-muted-foreground">Определяют идентификацию проекта, язык и стандарты времени.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <SettingsField title="Название компании" description="Отображается в интерфейсе и в системных выгрузках.">
                  <Input
                    value={form.general.companyName}
                    onChange={(e) => setForm({ ...form, general: { ...form.general, companyName: e.target.value } })}
                    placeholder="Например, АО ПромТех"
                  />
                </SettingsField>
                <SettingsField title="Название системы" description="Заголовок платформы для пользователей и администраторов.">
                  <Input
                    value={form.general.siteName}
                    onChange={(e) => setForm({ ...form, general: { ...form.general, siteName: e.target.value } })}
                    placeholder="Например, Система паспортизации DEPS"
                  />
                </SettingsField>
                <SettingsField title="Часовой пояс" description="Используется для отображения времени событий и дедлайнов.">
                  <Input
                    value={form.general.timezone}
                    onChange={(e) => setForm({ ...form, general: { ...form.general, timezone: e.target.value } })}
                    placeholder="Asia/Novosibirsk"
                  />
                </SettingsField>
                <SettingsField title="Локаль" description="Язык и региональные форматы дат/чисел в интерфейсе.">
                  <Input
                    value={form.general.locale}
                    onChange={(e) => setForm({ ...form, general: { ...form.general, locale: e.target.value } })}
                    placeholder="ru-RU"
                  />
                </SettingsField>
              </div>
              </Card>
            </div>
          ) : null}

          {activeTab === "workflow" ? (
            <Card className="space-y-4 p-4">
              <div className="mb-1">
                <p className="text-sm font-semibold">Правила согласования и контроля</p>
                <p className="text-xs text-muted-foreground">Определяют, какие изменения требуют согласования и как ведется контроль истории.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={`border-0 ${form.workflow.equipmentChangesRequireApproval ? "bg-status-success/20 text-status-success" : "bg-muted text-muted-foreground"}`}>
                  Согласование оборудования: {form.workflow.equipmentChangesRequireApproval ? "включено" : "выключено"}
                </Badge>
                <Badge className={`border-0 ${form.workflow.documentChangesRequireApproval ? "bg-status-success/20 text-status-success" : "bg-muted text-muted-foreground"}`}>
                  Согласование документов: {form.workflow.documentChangesRequireApproval ? "включено" : "выключено"}
                </Badge>
                <Badge className={`border-0 ${form.workflow.enforceAuditTrail ? "bg-status-success/20 text-status-success" : "bg-status-warning/20 text-status-warning"}`}>
                  Неизменяемый аудит: {form.workflow.enforceAuditTrail ? "включен" : "ослаблен"}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <SettingsToggle
                  checked={form.workflow.equipmentChangesRequireApproval}
                  onChange={(next) => setBoolean("workflow", "equipmentChangesRequireApproval", next)}
                  title="Изменения оборудования требуют согласования"
                  description="Любое редактирование карточки оборудования будет проходить через очередь согласования."
                />
                <SettingsToggle
                  checked={form.workflow.documentChangesRequireApproval}
                  onChange={(next) => setBoolean("workflow", "documentChangesRequireApproval", next)}
                  title="Изменения документов требуют согласования"
                  description="Добавление новой версии документа будет доступно только после approval."
                />
                <SettingsToggle
                  checked={form.workflow.rollbackEnabledForApprover}
                  onChange={(next) => setBoolean("workflow", "rollbackEnabledForApprover", next)}
                  title="Разрешить откат для согласующего"
                  description="Согласующий сможет откатывать утвержденные изменения до предыдущей версии."
                />
                <SettingsToggle
                  checked={form.workflow.enforceAuditTrail}
                  onChange={(next) => setBoolean("workflow", "enforceAuditTrail", next)}
                  title="Обязательный неизменяемый аудит"
                  description="Все ключевые операции фиксируются в audit log без возможности удаления истории."
                />
              </div>
            </Card>
          ) : null}

          {activeTab === "documents" ? (
            <Card className="space-y-3 p-4">
              <div className="mb-1">
                <p className="text-sm font-semibold">Политика обязательных документов</p>
                <p className="text-xs text-muted-foreground">
                  Здесь задается, какие типы документов обязательны для каждого типа оборудования.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                <div className="xl:col-span-2">
                  <SettingsField
                    title="JSON-правила обязательных документов"
                    description="Ключ = тип оборудования (в UPPERCASE), значение = массив обязательных типов документов."
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Badge className={`border-0 ${docsValidation.ok ? "bg-status-success/20 text-status-success" : "bg-status-danger/20 text-status-danger"}`}>
                        {docsValidation.ok ? "JSON валиден" : "Ошибка JSON"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{docsValidation.message}</span>
                    </div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={formatDocsJson}>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Форматировать JSON
                      </Button>
                      <Button size="sm" variant="outline" onClick={applyDocsTemplate}>
                        Применить шаблон
                      </Button>
                    </div>
                    <Textarea
                      value={requiredDocsJson}
                      onChange={(e) => setRequiredDocsJson(e.target.value)}
                      className="min-h-[320px] font-mono text-xs"
                    />
                  </SettingsField>
                </div>
                <SettingsField
                  title="Что это меняет"
                  description="Эти правила влияют на подсветку отсутствующих документов в карточках оборудования и дашборде."
                >
                  <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                    <p>Пример:</p>
                    <pre className="whitespace-pre-wrap">{`{
  "PRESS": ["PASSPORT", "CERTIFICATE"],
  "DEFAULT": ["PASSPORT", "OPERATION_MANUAL"]
}`}</pre>
                  </div>
                </SettingsField>
              </div>
            </Card>
          ) : null}

          {activeTab === "reference" ? (
            <div className="space-y-4">
              <Card className="p-4">
                <p className="text-sm font-semibold">Управление справочниками</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Сначала обновляйте категории и значения справочника, затем атрибуты типов оборудования, чтобы формы использовали актуальные данные.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant={referenceSection === "catalog" ? "default" : "outline"} onClick={() => setReferenceSection("catalog")}>
                    Категории и значения
                  </Button>
                  <Button size="sm" variant={referenceSection === "attributes" ? "default" : "outline"} onClick={() => setReferenceSection("attributes")}>
                    Атрибуты типов
                  </Button>
                </div>
              </Card>
              {referenceSection === "catalog" ? <ReferenceCatalogManager /> : <EquipmentTypeAttributesManager />}
            </div>
          ) : null}

          {activeTab === "integrations" ? (
            <Card className="space-y-3 p-4">
              <div className="mb-1">
                <p className="text-sm font-semibold">Интеграции и хранилище</p>
                <p className="text-xs text-muted-foreground">Параметры подключения к LDAP/AD и режим хранения файлов.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/20 p-3">
                <Badge className={`border-0 ${form.integrations.ldapEnabled ? "bg-status-success/20 text-status-success" : "bg-muted text-muted-foreground"}`}>
                  LDAP: {form.integrations.ldapEnabled ? "включен" : "выключен"}
                </Badge>
                <Badge
                  className={`border-0 ${
                    system.ldapHealth.ok ? "bg-status-success/20 text-status-success" : "bg-status-danger/20 text-status-danger"
                  }`}
                >
                  Проверка: {system.ldapHealth.ok ? "доступен" : "недоступен"}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => void runLdapHealth()} disabled={checkingLdap}>
                  {checkingLdap ? "Проверка..." : "Проверить LDAP"}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <SettingsToggle
                  checked={form.integrations.ldapEnabled}
                  onChange={(next) => setBoolean("integrations", "ldapEnabled", next)}
                  title="Включить LDAP авторизацию"
                  description="При включении система будет использовать LDAP-коннектор в auth-слое."
                  className="md:col-span-2"
                />
                <SettingsField title="LDAP URL" description="Адрес LDAP/AD сервера для подключения.">
                  <Input
                    value={form.integrations.ldapUrl}
                    onChange={(e) => setForm({ ...form, integrations: { ...form.integrations, ldapUrl: e.target.value } })}
                    placeholder="ldap://localhost:389"
                    disabled={!form.integrations.ldapEnabled}
                  />
                </SettingsField>
                <SettingsField title="Базовый DN" description="Базовый DN для поиска записей в каталоге.">
                  <Input
                    value={form.integrations.ldapBaseDn}
                    onChange={(e) => setForm({ ...form, integrations: { ...form.integrations, ldapBaseDn: e.target.value } })}
                    placeholder="dc=enterprise,dc=local"
                    disabled={!form.integrations.ldapEnabled}
                  />
                </SettingsField>
                <SettingsField title="User Базовый DN" description="Контейнер пользователей, используемый при логине.">
                  <Input
                    value={form.integrations.ldapUserBaseDn}
                    onChange={(e) => setForm({ ...form, integrations: { ...form.integrations, ldapUserBaseDn: e.target.value } })}
                    placeholder="ou=users,dc=enterprise,dc=local"
                    disabled={!form.integrations.ldapEnabled}
                  />
                </SettingsField>
                <SettingsField title="Group Базовый DN" description="Контейнер групп, используемый для маппинга ролей.">
                  <Input
                    value={form.integrations.ldapGroupBaseDn}
                    onChange={(e) => setForm({ ...form, integrations: { ...form.integrations, ldapGroupBaseDn: e.target.value } })}
                    placeholder="ou=groups,dc=enterprise,dc=local"
                    disabled={!form.integrations.ldapEnabled}
                  />
                </SettingsField>
                <SettingsField
                  title="Режим локального хранения файлов"
                  description="Выберите, куда сохранять загруженные файлы: в каталог uploads проекта или на сетевой диск."
                  className="md:col-span-2"
                >
                  <AppSelect
                    value={form.storage.localMode}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        storage: {
                          ...form.storage,
                          localMode: e.target.value as ProjectSettings["storage"]["localMode"]
                        }
                      })
                    }
                  >
                    <option value="UPLOADS">Каталог uploads (data/uploads)</option>
                    <option value="NETWORK_DRIVE">Сетевой диск</option>
                  </AppSelect>
                </SettingsField>
                <SettingsField
                  title="Путь сетевого диска"
                  description="Используется, когда выбран режим «Сетевой диск». Пример: \\fileserver\\deps-docs или D:\\docs\\deps."
                  className="md:col-span-2"
                >
                  <Input
                    value={form.storage.networkDiskPath}
                    onChange={(e) => setForm({ ...form, storage: { ...form.storage, networkDiskPath: e.target.value } })}
                    placeholder="\\\\fileserver\\deps-docs"
                    disabled={form.storage.localMode !== "NETWORK_DRIVE"}
                  />
                </SettingsField>
              </div>
            </Card>
          ) : null}

          {activeTab === "users" ? (
            <Card className="space-y-4 p-4">
              <div className="mb-1 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Назначение ролей пользователям</p>
                  <p className="text-xs text-muted-foreground">
                    Выберите роль и сохраните. Назначение выполняется на сервере и применяется к API-правам.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadManagedUsers()} disabled={loadingUsers || !!savingRoleUserId}>
                  Обновить список
                </Button>
              </div>

              {loadingUsers ? (
                <p className="text-sm text-muted-foreground">Загрузка пользователей...</p>
              ) : managedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Активные пользователи не найдены.</p>
              ) : (
                <div className="space-y-2">
                  {managedUsers.map((managedUser) => (
                    <div key={managedUser.id} className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 md:grid-cols-[minmax(220px,1fr)_180px_130px] md:items-center">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{managedUser.displayName}</p>
                        <p className="text-xs text-muted-foreground">{managedUser.email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Текущие роли: {managedUser.roles.join(", ") || "нет"}</p>
                      </div>
                      <AppSelect
                        value={roleDrafts[managedUser.id] || "VIEWER"}
                        onChange={(e) =>
                          setRoleDrafts((prev) => ({
                            ...prev,
                            [managedUser.id]: e.target.value as AccessRole
                          }))
                        }
                        disabled={!!savingRoleUserId}
                      >
                        <option value="VIEWER">VIEWER</option>
                        <option value="EDITOR">EDITOR</option>
                        <option value="APPROVER">APPROVER</option>
                        <option value="ADMIN">ADMIN</option>
                      </AppSelect>
                      <Button
                        onClick={() => void saveUserRole(managedUser)}
                        disabled={!!savingRoleUserId || !roleDrafts[managedUser.id]}
                      >
                        {savingRoleUserId === managedUser.id ? "Сохранение..." : "Выдать роль"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : null}

          {activeTab === "ui" ? (
            <Card className="space-y-4 p-4">
              <div className="mb-1">
                <p className="text-sm font-semibold">Параметры интерфейса</p>
                <p className="text-xs text-muted-foreground">Настройки отображения таблиц и форматов данных для пользователей.</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                <p>
                  Превью даты:{" "}
                  <span className="font-semibold">
                    {new Date().toLocaleDateString(form.general.locale || "ru-RU", { timeZone: form.general.timezone || "UTC" })}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Формат маски: {form.ui.dateFormat || "dd.MM.yyyy"} • Размер страницы: {form.ui.defaultPageSize}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <SettingsField title="Размер страницы таблиц" description="Количество строк по умолчанию в реестрах и журналах.">
                  <Input
                    type="number"
                    min={5}
                    max={100}
                    value={form.ui.defaultPageSize}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        ui: {
                          ...form.ui,
                          defaultPageSize: Math.min(100, Math.max(5, Number(e.target.value || 20)))
                        }
                      })
                    }
                    placeholder="20"
                  />
                </SettingsField>
                <SettingsField title="Формат даты" description="Единый формат отображения даты в системе.">
                  <Input
                    value={form.ui.dateFormat}
                    onChange={(e) => setForm({ ...form, ui: { ...form.ui, dateFormat: e.target.value } })}
                    placeholder="dd.MM.yyyy"
                  />
                </SettingsField>
                <SettingsToggle
                  checked={form.ui.desktopFirst}
                  onChange={(next) => setBoolean("ui", "desktopFirst", next)}
                  title="Desktop-first режим"
                  description="Основной приоритет компоновки интерфейса - рабочие станции и широкие экраны."
                  className="md:col-span-2"
                />
              </div>
            </Card>
          ) : null}

          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {isDirty
                ? "Есть несохраненные изменения. Ctrl+S (Cmd+S) сохраняет текущие настройки."
                : "Изменений нет. Настройки синхронизированы с сервером."}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void loadSettings()} disabled={saving || loading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Обновить
              </Button>
              <Button variant="outline" onClick={resetChanges} disabled={!isDirty || saving}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Отменить изменения
              </Button>
              <Button onClick={() => void save()} disabled={saving || !isDirty || !docsValidation.ok}>
                {saving ? "Сохранение..." : "Сохранить настройки"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
