"use client";

import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";

type Item = {
  id: string;
  equipmentTitle: string;
  startAt: string;
  endAt?: string;
  type: string;
  status: string;
  responsible?: string;
  subdivision?: string;
  jiraIssueKey?: string;
  description?: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function statusTone(status: string) {
  if (/cancel|canceled|cancelled|отмен/i.test(status)) return "bg-slate-100 text-slate-700 border-slate-200";
  if (/resolved|done|closed|решен|заверш/i.test(status)) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (/ожидание поддержки|waiting.*support|support/i.test(status)) return "bg-violet-100 text-violet-700 border-violet-200";
  if (/ожидание|pending|queued/i.test(status)) return "bg-blue-100 text-blue-700 border-blue-200";
  if (/progress|в работе|in progress/i.test(status)) return "bg-amber-100 text-amber-800 border-amber-200";
  if (/blocked|блок/i.test(status)) return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-sky-100 text-sky-700 border-sky-200";
}

function formatDuration(start: string, end?: string) {
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "Не указано";
  const mins = Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
  return `${Math.floor(mins / 60)} ч ${(mins % 60).toString().padStart(2, "0")} мин`;
}

export default function DowntimePage() {
  const [date, setDate] = useState(today());
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadDay() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analytics/downtime/day?date=${date}`);
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error || "Ошибка загрузки");
      setItems(data.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDay();
  }, [date]);

  if (loading) return <LoadingState text="Загрузка событий простоя..." />;
  if (error) return <ErrorState text={error} onRetry={loadDay} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: "Простои" }]} />
          <h1 className="mt-4 text-3xl font-bold">Простои оборудования</h1>
          <p className="mt-1 text-muted-foreground">Оперативный список событий по выбранной дате.</p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Input type="date" className="w-44" value={date} onChange={(e) => setDate(e.target.value)} />
            <Button variant="outline" onClick={loadDay}>Обновить</Button>
          </div>
          <span className="text-sm text-muted-foreground">Событий: {items.length}</span>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">События за {new Date(date).toLocaleDateString("ru-RU")}</h2>
        </div>
        <div className="mt-3">
          {items.length === 0 ? (
            <EmptyState text="Нет данных за выбранный день." />
          ) : (
            <div className="divide-y divide-border">
              {items.map((x) => (
                <div key={x.id} className="flex items-start justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{x.equipmentTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(x.startAt).toLocaleString("ru-RU")} — {x.endAt ? new Date(x.endAt).toLocaleString("ru-RU") : "в процессе"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {x.type} • {x.subdivision || "Не указана"} • {x.responsible || "Не указан"}
                    </p>
                    {x.description && <p className="mt-1 text-xs text-muted-foreground">{x.description}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={`rounded-full border ${statusTone(x.status)}`}>{x.status}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDuration(x.startAt, x.endAt)}</span>
                    {x.jiraIssueKey && <span className="font-mono text-xs text-primary">{x.jiraIssueKey}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
