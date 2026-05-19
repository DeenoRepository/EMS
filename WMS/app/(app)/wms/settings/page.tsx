"use client";

import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/client/notify";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useCurrentUser } from "@/lib/client/use-current-user";

type Settings = {
  general: { companyName: string; systemName: string; timezone: string; locale: string };
  workflow: { autoReserveOnRequest: boolean; enforceAuditTrail: boolean; allowNegativeAdjustments: boolean };
  notifications: { emailEnabled: boolean; digestHour: number };
  integrations: { mmsApiBaseUrl: string; epsApiBaseUrl: string };
  security: { sessionTimeoutMinutes: number; ipWhitelist: string[] };
};
type SettingsResponse = { settings: Settings; system: { updatedAt: string | null; updatedBy: string | null } };

export default function WmsSettingsPage() {
  const { user } = useCurrentUser();
  const isAdmin = (user?.roles || []).includes("ADMIN");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ipText, setIpText] = useState("");

  const snapshot = useMemo(() => (form ? JSON.stringify(form) : ""), [form]);
  const isDirty = !!form && snapshot !== initialSnapshot;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const settingsRes = await fetch("/api/wms/settings", { cache: "no-store" });
      if (!settingsRes.ok) {
        setError("Не удалось загрузить настройки проекта.");
        return;
      }
      const data = (await settingsRes.json()) as SettingsResponse;
      setForm(data.settings);
      const snap = JSON.stringify(data.settings);
      setInitialSnapshot(snap);
      setUpdatedAt(data.system.updatedAt);
      setUpdatedBy(data.system.updatedBy);
      setIpText((data.settings.security.ipWhitelist || []).join("\n"));
    } catch {
      setError("Сетевая ошибка загрузки настроек.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!form || !isAdmin) return;
    setSaving(true);
    try {
      const payload: Settings = {
        ...form,
        security: {
          ...form.security,
          ipWhitelist: ipText.split("\n").map((x) => x.trim()).filter(Boolean)
        }
      };
      const res = await fetch("/api/wms/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifyError((data as { error?: string }).error || "Не удалось сохранить настройки.");
        return;
      }
      notifySuccess("Настройки проекта сохранены.");
      await load();
    } catch {
      notifyError("Сетевая ошибка сохранения настроек.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState text="Загрузка настроек..." />;
  if (error || !form) return <ErrorState text={error || "Не удалось загрузить данные."} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "WMS", href: "/wms" }, { label: "Настройки" }]} />
        <h1 className="mt-4 text-3xl font-bold">Настройки проекта</h1>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm text-muted-foreground">
          Последнее обновление: {updatedAt ? new Date(updatedAt).toLocaleString("ru-RU") : "—"} {updatedBy ? `· ${updatedBy}` : ""}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()}>Обновить</Button>
          <Button disabled={!isAdmin || !isDirty || saving} onClick={() => void save()}>
            {saving ? "Сохранение..." : "Сохранить настройки"}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="text-base font-semibold">Общие параметры</h2>
          <Input value={form.general.companyName} onChange={(e) => setForm((p) => p ? { ...p, general: { ...p.general, companyName: e.target.value } } : p)} placeholder="Название компании" />
          <Input value={form.general.systemName} onChange={(e) => setForm((p) => p ? { ...p, general: { ...p.general, systemName: e.target.value } } : p)} placeholder="Название системы" />
          <Input value={form.general.timezone} onChange={(e) => setForm((p) => p ? { ...p, general: { ...p.general, timezone: e.target.value } } : p)} placeholder="Часовой пояс" />
          <Input value={form.general.locale} onChange={(e) => setForm((p) => p ? { ...p, general: { ...p.general, locale: e.target.value } } : p)} placeholder="Локаль" />
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="text-base font-semibold">Процессы и контроль</h2>
          <label className="flex items-center justify-between text-sm"><span>Авто-резерв при заявке</span><input type="checkbox" checked={form.workflow.autoReserveOnRequest} onChange={(e) => setForm((p) => p ? { ...p, workflow: { ...p.workflow, autoReserveOnRequest: e.target.checked } } : p)} /></label>
          <label className="flex items-center justify-between text-sm"><span>Неизменяемый аудит</span><input type="checkbox" checked={form.workflow.enforceAuditTrail} onChange={(e) => setForm((p) => p ? { ...p, workflow: { ...p.workflow, enforceAuditTrail: e.target.checked } } : p)} /></label>
          <label className="flex items-center justify-between text-sm"><span>Разрешить отрицательные корректировки</span><input type="checkbox" checked={form.workflow.allowNegativeAdjustments} onChange={(e) => setForm((p) => p ? { ...p, workflow: { ...p.workflow, allowNegativeAdjustments: e.target.checked } } : p)} /></label>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="text-base font-semibold">Интеграции</h2>
          <Input value={form.integrations.mmsApiBaseUrl} onChange={(e) => setForm((p) => p ? { ...p, integrations: { ...p.integrations, mmsApiBaseUrl: e.target.value } } : p)} placeholder="MMS API URL" />
          <Input value={form.integrations.epsApiBaseUrl} onChange={(e) => setForm((p) => p ? { ...p, integrations: { ...p.integrations, epsApiBaseUrl: e.target.value } } : p)} placeholder="EPS API URL" />
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="text-base font-semibold">Безопасность и уведомления</h2>
          <label className="flex items-center justify-between text-sm"><span>Email-уведомления</span><input type="checkbox" checked={form.notifications.emailEnabled} onChange={(e) => setForm((p) => p ? { ...p, notifications: { ...p.notifications, emailEnabled: e.target.checked } } : p)} /></label>
          <Input type="number" value={String(form.notifications.digestHour)} onChange={(e) => setForm((p) => p ? { ...p, notifications: { ...p.notifications, digestHour: Number(e.target.value || 0) } } : p)} placeholder="Час digest (0-23)" />
          <Input type="number" value={String(form.security.sessionTimeoutMinutes)} onChange={(e) => setForm((p) => p ? { ...p, security: { ...p.security, sessionTimeoutMinutes: Number(e.target.value || 0) } } : p)} placeholder="Таймаут сессии (мин)" />
          <textarea className="min-h-28 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" placeholder="IP whitelist (по одному на строку)" value={ipText} onChange={(e) => setIpText(e.target.value)} />
        </Card>
      </div>
    </div>
  );
}
