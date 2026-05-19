export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getMockIssues } from "@/lib/server/mock-jira";
import { DashboardFilters } from "./dashboard-filters";

type DashboardRow = {
  id: string;
  key: string;
  equipment: string;
  status: string;
  type: string;
  startAt: Date;
  endAt: Date | null;
  responsible: string;
  subdivision: string;
  isInProgress: boolean;
};

type MonthMetric = { label: string; events: number; sla: number; mttr: number };
type WorkTypeMetric = { label: string; repairs: number; setups: number };

function parseRangeDays(raw?: string) {
  if (!raw) return 30;
  const n = Number(raw);
  if (Number.isNaN(n) || n <= 0) return 30;
  return Math.min(365, Math.floor(n));
}

function getParam(searchParams: Record<string, string | string[] | undefined> | undefined, key: string) {
  const raw = searchParams?.[key];
  return typeof raw === "string" ? raw.trim() : "";
}

function prettyDate(d: Date) {
  return d.toLocaleString("ru-RU", { hour12: false });
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
}

function hoursBetween(start: Date, end: Date | null) {
  const finish = end ?? new Date();
  return Math.max(0, (finish.getTime() - start.getTime()) / 3_600_000);
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

function buildHalfYearMetrics(rows: DashboardRow[], slaTargetHours = 4): MonthMetric[] {
  const now = new Date();
  const months: Array<{ label: string; start: Date; end: Date }> = [];
  for (let i = 5; i >= 0; i -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    months.push({ label: monthLabel(start), start, end });
  }
  return months.map((m) => {
    const monthRows = rows.filter((r) => r.startAt >= m.start && r.startAt <= m.end);
    const events = monthRows.length;
    const mttr = events > 0 ? monthRows.reduce((acc, r) => acc + hoursBetween(r.startAt, r.endAt), 0) / events : 0;
    const slaHit = monthRows.filter((r) => hoursBetween(r.startAt, r.endAt) <= slaTargetHours).length;
    const sla = events > 0 ? (slaHit / events) * 100 : 0;
    return { label: m.label, events, sla, mttr };
  });
}

function buildHalfYearWorkTypeMetrics(rows: DashboardRow[]): WorkTypeMetric[] {
  const now = new Date();
  const months: Array<{ label: string; start: Date; end: Date }> = [];
  for (let i = 5; i >= 0; i -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    months.push({ label: monthLabel(start), start, end });
  }
  return months.map((m) => {
    const monthRows = rows.filter((r) => r.startAt >= m.start && r.startAt <= m.end);
    const repairs = monthRows.filter((r) => /ремонт|repair/i.test(r.type)).length;
    const setups = monthRows.filter((r) => /настрой|setup|config/i.test(r.type)).length;
    return { label: m.label, repairs, setups };
  });
}

function LineChart({
  labels,
  values,
  strokeClass,
  pointColor,
  valueFormatter,
  legendLabel,
  legendColorClass,
}: {
  labels: string[];
  values: number[];
  strokeClass: string;
  pointColor: string;
  valueFormatter: (v: number) => string;
  legendLabel: string;
  legendColorClass: string;
}) {
  const w = 560;
  const h = 180;
  const p = 24;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = Math.max(1, max - min);
  const stepX = values.length > 1 ? (w - p * 2) / (values.length - 1) : 0;
  const points = values.map((v, i) => ({
    x: p + i * stepX,
    y: h - p - ((v - min) / span) * (h - p * 2),
    v,
  }));
  const linePath = points.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");

  return (
    <div className="rounded border bg-gradient-to-b from-slate-50/70 to-white p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
        <span className={`h-2 w-2 rounded-full ${legendColorClass}`} />
        <span>{legendLabel}</span>
      </div>
      <div className="h-48">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full">
          {Array.from({ length: 5 }).map((_, i) => {
            const y = p + ((h - p * 2) / 4) * i;
            return <line key={`g-${i}`} x1={p} y1={y} x2={w - p} y2={y} stroke="currentColor" className="text-slate-200" strokeWidth="1" />;
          })}
          <line x1={p} y1={h - p} x2={w - p} y2={h - p} stroke="currentColor" className="text-slate-300" strokeWidth="1" />
          <path d={linePath} className={strokeClass} fill="none" strokeWidth="3" strokeLinecap="round" />
          {points.map((pt, i) => (
            <g key={`pt-${labels[i]}-${i}`}>
              <circle cx={pt.x} cy={pt.y} r="4" className="fill-white stroke-slate-300" />
              <circle cx={pt.x} cy={pt.y} r="2.4" fill={pointColor} />
              <text x={pt.x} y={pt.y - 10} textAnchor="middle" className="fill-slate-600 text-[9px]">
                {valueFormatter(pt.v)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-2 grid grid-cols-6 gap-1 text-center text-[10px] font-medium text-slate-500">
        {labels.map((label) => <div key={label}>{label}</div>)}
      </div>
    </div>
  );
}

function MultiLineChart({
  labels,
  seriesA,
  seriesB,
  colorA,
  colorB,
}: {
  labels: string[];
  seriesA: number[];
  seriesB: number[];
  colorA: string;
  colorB: string;
}) {
  const w = 560;
  const h = 180;
  const p = 24;
  const max = Math.max(1, ...seriesA, ...seriesB);
  const span = Math.max(1, max);
  const stepX = labels.length > 1 ? (w - p * 2) / (labels.length - 1) : 0;

  const mkPts = (vals: number[]) => vals.map((v, i) => ({
    x: p + i * stepX,
    y: h - p - (v / span) * (h - p * 2),
  }));
  const ptsA = mkPts(seriesA);
  const ptsB = mkPts(seriesB);
  const mkPath = (pts: Array<{ x: number; y: number }>) => pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
  const dA = mkPath(ptsA);
  const dB = mkPath(ptsB);

  const pointColorA = colorA.includes("red") ? "#ef4444" : "#0ea5e9";
  const pointColorB = colorB.includes("yellow") ? "#eab308" : "#0ea5e9";

  return (
    <div className="rounded border bg-gradient-to-b from-slate-50/70 to-white p-3">
      <div className="mb-2 flex items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />Ремонты</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-yellow-500" />Настройки</span>
      </div>
      <div className="h-48">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full">
          {Array.from({ length: 5 }).map((_, i) => {
            const y = p + ((h - p * 2) / 4) * i;
            return <line key={`g-${i}`} x1={p} y1={y} x2={w - p} y2={y} stroke="currentColor" className="text-slate-200" strokeWidth="1" />;
          })}
          <line x1={p} y1={h - p} x2={w - p} y2={h - p} stroke="currentColor" className="text-slate-300" strokeWidth="1" />
          <path d={dA} className={colorA} fill="none" strokeWidth="3" strokeLinecap="round" />
          <path d={dB} className={colorB} fill="none" strokeWidth="3" strokeLinecap="round" />
          {ptsA.map((pt, i) => (
            <g key={`a-${i}`}>
              <circle cx={pt.x} cy={pt.y} r="4" className="fill-white stroke-slate-300" />
              <circle cx={pt.x} cy={pt.y} r="2.4" fill={pointColorA} />
              <text x={pt.x} y={pt.y - 10} textAnchor="middle" className="fill-slate-600 text-[9px]">
                {seriesA[i]}
              </text>
            </g>
          ))}
          {ptsB.map((pt, i) => (
            <g key={`b-${i}`}>
              <circle cx={pt.x} cy={pt.y} r="4" className="fill-white stroke-slate-300" />
              <circle cx={pt.x} cy={pt.y} r="2.4" fill={pointColorB} />
              <text x={pt.x} y={pt.y + 14} textAnchor="middle" className="fill-slate-600 text-[9px]">
                {seriesB[i]}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-2 grid grid-cols-6 gap-1 text-center text-[10px] font-medium text-slate-500">
        {labels.map((label) => <div key={label}>{label}</div>)}
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const filterSubdivision = getParam(searchParams, "subdivision");
  const rangeDays = parseRangeDays(typeof searchParams?.days === "string" ? searchParams.days : undefined);
  const useMock = process.env.USE_MOCK_DATA === "1";
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - (rangeDays - 1));

  let rows: DashboardRow[] = [];
  let totalEquipment = 0;

  if (useMock) {
    const items = await getMockIssues();
    rows = items
      .filter((x) => x.startAt >= from && x.startAt <= now)
      .map((x) => ({
        id: x.id,
        key: x.jiraIssueKey ?? "-",
        equipment: x.equipmentTitle,
        status: x.status,
        type: x.type,
        startAt: x.startAt,
        endAt: x.endAt ?? null,
        responsible: x.responsible ?? "Не указан",
        subdivision: x.subdivision ?? "Не указана",
        isInProgress: x.isInProgress,
      }));
    totalEquipment = new Set(items.map((x) => x.equipmentUid)).size;
  } else {
    const [issues, equipmentCount] = await Promise.all([
      prisma.issue.findMany({
        where: { startAt: { gte: from, lte: now } },
        include: { equipment: true },
        orderBy: { startAt: "desc" },
        take: 100000,
      }),
      prisma.equipment.count(),
    ]);
    totalEquipment = equipmentCount;
    rows = issues.map((x: any) => ({
      id: String(x.id),
      key: x.jiraIssueKey ?? "-",
      equipment: x.equipment.title,
      status: x.status,
      type: x.type,
      startAt: x.startAt,
      endAt: x.endAt ?? null,
      responsible: x.responsible ?? "Не указан",
      subdivision: x.equipment.subdivision ?? "Не указана",
      isInProgress: x.isInProgress,
    }));
  }

  const subdivisions = Array.from(new Set(rows.map((x) => x.subdivision).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));

  const filteredRows = rows.filter((x) => {
    if (filterSubdivision && x.subdivision !== filterSubdivision) return false;
    return true;
  });

  const totalEvents = filteredRows.length;
  const inProgress = filteredRows.filter((x) => x.isInProgress).length;
  const completed = filteredRows.filter((x) => !x.isInProgress).length;
  const downtimeHours = filteredRows.reduce((acc, x) => acc + hoursBetween(x.startAt, x.endAt), 0);
  const avgHours = totalEvents > 0 ? downtimeHours / totalEvents : 0;
  const impactedEquipment = new Set(filteredRows.map((x) => x.equipment)).size;
  const impactShare = totalEquipment > 0 ? (impactedEquipment / totalEquipment) * 100 : 0;

  const byPeopleRepairs = new Map<string, number>();
  const byPeopleSetups = new Map<string, number>();
  const byEquipment = new Map<string, number>();

  for (const row of filteredRows) {
    byEquipment.set(row.equipment, (byEquipment.get(row.equipment) ?? 0) + 1);
    if (/ремонт|repair/i.test(row.type)) {
      byPeopleRepairs.set(row.responsible, (byPeopleRepairs.get(row.responsible) ?? 0) + 1);
    }
    if (/настрой|setup|config/i.test(row.type)) {
      byPeopleSetups.set(row.responsible, (byPeopleSetups.get(row.responsible) ?? 0) + 1);
    }
  }

  const topPeopleRepairs = Array.from(byPeopleRepairs.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  const topPeopleSetups = Array.from(byPeopleSetups.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  const topEquipment = Array.from(byEquipment.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  const recentRows = filteredRows.slice(0, 12);

  const metrics6m = buildHalfYearMetrics(filteredRows);
  const workType6m = buildHalfYearWorkTypeMetrics(filteredRows);
  const labels6m = metrics6m.map((m) => m.label);

  return (
    <>
      <header className="header">
        <div className="rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="title">Панель управления</h1>
              <p className="mt-1 text-sm text-muted-foreground">Ключевые показатели отказов оборудования, SLA и MTTR в едином срезе.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[7, 14, 30, 90].map((days) => (
                <Link key={days} href={`/dashboard?days=${days}`} className={`rounded-md border px-3 py-1.5 ${rangeDays === days ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/50"}`}>
                  {days} дн
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="card-grid mt-4">
        <article className="card"><div className="metric-label">События</div><div className="metric-value">{totalEvents}</div></article>
        <article className="card"><div className="metric-label">В работе</div><div className="metric-value">{inProgress}</div><div className="mt-1 text-xs text-muted-foreground">Закрыто: {completed}</div></article>
        <article className="card"><div className="metric-label">Суммарный простой</div><div className="metric-value">{downtimeHours.toFixed(1)} ч</div><div className="mt-1 text-xs text-muted-foreground">Средний MTTR: {avgHours.toFixed(2)} ч</div></article>
        <article className="card"><div className="metric-label">Охват оборудования</div><div className="metric-value">{impactShare.toFixed(1)}%</div><div className="mt-1 text-xs text-muted-foreground">{impactedEquipment} из {totalEquipment}</div></article>
      </section>
      
      <DashboardFilters
        subdivisions={subdivisions}
        initialSubdivision={filterSubdivision}
      />

      <section className="mt-4 grid gap-4 lg:grid-cols-4">
        <article className="card"><h2 className="mb-3 text-sm font-semibold">События</h2><LineChart labels={labels6m} values={metrics6m.map((m) => m.events)} strokeClass="stroke-blue-500" pointColor="#3b82f6" valueFormatter={(v) => `${Math.round(v)}`} legendLabel="Количество событий" legendColorClass="bg-blue-500" /></article>
        <article className="card"><h2 className="mb-3 text-sm font-semibold">SLA</h2><LineChart labels={labels6m} values={metrics6m.map((m) => m.sla)} strokeClass="stroke-emerald-500" pointColor="#10b981" valueFormatter={(v) => `${Math.round(v)}%`} legendLabel="SLA, %" legendColorClass="bg-emerald-500" /></article>
        <article className="card"><h2 className="mb-3 text-sm font-semibold">MTTR</h2><LineChart labels={labels6m} values={metrics6m.map((m) => m.mttr)} strokeClass="stroke-amber-500" pointColor="#f59e0b" valueFormatter={(v) => `${v.toFixed(1)}`} legendLabel="MTTR, ч" legendColorClass="bg-amber-500" /></article>
        <article className="card">
          <h2 className="mb-3 text-sm font-semibold">Типы работ</h2>
          <MultiLineChart
            labels={workType6m.map((x) => x.label)}
            seriesA={workType6m.map((x) => x.repairs)}
            seriesB={workType6m.map((x) => x.setups)}
            colorA="stroke-red-500"
            colorB="stroke-yellow-500"
          />
        </article>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-3">
        <article className="card">
          <h2 className="mb-3 text-sm font-semibold">Топ исполнителей: ремонты</h2>
          <div className="space-y-2 text-xs">
            {topPeopleRepairs.map((row, idx) => <div key={`${row.name}-r`} className="flex items-center justify-between rounded border p-2"><span className="truncate pr-2">{idx + 1}. {row.name}</span><span className="font-semibold">{row.count}</span></div>)}
          </div>
        </article>
        <article className="card">
          <h2 className="mb-3 text-sm font-semibold">Топ исполнителей: настройки</h2>
          <div className="space-y-2 text-xs">
            {topPeopleSetups.map((row, idx) => <div key={`${row.name}-s`} className="flex items-center justify-between rounded border p-2"><span className="truncate pr-2">{idx + 1}. {row.name}</span><span className="font-semibold">{row.count}</span></div>)}
          </div>
        </article>
        <article className="card">
          <h2 className="mb-3 text-sm font-semibold">Топ оборудования</h2>
          <div className="space-y-2 text-xs">
            {topEquipment.map((row, idx) => <div key={row.name} className="flex items-center justify-between rounded border p-2"><span className="truncate pr-2">{idx + 1}. {row.name}</span><span className="font-semibold">{row.count}</span></div>)}
          </div>
        </article>
      </section>

      <section className="card mt-4">
        <h2 className="mb-3 text-sm font-semibold">Последние события</h2>
        <div className="max-h-[360px] overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/40">
              <tr>
                <th className="px-2 py-2 text-left font-semibold">Jira</th>
                <th className="px-2 py-2 text-left font-semibold">Оборудование</th>
                <th className="px-2 py-2 text-left font-semibold">Тип</th>
                <th className="px-2 py-2 text-left font-semibold">Статус</th>
                <th className="px-2 py-2 text-left font-semibold">Начало</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-2 py-2 font-mono">{row.key}</td>
                  <td className="px-2 py-2">{row.equipment}</td>
                  <td className="px-2 py-2">{row.type}</td>
                  <td className="px-2 py-2"><span className={`rounded border px-2 py-0.5 text-[11px] ${statusTone(row.status)}`}>{row.status}</span></td>
                  <td className="px-2 py-2 whitespace-nowrap">{prettyDate(row.startAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
