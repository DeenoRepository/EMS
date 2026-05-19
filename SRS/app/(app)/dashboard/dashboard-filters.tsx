"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  subdivisions: string[];
  initialSubdivision: string;
};

export function DashboardFilters(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);

  const activeCount = useMemo(
    () => [props.initialSubdivision].filter(Boolean).length,
    [props.initialSubdivision]
  );

  const update = (name: string, value: string | boolean) => {
    const q = new URLSearchParams(searchParams.toString());
    if (typeof value === "boolean") {
      if (value) q.set(name, "1");
      else q.delete(name);
    } else {
      if (value) q.set(name, value);
      else q.delete(name);
    }
    router.replace(`${pathname}?${q.toString()}`);
  };

  const reset = () => {
    const q = new URLSearchParams(searchParams.toString());
    q.delete("subdivision");
    router.replace(`${pathname}?${q.toString()}`);
  };

  return (
    <section className="card mt-4 space-y-3" aria-label="Фильтр панели управления">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/20 p-3">
        <div>
          <div className="text-sm font-semibold">Фильтр</div>
          <div className="text-[11px] text-muted-foreground">Параметры применяются автоматически при изменении</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border px-2 py-1">Активно: {activeCount}</span>
          <button className="rounded border px-3 py-1.5 hover:bg-muted/50" onClick={() => setIsOpen((prev) => !prev)}>
            {isOpen ? "Свернуть фильтр" : "Развернуть фильтр"}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="rounded border p-3">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-xs md:col-span-2">
              <span className="mb-1 block font-medium">Группа обслуживания</span>
              <select className="w-full rounded border px-3 py-2" value={props.initialSubdivision} onChange={(e) => update("subdivision", e.target.value)}>
                <option value="">Все группы</option>
                {props.subdivisions.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-3 flex items-center justify-end border-t pt-3">
            <button className="rounded border px-4 py-2 text-sm" onClick={reset}>Сбросить фильтры</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
