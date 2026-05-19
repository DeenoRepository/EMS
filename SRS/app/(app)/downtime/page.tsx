"use client";

import { useEffect, useState } from "react";

type Item = {
  id: string;
  equipmentTitle: string;
  startAt: string;
  endAt?: string;
  type: string;
  status: string;
  responsible?: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
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

  return (
    <>
      <header className="header rounded-xl border bg-white p-4">
        <h1 className="title">Простои оборудования</h1>
        <p className="mt-1 text-sm text-muted-foreground">Оперативный список событий по выбранной дате.</p>
      </header>

      <section className="card mt-4 space-y-3">
        <div className="flex items-center gap-2">
          <input type="date" className="rounded border px-3 py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="rounded border px-3 py-2 text-sm" onClick={loadDay} disabled={loading}>{loading ? "Загрузка..." : "Обновить"}</button>
          <span className="text-xs text-muted-foreground">Событий: {items.length}</span>
        </div>
        {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
      </section>

      <section className="card mt-4">
        <div className="space-y-2">
          {items.map((x) => (
            <div key={x.id} className="rounded border p-3 text-xs">
              <div className="font-semibold">{x.equipmentTitle}</div>
              <div className="mt-1 text-muted-foreground">
                {new Date(x.startAt).toLocaleString("ru-RU")} - {x.endAt ? new Date(x.endAt).toLocaleString("ru-RU") : "в процессе"}
              </div>
              <div className="mt-1 text-muted-foreground">Тип: {x.type} | Статус: {x.status} | Исполнитель: {x.responsible || "-"}</div>
            </div>
          ))}
          {items.length === 0 ? <div className="text-xs text-muted-foreground">Нет данных за выбранный день.</div> : null}
        </div>
      </section>
    </>
  );
}

