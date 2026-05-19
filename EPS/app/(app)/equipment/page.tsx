"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { exportToCsv } from "@/lib/export/csv";
import { hasAnyRole } from "@/lib/client/auth";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { notifyError, notifySuccess } from "@/lib/client/notify";
import { Download, Filter, Plus, Save, Search, X } from "lucide-react";

type EquipmentItem = {
  id: string;
  name: string;
  type?: string | null;
  category?: string | null;
  model: string;
  serialNumber?: string | null;
  inventoryNumber?: string | null;
  department?: string | null;
  location?: string | null;
  responsibleUser?: { displayName: string } | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "DECOMMISSIONED";
  lifecycleStage: "PLANNED" | "COMMISSIONED" | "IN_OPERATION" | "MAINTENANCE" | "RETIRED";
  serviceDueDate?: string | null;
  warrantyExpiration?: string | null;
  updatedAt: string;
};

type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };
type SavedFilter = { name: string; search: string; status: string; lifecycleStage: string; department: string };
type QuickChipQuery = Partial<Pick<SavedFilter, "status" | "lifecycleStage">>;

const quickChips = [
  { key: "maintenance", label: "Требует ТО", query: { status: "INACTIVE" } },
  { key: "expiring", label: "Гарантия истекает", query: { lifecycleStage: "MAINTENANCE" } },
  { key: "draft", label: "Черновики", query: { status: "DRAFT" } },
  { key: "retired", label: "Выведено", query: { lifecycleStage: "RETIRED" } }
] as const satisfies ReadonlyArray<{ key: string; label: string; query: QuickChipQuery }>;

const quickChipDefaults: Record<keyof QuickChipQuery, string> = {
  status: "all",
  lifecycleStage: "all"
};

function isQuickChipActive(query: QuickChipQuery, status: string, lifecycleStage: string) {
  if (query.status && query.status !== status) return false;
  if (query.lifecycleStage && query.lifecycleStage !== lifecycleStage) return false;
  return true;
}

function applyQuickChip(
  query: QuickChipQuery,
  active: boolean,
  setStatus: (next: string) => void,
  setLifecycleStage: (next: string) => void
) {
  if (active) {
    if (query.status) setStatus(quickChipDefaults.status);
    if (query.lifecycleStage) setLifecycleStage(quickChipDefaults.lifecycleStage);
    return;
  }

  if (query.status) setStatus(query.status);
  if (query.lifecycleStage) setLifecycleStage(query.lifecycleStage);
}

const headers: Array<{ key: string; label: string }> = [
  { key: "name", label: "Наименование" },
  { key: "type", label: "Тип" },
  { key: "model", label: "Модель" },
  { key: "inventoryNumber", label: "Инв. номер" },
  { key: "department", label: "Подразделение" },
  { key: "status", label: "Статус" },
  { key: "serviceDueDate", label: "Дата ТО" },
  { key: "warrantyExpiration", label: "Гарантия до" },
  { key: "updatedAt", label: "Обновлено" }
];

function mapToCsvRows(items: EquipmentItem[]) {
  return items.map((item) => ({
    name: item.name,
    type: item.type || "",
    model: item.model,
    inventoryNumber: item.inventoryNumber || "",
    department: item.department || "",
    status: item.status,
    serviceDueDate: item.serviceDueDate || "",
    warrantyExpiration: item.warrantyExpiration || "",
    updatedAt: item.updatedAt
  }));
}

