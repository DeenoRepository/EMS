"use client";

import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImportStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/states/empty-state";

type JiraSettingsPayload = {
  apiUrl: string;
  username: string;
  autoImportEnabled: boolean;
  autoImportPeriodMinutes?: number;
  filterIds: string[];
};

type ImportRun = {
  id: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  startedAt: string;
  finishedAt?: string | null;
  itemsTotal: number;
  itemsLoaded: number;
  errorText?: string | null;
  initiatedBy?: string | null;
};

function normalizeFilterIds(raw: string): string[] {
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function SettingsPage() {
  const [apiUrl, setApiUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [filterIdsRaw, setFilterIdsRaw] = useState("");
  const [autoImportEnabled, setAutoImportEnabled] = useState(false);
  const [period, setPeriod] = useState(60);
  const [runs, setRuns] = useState<ImportRun[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusText, setStatusText] = useState("");

  const filterIds = useMemo(() => normalizeFilterIds(filterIdsRaw), [filterIdsRaw]);

  const payload: JiraSettingsPayload = {
    apiUrl,
    username,
    autoImportEnabled,
    autoImportPeriodMinutes: autoImportEnabled ? period : undefined,
    filterIds,
  };

  const safeJson = async (res: Response) => {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  };

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings/jira", { cache: "no-store" });
      const data = await safeJson(res);
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Не удалось загрузить настройки Jira");
      }

      if (data.data) {
        setApiUrl(data.data.apiUrl || "");
        setUsername(data.data.username || "");
        setFilterIdsRaw((data.data.filterIds || []).join(", "));
        setAutoImportEnabled(Boolean(data.data.autoImportEnabled));
        setPeriod(Number(data.data.autoImportPeriodMinutes || 60));
      }
    } catch (e) {
      setStatusText(e instanceof Error ? e.message : "Ошибка загрузки настроек");
    } finally {
      setIsLoading(false);
    }
  };

  const loadRuns = async () => {
    const res = await fetch("/api/import/jira", { cache: "no-store" });
    const data = await safeJson(res);
    if (res.ok && data.ok !== false && Array.isArray(data.data)) {
      setRuns(data.data);
    }
  };

  useEffect(() => {
    void (async () => {
      await Promise.all([loadSettings(), loadRuns()]);
    })();
  }, []);

  const saveJira = async () => {
    setIsSaving(true);
    setStatusText("");
    try {
      const res = await fetch("/api/settings/jira", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (!res.ok || data.ok === false) {
        const fallback = raw ? `HTTP ${res.status}: ${raw.slice(0, 300)}` : `HTTP ${res.status}`;
        throw new Error(data?.error || fallback || "Ошибка сохранения");
      }
      setStatusText("Настройки Jira сохранены");
      await loadRuns();
    } catch (e) {
      setStatusText(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  const testJira = async () => {
    setIsTesting(true);
    setStatusText("");
    try {
      const passwordToUse = password.trim();
      if (!passwordToUse) {
        throw new Error("Для теста соединения введите пароль");
      }

      const res = await fetch("/api/settings/jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl,
          username,
          password: passwordToUse,
          filterIds,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Ошибка теста соединения");
      }
      setStatusText(`Соединение успешно. Найдено задач: ${data.data?.foundIssues ?? 0}`);
    } catch (e) {
      setStatusText(e instanceof Error ? e.message : "Ошибка теста соединения");
    } finally {
      setIsTesting(false);
    }
  };

  const runJiraImport = async () => {
    setIsImporting(true);
    setStatusText("");
    try {
      const passwordToUse = password.trim();
      if (!passwordToUse) throw new Error("Для импорта введите пароль");
      const res = await fetch("/api/import/jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordToUse }),
      });
      const data = await safeJson(res);
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Ошибка импорта");
      }
      setStatusText(`Импорт завершен: загружено ${data.data?.itemsLoaded ?? 0} из ${data.data?.itemsTotal ?? 0}`);
      await loadRuns();
    } catch (e) {
      setStatusText(e instanceof Error ? e.message : "Ошибка импорта");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Настройки" }]} />
        <h1 className="mt-4 text-3xl font-bold">Настройки</h1>
        <p className="mt-1 text-muted-foreground">Подключение к Jira API, тест соединения и запуск импорта заявок.</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Интеграция Jira</h2>
            <p className="text-sm text-muted-foreground">Параметры подключения и автоимпорт.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">API URL</span>
            <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://your-domain.atlassian.net" disabled={isLoading} />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Username</span>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="jira-user" disabled={isLoading} />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-muted-foreground">Пароль</span>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль учетной записи Jira" disabled={isLoading} type="password" />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-muted-foreground">Filter IDs (через запятую)</span>
            <Input value={filterIdsRaw} onChange={(e) => setFilterIdsRaw(e.target.value)} placeholder="12345, 34567" disabled={isLoading} />
          </label>
        </div>

        <div className="mt-4 grid gap-3 rounded-lg border p-3 md:grid-cols-[auto,160px,1fr] md:items-center">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoImportEnabled} onChange={(e) => setAutoImportEnabled(e.target.checked)} />
            Автоимпорт
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Интервал, мин</span>
            <Input type="number" min={5} step={5} value={period} onChange={(e) => setPeriod(Number(e.target.value || 60))} disabled={!autoImportEnabled} />
          </label>
          <div className="text-xs text-muted-foreground">Для MVP автоимпорт сохраняется в настройках и может использоваться фоновым планировщиком.</div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={saveJira} disabled={isSaving || isLoading}>
            {isSaving ? "Сохранение..." : "Сохранить"}
          </Button>
          <Button variant="outline" onClick={testJira} disabled={isTesting || isLoading}>
            {isTesting ? "Проверка..." : "Проверить соединение"}
          </Button>
          <Button variant="outline" onClick={runJiraImport} disabled={isImporting || isLoading}>
            {isImporting ? "Импорт..." : "Запустить импорт"}
          </Button>
        </div>

        {statusText && <div className="mt-3 rounded border bg-muted/50 px-3 py-2 text-sm">{statusText}</div>}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">История импортов Jira</h2>
          <Button variant="outline" size="sm" onClick={loadRuns}>Обновить</Button>
        </div>
        <div className="mt-3">
          {runs.length === 0 ? (
            <EmptyState text="История импортов пока пуста." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Старт</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Статус</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Загружено</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Инициатор</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Ошибка</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b">
                      <td className="p-4 align-middle whitespace-nowrap">{new Date(run.startedAt).toLocaleString("ru-RU")}</td>
                      <td className="p-4 align-middle"><ImportStatusBadge status={run.status} /></td>
                      <td className="p-4 align-middle">{run.itemsLoaded} / {run.itemsTotal}</td>
                      <td className="p-4 align-middle">{run.initiatedBy || "-"}</td>
                      <td className="p-4 align-middle text-rose-700">{run.errorText || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
