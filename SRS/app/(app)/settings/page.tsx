"use client";

import { useEffect, useMemo, useState } from "react";

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
    <>
      <header className="header rounded-xl border bg-white p-4">
        <h1 className="title">Настройки</h1>
        <p className="mt-1 text-sm text-muted-foreground">Подключение к Jira API, тест соединения и запуск импорта заявок.</p>
      </header>

      <section className="card mt-4 space-y-4">
        <h2 className="text-sm font-semibold">Интеграция Jira</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">API URL</span>
            <input
              className="w-full rounded border px-3 py-2"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://your-domain.atlassian.net"
              disabled={isLoading}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Username</span>
            <input
              className="w-full rounded border px-3 py-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="jira-user"
              disabled={isLoading}
            />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-muted-foreground">Пароль</span>
            <input
              className="w-full rounded border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль учетной записи Jira"
              disabled={isLoading}
              type="password"
            />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-muted-foreground">Filter IDs (через запятую)</span>
            <input
              className="w-full rounded border px-3 py-2"
              value={filterIdsRaw}
              onChange={(e) => setFilterIdsRaw(e.target.value)}
              placeholder="12345, 34567"
              disabled={isLoading}
            />
          </label>
        </div>

        <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[auto,160px,1fr] md:items-center">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoImportEnabled} onChange={(e) => setAutoImportEnabled(e.target.checked)} />
            Автоимпорт
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Интервал, мин</span>
            <input
              className="w-full rounded border px-3 py-2"
              type="number"
              min={5}
              step={5}
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value || 60))}
              disabled={!autoImportEnabled}
            />
          </label>
          <div className="text-xs text-muted-foreground">Для MVP автоимпорт сохраняется в настройках и может использоваться фоновым планировщиком.</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-60" onClick={saveJira} disabled={isSaving || isLoading}>
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
          <button className="rounded border px-3 py-2 disabled:opacity-60" onClick={testJira} disabled={isTesting || isLoading}>
            {isTesting ? "Проверка..." : "Проверить соединение"}
          </button>
          <button className="rounded border px-3 py-2 disabled:opacity-60" onClick={runJiraImport} disabled={isImporting || isLoading}>
            {isImporting ? "Импорт..." : "Запустить импорт"}
          </button>
        </div>

        {statusText ? <div className="rounded border bg-muted/50 px-3 py-2 text-sm">{statusText}</div> : null}
      </section>

      <section className="card mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">История импортов Jira</h2>
          <button className="rounded border px-3 py-1.5 text-xs" onClick={loadRuns}>Обновить</button>
        </div>
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-2 py-2 text-left">Старт</th>
                <th className="px-2 py-2 text-left">Статус</th>
                <th className="px-2 py-2 text-left">Загружено</th>
                <th className="px-2 py-2 text-left">Инициатор</th>
                <th className="px-2 py-2 text-left">Ошибка</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t">
                  <td className="px-2 py-2 whitespace-nowrap">{new Date(run.startedAt).toLocaleString("ru-RU")}</td>
                  <td className="px-2 py-2">{run.status}</td>
                  <td className="px-2 py-2">{run.itemsLoaded} / {run.itemsTotal}</td>
                  <td className="px-2 py-2">{run.initiatedBy || "-"}</td>
                  <td className="px-2 py-2 text-rose-700">{run.errorText || "-"}</td>
                </tr>
              ))}
              {runs.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-center text-muted-foreground" colSpan={5}>История импортов пока пуста</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