export default function EquipmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const canEdit = hasAnyRole(user, ["EDITOR", "ADMIN"]);

  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => Number(searchParams.get("page") || 1));
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [status, setStatus] = useState(() => searchParams.get("status") || "all");
  const [lifecycleStage, setLifecycleStage] = useState(() => searchParams.get("lifecycleStage") || "all");
  const [department, setDepartment] = useState(() => searchParams.get("department") || "all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState(() => searchParams.get("sortBy") || "updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">((searchParams.get("order") as "asc" | "desc") || "desc");
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [saveFilterName, setSaveFilterName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const pageSize = 15;

  useEffect(() => {
    const raw = window.localStorage.getItem("equipment-saved-filters");
    if (!raw) return;
    try {
      setSavedFilters(JSON.parse(raw) as SavedFilter[]);
    } catch {
      setSavedFilters([]);
    }
  }, []);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set("page", String(page));
    if (search) next.set("q", search);
    if (status !== "all") next.set("status", status);
    if (lifecycleStage !== "all") next.set("lifecycleStage", lifecycleStage);
    if (department !== "all") next.set("department", department);
    if (sortBy !== "updatedAt") next.set("sortBy", sortBy);
    if (order !== "desc") next.set("order", order);
    router.replace(`/equipment?${next.toString()}`, { scroll: false });
  }, [page, search, status, lifecycleStage, department, sortBy, order, router]);

  const persistSavedFilters = (next: SavedFilter[]) => {
    setSavedFilters(next);
    window.localStorage.setItem("equipment-saved-filters", JSON.stringify(next));
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        q: search,
        sortBy,
        order
      });
      if (status !== "all") params.set("status", status);
      if (lifecycleStage !== "all") params.set("lifecycleStage", lifecycleStage);
      if (department !== "all") params.set("department", department);

      const res = await fetch(`/api/equipment?${params.toString()}`);
      if (!res.ok) {
        setError("Не удалось загрузить реестр оборудования");
        return;
      }

      const data: Paged<EquipmentItem> = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setSelectedIds((prev) => prev.filter((id) => (data.items || []).some((item) => item.id === id)));
    } catch {
      setError("Сетевая ошибка при загрузке реестра оборудования");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, search, status, lifecycleStage, department, sortBy, order]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const departments = useMemo(
    () => Array.from(new Set(items.map((item) => item.department).filter(Boolean))) as string[],
    [items]
  );

  const statusBadge = (value: EquipmentItem["status"]) => {
    if (value === "ACTIVE") return <Badge className="border-0 bg-status-success/20 text-status-success">В работе</Badge>;
    if (value === "INACTIVE") return <Badge className="border-0 bg-status-warning/20 text-status-warning">Обслуживание</Badge>;
    if (value === "DECOMMISSIONED") return <Badge className="border-0 bg-status-error/20 text-status-error">Списано</Badge>;
    return <Badge className="border-0 bg-status-info/20 text-status-info">Черновик</Badge>;
  };

  const onSort = (key: string) => {
    if (sortBy === key) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      setPage(1);
      return;
    }
    setSortBy(key);
    setOrder("asc");
    setPage(1);
  };

  const exportCsv = () => {
    exportToCsv("equipment-registry.csv", mapToCsvRows(items));
  };

  const exportSelectedCsv = () => {
    const selectedItems = items.filter((item) => selectedIds.includes(item.id));
    exportToCsv("equipment-selected.csv", mapToCsvRows(selectedItems));
    notifySuccess("Экспорт выбранных записей готов", `Экспортировано строк: ${selectedItems.length}`);
  };

  const saveCurrentFilter = () => {
    const name = saveFilterName.trim();
    if (!name) return;
    const next = [...savedFilters.filter((filter) => filter.name !== name), { name, search, status, lifecycleStage, department }];
    persistSavedFilters(next);
    setSaveFilterName("");
    notifySuccess("Фильтр сохранен", `Профиль: ${name}`);
  };

  const applySavedFilter = (filter: SavedFilter) => {
    setSearch(filter.search);
    setStatus(filter.status);
    setLifecycleStage(filter.lifecycleStage);
    setDepartment(filter.department);
    setPage(1);
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setLifecycleStage("all");
    setDepartment("all");
    setPage(1);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(items.map((item) => item.id));
      return;
    }
    setSelectedIds([]);
  };

  const toggleRowSelection = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return [...new Set([...prev, id])];
      return prev.filter((value) => value !== id);
    });
  };

  const isAllSelected = items.length > 0 && selectedIds.length === items.length;

  const moveSelectedToMaintenance = async () => {
    if (!canEdit || selectedIds.length === 0) return;
    const confirmed = window.confirm(`Перевести выбранные единицы (${selectedIds.length}) в статус обслуживания?`);
    if (!confirmed) return;

    let success = 0;
    for (const id of selectedIds) {
      const res = await fetch(`/api/equipment/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INACTIVE", changeSummary: "Массовый перевод в обслуживание" })
      });
      if (res.ok) success += 1;
    }

    if (success === selectedIds.length) {
      notifySuccess("Массовое действие выполнено", `Обновлено записей: ${success}`);
    } else {
      notifyError("Массовое действие завершено с ошибками", `Обновлено: ${success} из ${selectedIds.length}`);
    }

    setSelectedIds([]);
    await load();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Оборудование" }]} />
          <h1 className="mt-4 text-3xl font-bold">Реестр оборудования</h1>
          <p className="mt-1 text-muted-foreground">Единая таблица оборудования с фильтрами, сортировкой и быстрым переходом в карточку.</p>
        </div>
        {canEdit ? (
          <Link href="/equipment/new">
            <Button className="gap-2"><Plus className="h-4 w-4" />Новое оборудование</Button>
          </Link>
        ) : null}
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {quickChips.map((chip) => (
            <Button
              key={chip.key}
              variant={isQuickChipActive(chip.query, status, lifecycleStage) ? "default" : "outline"}
              size="sm"
              onClick={() => {
                const active = isQuickChipActive(chip.query, status, lifecycleStage);
                applyQuickChip(chip.query, active, setStatus, setLifecycleStage);
                setPage(1);
              }}
            >
              {chip.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-global-search="true"
              className="pl-10"
              placeholder="Поиск по названию, модели, инвентарному номеру, подразделению..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Button variant={showFilters ? "default" : "outline"} className="gap-2" onClick={() => setShowFilters((v) => !v)}>
            <Filter className="h-4 w-4" />Фильтры
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" />Экспорт</Button>
          <Button variant="outline" onClick={resetFilters}>Сбросить всё</Button>
        </div>

        {showFilters ? (
          <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium">Статус</label>
              <AppSelect className="mt-2" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="all">Все</option>
                <option value="DRAFT">Черновик</option>
                <option value="ACTIVE">В работе</option>
                <option value="INACTIVE">Обслуживание</option>
                <option value="DECOMMISSIONED">Списано</option>
              </AppSelect>
            </div>
            <div>
              <label className="text-sm font-medium">Этап жизненного цикла</label>
              <AppSelect className="mt-2" value={lifecycleStage} onChange={(e) => { setLifecycleStage(e.target.value); setPage(1); }}>
                <option value="all">Все</option>
                <option value="PLANNED">Планирование</option>
                <option value="COMMISSIONED">Ввод</option>
                <option value="IN_OPERATION">Эксплуатация</option>
                <option value="MAINTENANCE">Обслуживание</option>
                <option value="RETIRED">Выведено</option>
              </AppSelect>
            </div>
            <div>
              <label className="text-sm font-medium">Подразделение</label>
              <AppSelect className="mt-2" value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }}>
                <option value="all">Все</option>
                {departments.map((item) => <option key={item} value={item}>{item}</option>)}
              </AppSelect>
            </div>
            <div>
              <label className="text-sm font-medium">Сохранить фильтр</label>
              <div className="mt-2 flex gap-2">
                <Input value={saveFilterName} onChange={(e) => setSaveFilterName(e.target.value)} placeholder="Название" />
                <Button variant="outline" onClick={saveCurrentFilter}><Save className="h-4 w-4" /></Button>
              </div>
            </div>
            {savedFilters.length > 0 ? (
              <div className="md:col-span-4">
                <p className="mb-2 text-sm font-medium">Сохраненные фильтры</p>
                <div className="flex flex-wrap gap-2">
                  {savedFilters.map((filter) => (
                    <div key={filter.name} className="flex items-center gap-1 rounded-md border border-border px-2 py-1">
                      <button className="text-xs text-primary" onClick={() => applySavedFilter(filter)}>{filter.name}</button>
                      <button
                        className="text-xs text-muted-foreground"
                        onClick={() => persistSavedFilters(savedFilters.filter((item) => item.name !== filter.name))}
                        title="Удалить фильтр"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      {selectedIds.length > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
          <p className="text-sm text-muted-foreground">Выбрано записей: <span className="font-semibold text-foreground">{selectedIds.length}</span></p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportSelectedCsv}>Экспорт выбранных</Button>
            {canEdit ? <Button size="sm" onClick={() => void moveSelectedToMaintenance()}>Перевести в обслуживание</Button> : null}
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Снять выделение</Button>
          </div>
        </Card>
      ) : null}

      <div className="text-sm text-muted-foreground">Показано {items.length} из {total} записей</div>

      {loading ? <LoadingState text="Загрузка реестра оборудования..." /> : null}
      {!loading && error ? <ErrorState text={error} onRetry={() => void load()} /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState text="По выбранным фильтрам оборудование не найдено." actionLabel="Сбросить фильтры" onAction={resetFilters} /> : null}

      {!loading && !error && items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">
                    <input
                      type="checkbox"
                      aria-label="Выбрать все строки"
                      checked={isAllSelected}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                    />
                  </th>
                  {headers.map((header) => (
                    <th key={header.key} className="px-4 py-3 text-left font-semibold">
                      <button className="inline-flex items-center gap-1" onClick={() => onSort(header.key)}>
                        {header.label}
                        {sortBy === header.key ? <span className="text-xs text-primary">{order === "asc" ? "▲" : "▼"}</span> : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                    onDoubleClick={() => router.push(`/equipment/${item.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") router.push(`/equipment/${item.id}`);
                    }}
                    tabIndex={0}
                    aria-label={`Открыть карточку оборудования ${item.name}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={(event) => toggleRowSelection(item.id, event.target.checked)}
                        aria-label={`Выбрать ${item.name}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium" onClick={() => router.push(`/equipment/${item.id}`)}>{item.name}</td>
                    <td className="px-4 py-3">{item.type || "-"}</td>
                    <td className="px-4 py-3">{item.model}</td>
                    <td className="px-4 py-3 font-mono">{item.inventoryNumber || "-"}</td>
                    <td className="px-4 py-3">{item.department || "-"}</td>
                    <td className="px-4 py-3">{statusBadge(item.status)}</td>
                    <td className="px-4 py-3">{item.serviceDueDate?.slice(0, 10) || "-"}</td>
                    <td className="px-4 py-3">{item.warrantyExpiration?.slice(0, 10) || "-"}</td>
                    <td className="px-4 py-3">{new Date(item.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-3">
            <span className="text-sm text-muted-foreground">Страница {page} из {pageCount}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Назад</Button>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Далее</Button>
            </div>
          </div>
          <p className="px-4 pb-3 text-xs text-muted-foreground">Подсказка: один клик выделяет строку, двойной клик или Enter открывает карточку.</p>
        </Card>
      ) : null}
    </div>
  );
}
