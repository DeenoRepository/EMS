"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { SummaryCard } from "@/components/ui/summary-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { Download, FileBadge2, FileCheck2, FileCog2, FilePlus2, FileSpreadsheet, FileText, Filter, GitBranchPlus, Save, Search, Shapes, X } from "lucide-react";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { hasAnyRole } from "@/lib/client/auth";
import { exportToCsv } from "@/lib/export/csv";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/client/notify";
import { useUnsavedChangesGuard } from "@/lib/client/use-unsaved-changes";
import { ESCAPE_EVENT } from "@/components/layout/app-hotkeys";

type Equipment = { id: string; equipmentCode: string; name: string };
type DocumentVersion = {
  id: string;
  versionNumber: number;
  fileName: string;
  storagePath: string;
  downloadUrl?: string;
  checksum: string;
  notes?: string | null;
  metadata?: unknown;
  createdAt: string;
  createdBy?: { displayName: string; email: string } | null;
};
type DocumentItem = {
  id: string;
  equipmentId: string;
  title: string;
  docType: "PASSPORT" | "OPERATION_MANUAL" | "CERTIFICATE" | "ACT" | "DRAWING" | "OTHER";
  status: string;
  equipment: Equipment;
  versions: DocumentVersion[];
  updatedAt: string;
};
type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };
type RuntimeSettings = { workflow: { documentChangesRequireApproval: boolean } };
type SavedDocumentFilter = {
  name: string;
  search: string;
  status: string;
  docType: string;
  equipmentId: string;
  dateFrom: string;
  dateTo: string;
};

function docTypeLabel(value: DocumentItem["docType"]) {
  const map: Record<DocumentItem["docType"], string> = {
    PASSPORT: "Паспорт",
    OPERATION_MANUAL: "Руководство по эксплуатации",
    CERTIFICATE: "Сертификат",
    ACT: "Акт",
    DRAWING: "Чертеж",
    OTHER: "Прочее"
  };
  return map[value];
}

function docTypeIcon(value: DocumentItem["docType"], className = "h-4 w-4 text-muted-foreground") {
  if (value === "PASSPORT") return <FileBadge2 className={className} />;
  if (value === "OPERATION_MANUAL") return <FileText className={className} />;
  if (value === "CERTIFICATE") return <FileCheck2 className={className} />;
  if (value === "ACT") return <FileSpreadsheet className={className} />;
  if (value === "DRAWING") return <FileCog2 className={className} />;
  return <Shapes className={className} />;
}

function documentStatusLabel(status: string) {
  const map: Record<string, string> = {
    DRAFT: "Черновик",
    IN_REVIEW: "На проверке",
    APPROVED: "Согласован",
    REJECTED: "Отклонен",
    ARCHIVED: "Устаревший"
  };
  return map[status] || status;
}

function documentStatusBadgeClass(status: string) {
  if (status === "APPROVED") return "bg-status-success/20 text-status-success";
  if (status === "IN_REVIEW") return "bg-status-warning/20 text-status-warning";
  if (status === "REJECTED") return "bg-status-error/20 text-status-error";
  if (status === "DRAFT") return "bg-status-info/20 text-status-info";
  return "bg-muted text-muted-foreground";
}

function mapToCsvRows(items: DocumentItem[]) {
  return items.map((item) => ({
    title: item.title,
    type: item.docType,
    status: item.status,
    currentVersion: item.versions[0]?.versionNumber || "",
    uploadedBy: item.versions[0]?.createdBy?.displayName || "",
    uploadDate: item.versions[0]?.createdAt || "",
    equipment: item.equipment.name
  }));
}

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const canEdit = hasAnyRole(user, ["EDITOR", "ADMIN"]);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [status, setStatus] = useState(() => searchParams.get("status") || "all");
  const [docType, setDocType] = useState(() => searchParams.get("docType") || "all");
  const [equipmentFilter, setEquipmentFilter] = useState(() => searchParams.get("equipmentId") || "all");
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(() => searchParams.get("dateTo") || "");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(() => Number(searchParams.get("page") || 1));
  const [total, setTotal] = useState(0);
  const pageSize = 12;

  const [showCreate, setShowCreate] = useState(false);
  const [showVersion, setShowVersion] = useState(false);
  const [newDoc, setNewDoc] = useState({
    equipmentId: "",
    title: "",
    docType: "PASSPORT" as DocumentItem["docType"],
    fileName: "",
    storagePath: "",
    checksum: "",
    notes: ""
  });
  const [newVersion, setNewVersion] = useState({
    documentId: "",
    fileName: "",
    storagePath: "",
    checksum: "",
    notes: ""
  });
  const [uploadingDocFile, setUploadingDocFile] = useState(false);
  const [uploadingVersionFile, setUploadingVersionFile] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettings | null>(null);
  const [savedFilters, setSavedFilters] = useState<SavedDocumentFilter[]>([]);
  const [saveFilterName, setSaveFilterName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const createDirty = Boolean(
    showCreate &&
      (newDoc.equipmentId || newDoc.title || newDoc.fileName || newDoc.storagePath || newDoc.checksum || newDoc.notes)
  );
  const versionDirty = Boolean(
    showVersion && (newVersion.documentId || newVersion.fileName || newVersion.storagePath || newVersion.checksum || newVersion.notes)
  );

  useUnsavedChangesGuard({ enabled: createDirty || versionDirty });

  useEffect(() => {
    const onEscape = () => {
      setShowCreate(false);
      setShowVersion(false);
    };
    window.addEventListener(ESCAPE_EVENT, onEscape);
    return () => window.removeEventListener(ESCAPE_EVENT, onEscape);
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem("documents-saved-filters");
    if (!raw) return;
    try {
      setSavedFilters(JSON.parse(raw) as SavedDocumentFilter[]);
    } catch {
      setSavedFilters([]);
    }
  }, []);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set("page", String(page));
    if (search) next.set("q", search);
    if (status !== "all") next.set("status", status);
    if (docType !== "all") next.set("docType", docType);
    if (equipmentFilter !== "all") next.set("equipmentId", equipmentFilter);
    if (dateFrom) next.set("dateFrom", dateFrom);
    if (dateTo) next.set("dateTo", dateTo);
    router.replace(`/documents?${next.toString()}`, { scroll: false });
  }, [page, search, status, docType, equipmentFilter, dateFrom, dateTo, router]);

  const persistSavedFilters = (next: SavedDocumentFilter[]) => {
    setSavedFilters(next);
    window.localStorage.setItem("documents-saved-filters", JSON.stringify(next));
  };

  const loadEquipment = async () => {
    const [equipmentRes, settingsRes] = await Promise.all([
      fetch("/api/equipment?page=1&pageSize=300"),
      fetch("/api/settings/public", { cache: "no-store" })
    ]);
    if (equipmentRes.ok) {
      const data: Paged<Equipment> = await equipmentRes.json();
      setEquipment(data.items || []);
    }
    if (settingsRes.ok) {
      const settingsData: RuntimeSettings = await settingsRes.json();
      setRuntimeSettings(settingsData);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        q: search
      });
      if (status !== "all") params.set("status", status);
      if (docType !== "all") params.set("docType", docType);
      if (equipmentFilter !== "all") params.set("equipmentId", equipmentFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/documents?${params.toString()}`);
      if (!res.ok) {
        setError("Не удалось загрузить документы");
        return;
      }
      const data: Paged<DocumentItem> = await res.json();
      setItems(data.items || []);
      setSelectedDoc((prev) => data.items.find((item) => item.id === prev?.id) || data.items[0] || null);
      setSelectedIds((prev) => prev.filter((id) => (data.items || []).some((item) => item.id === id)));
      setTotal(data.total || 0);
    } catch {
      setError("Сетевая ошибка при загрузке документов");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEquipment();
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [search, status, docType, equipmentFilter, dateFrom, dateTo, page]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const createDocument = async () => {
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDoc)
      });
      if (!res.ok) {
        setError("Не удалось создать документ");
        notifyError("Не удалось создать документ");
        return;
      }
      setShowCreate(false);
      setNewDoc({ equipmentId: "", title: "", docType: "PASSPORT", fileName: "", storagePath: "", checksum: "", notes: "" });
      notifySuccess("Документ создан");
      await loadDocuments();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сетевая ошибка при создании документа");
      notifyError("Сетевая ошибка при создании документа");
    }
  };

  const createVersion = async () => {
    if (!newVersion.documentId) return;
    try {
      const res = await fetch(`/api/documents/${newVersion.documentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: newVersion.fileName,
          storagePath: newVersion.storagePath,
          checksum: newVersion.checksum,
          notes: newVersion.notes
        })
      });
      if (!res.ok) {
        setError("Не удалось создать новую версию документа");
        notifyError("Не удалось создать новую версию документа");
        return;
      }
      setShowVersion(false);
      setNewVersion({ documentId: "", fileName: "", storagePath: "", checksum: "", notes: "" });
      notifySuccess("Новая версия документа загружена");
      await loadDocuments();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сетевая ошибка при создании версии");
      notifyError("Сетевая ошибка при создании версии");
    }
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/files/upload", {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      throw new Error("upload failed");
    }
    return (await res.json()) as { fileName: string; storagePath: string; checksum: string };
  };

  const onSelectDocFile = async (file?: File | null) => {
    if (!file) return;
    setUploadingDocFile(true);
    try {
      const uploaded = await uploadFile(file);
      setNewDoc((prev) => ({
        ...prev,
        fileName: uploaded.fileName,
        storagePath: uploaded.storagePath,
        checksum: uploaded.checksum
      }));
      notifySuccess("Файл загружен");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка загрузки файла");
      notifyError("Ошибка загрузки файла");
    } finally {
      setUploadingDocFile(false);
    }
  };

  const onSelectVersionFile = async (file?: File | null) => {
    if (!file) return;
    setUploadingVersionFile(true);
    try {
      const uploaded = await uploadFile(file);
      setNewVersion((prev) => ({
        ...prev,
        fileName: uploaded.fileName,
        storagePath: uploaded.storagePath,
        checksum: uploaded.checksum
      }));
      notifySuccess("Файл версии загружен");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка загрузки файла версии");
      notifyError("Ошибка загрузки файла версии");
    } finally {
      setUploadingVersionFile(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setDocType("all");
    setEquipmentFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const saveCurrentFilter = () => {
    const name = saveFilterName.trim();
    if (!name) return;
    const next = [
      ...savedFilters.filter((item) => item.name !== name),
      { name, search, status, docType, equipmentId: equipmentFilter, dateFrom, dateTo }
    ];
    persistSavedFilters(next);
    setSaveFilterName("");
    notifySuccess("Фильтр сохранен");
  };

  const applySavedFilter = (filter: SavedDocumentFilter) => {
    setSearch(filter.search);
    setStatus(filter.status);
    setDocType(filter.docType || "all");
    setEquipmentFilter(filter.equipmentId || "all");
    setDateFrom(filter.dateFrom || "");
    setDateTo(filter.dateTo || "");
    setPage(1);
  };

  const exportCsv = () => {
    exportToCsv("documents.csv", mapToCsvRows(items));
  };

  const stats = useMemo(
    () => ({
      total: items.length,
      approved: items.filter((item) => item.status === "APPROVED").length,
      inReview: items.filter((item) => item.status === "IN_REVIEW").length
    }),
    [items]
  );

  const selectedItems = useMemo(() => items.filter((item) => selectedIds.includes(item.id)), [items, selectedIds]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(items.map((item) => item.id));
      return;
    }
    setSelectedIds([]);
  };

  const bulkSendForApproval = async () => {
    if (!runtimeSettings?.workflow.documentChangesRequireApproval) return;
    const candidates = selectedItems.filter((item) => item.status === "DRAFT" || item.status === "REJECTED");
    if (candidates.length === 0) {
      notifyInfo("Нет подходящих документов", "Выберите черновики или отклоненные документы.");
      return;
    }

    let success = 0;
    for (const doc of candidates) {
      const res = await fetch(`/api/documents/${doc.id}/submit-approval`, { method: "POST" });
      if (res.ok) success += 1;
    }

    notifySuccess("Массовая отправка завершена", `Успешно: ${success} из ${candidates.length}`);
    setSelectedIds([]);
    await loadDocuments();
  };

  const bulkArchive = async () => {
    const candidates = selectedItems.filter((item) => item.status !== "ARCHIVED" && item.status !== "DRAFT");
    if (candidates.length === 0) {
      notifyError("Нет подходящих документов", "Архивировать можно документы кроме черновиков и уже архивных.");
      return;
    }

    let success = 0;
    for (const doc of candidates) {
      const res = await fetch(`/api/documents/${doc.id}/archive`, { method: "POST" });
      if (res.ok) success += 1;
    }

    notifySuccess("Массовое архивирование завершено", `Успешно: ${success} из ${candidates.length}`);
    setSelectedIds([]);
    await loadDocuments();
  };

  const exportSelectedCsv = () => {
    exportToCsv("documents-selected.csv", mapToCsvRows(selectedItems));
    notifySuccess("Экспорт выбранных документов", `Экспортировано: ${selectedItems.length}`);
  };

  const isAllSelected = items.length > 0 && selectedIds.length === items.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Документы" }]} />
          <h1 className="mt-4 text-3xl font-bold">Документы</h1>
          <p className="mt-1 text-muted-foreground">Управление документами оборудования, версиями и метаданными.</p>
          {runtimeSettings && !runtimeSettings.workflow.documentChangesRequireApproval ? (
            <p className="mt-1 text-xs text-status-success">
              Согласование документов отключено в настройках: новые документы и версии публикуются сразу.
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            <Button className="gap-2" onClick={() => { setShowCreate(true); setShowVersion(false); }}>
              <FilePlus2 className="h-4 w-4" />
              Новый документ
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => { setShowVersion(true); setShowCreate(false); }}>
              <GitBranchPlus className="h-4 w-4" />
              Новая версия
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="Всего документов" value={stats.total} />
        <SummaryCard label="Согласовано" value={stats.approved} />
        <SummaryCard label="На проверке" value={stats.inReview} />
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-global-search="true"
              className="pl-10"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Поиск по названию, типу или оборудованию..."
            />
          </div>
          <Button variant={showFilters ? "default" : "outline"} className="gap-2" onClick={() => setShowFilters((prev) => !prev)}>
            <Filter className="h-4 w-4" />
            Фильтры
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Экспорт
          </Button>
          <Button variant="outline" onClick={resetFilters}>Сбросить всё</Button>
        </div>
        {showFilters ? (
          <div className="border-t border-border pt-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="text-sm font-medium">Статус</label>
                <AppSelect className="mt-2" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                  <option value="all">Все</option>
                  <option value="DRAFT">Черновик</option>
                  <option value="IN_REVIEW">На проверке</option>
                  <option value="APPROVED">Согласовано</option>
                  <option value="REJECTED">Отклонено</option>
                  <option value="ARCHIVED">Устаревшие</option>
                </AppSelect>
              </div>
              <div>
                <label className="text-sm font-medium">Тип документа</label>
                <AppSelect className="mt-2" value={docType} onChange={(e) => { setDocType(e.target.value); setPage(1); }}>
                  <option value="all">Все типы</option>
                  <option value="PASSPORT">Паспорт</option>
                  <option value="OPERATION_MANUAL">Руководство по эксплуатации</option>
                  <option value="CERTIFICATE">Сертификат</option>
                  <option value="ACT">Акт</option>
                  <option value="DRAWING">Чертеж</option>
                  <option value="OTHER">Прочее</option>
                </AppSelect>
              </div>
              <div>
                <label className="text-sm font-medium">Оборудование</label>
                <AppSelect className="mt-2" value={equipmentFilter} onChange={(e) => { setEquipmentFilter(e.target.value); setPage(1); }}>
                  <option value="all">Все оборудование</option>
                  {equipment.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.equipmentCode} - {item.name}
                    </option>
                  ))}
                </AppSelect>
              </div>
              <div>
                <label className="text-sm font-medium">Дата обновления с</label>
                <Input className="mt-2" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
              </div>
              <div>
                <label className="text-sm font-medium">Дата обновления по</label>
                <Input className="mt-2" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-sm font-medium">Сохранить фильтр</label>
              <div className="mt-2 flex gap-2">
                <Input value={saveFilterName} onChange={(e) => setSaveFilterName(e.target.value)} placeholder="Название фильтра" />
                <Button variant="outline" onClick={saveCurrentFilter}><Save className="h-4 w-4" /></Button>
              </div>
            </div>
            {savedFilters.length > 0 ? (
              <div className="mt-3">
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
          <p className="text-sm text-muted-foreground">Выбрано документов: <span className="font-semibold text-foreground">{selectedIds.length}</span></p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportSelectedCsv}>Экспорт выбранных</Button>
            {canEdit && runtimeSettings?.workflow.documentChangesRequireApproval ? (
              <Button size="sm" variant="outline" onClick={() => void bulkSendForApproval()}>На согласование</Button>
            ) : null}
            {canEdit ? <Button size="sm" onClick={() => void bulkArchive()}>Сделать устаревшими</Button> : null}
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Снять выделение</Button>
          </div>
        </Card>
      ) : null}

      {canEdit && showCreate ? (
        <Card className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
          <AppSelect value={newDoc.equipmentId} onChange={(e) => setNewDoc((prev) => ({ ...prev, equipmentId: e.target.value }))}>
            <option value="">Выберите оборудование</option>
            {equipment.map((item) => (
              <option key={item.id} value={item.id}>
                {item.equipmentCode} - {item.name}
              </option>
            ))}
          </AppSelect>
          <Input placeholder="Название документа" value={newDoc.title} onChange={(e) => setNewDoc((prev) => ({ ...prev, title: e.target.value }))} />
          <Input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(e) => void onSelectDocFile(e.target.files?.[0])} />
          <AppSelect value={newDoc.docType} onChange={(e) => setNewDoc((prev) => ({ ...prev, docType: e.target.value as DocumentItem["docType"] }))}>
            <option value="PASSPORT">Паспорт</option>
            <option value="OPERATION_MANUAL">Руководство по эксплуатации</option>
            <option value="CERTIFICATE">Сертификат</option>
            <option value="ACT">Акт</option>
            <option value="DRAWING">Чертеж</option>
            <option value="OTHER">Прочее</option>
          </AppSelect>
          <Input placeholder="Имя файла" value={newDoc.fileName} onChange={(e) => setNewDoc((prev) => ({ ...prev, fileName: e.target.value }))} />
          <Input placeholder="Путь хранения/URL" value={newDoc.storagePath} onChange={(e) => setNewDoc((prev) => ({ ...prev, storagePath: e.target.value }))} />
          <Input placeholder="Контрольная сумма" value={newDoc.checksum} onChange={(e) => setNewDoc((prev) => ({ ...prev, checksum: e.target.value }))} />
          <Input placeholder="Примечание" value={newDoc.notes} onChange={(e) => setNewDoc((prev) => ({ ...prev, notes: e.target.value }))} />
          <div className="md:col-span-2">
            <Button disabled={uploadingDocFile} onClick={() => void createDocument()}>{uploadingDocFile ? "Загрузка файла..." : "Создать документ"}</Button>
          </div>
        </Card>
      ) : null}

      {canEdit && showVersion ? (
        <Card className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
          <AppSelect value={newVersion.documentId} onChange={(e) => setNewVersion((prev) => ({ ...prev, documentId: e.target.value }))}>
            <option value="">Выберите документ</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </AppSelect>
          <Input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(e) => void onSelectVersionFile(e.target.files?.[0])} />
          <Input placeholder="Имя файла" value={newVersion.fileName} onChange={(e) => setNewVersion((prev) => ({ ...prev, fileName: e.target.value }))} />
          <Input placeholder="Путь хранения/URL" value={newVersion.storagePath} onChange={(e) => setNewVersion((prev) => ({ ...prev, storagePath: e.target.value }))} />
          <Input placeholder="Контрольная сумма" value={newVersion.checksum} onChange={(e) => setNewVersion((prev) => ({ ...prev, checksum: e.target.value }))} />
          <Input placeholder="Примечание" value={newVersion.notes} onChange={(e) => setNewVersion((prev) => ({ ...prev, notes: e.target.value }))} />
          <div className="md:col-span-2">
            <Button disabled={uploadingVersionFile} onClick={() => void createVersion()}>{uploadingVersionFile ? "Загрузка файла..." : "Загрузить новую версию"}</Button>
          </div>
        </Card>
      ) : null}

      {loading ? <LoadingState text="Загрузка документов..." /> : null}
      {!loading && error ? <ErrorState text={error} onRetry={() => void loadDocuments()} /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState text="Документы не найдены." actionLabel="Сбросить фильтры" onAction={resetFilters} /> : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="overflow-hidden xl:col-span-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Таблица документов">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          aria-label="Выбрать все документы"
                          checked={isAllSelected}
                          onChange={(event) => toggleSelectAll(event.target.checked)}
                        />
                      </th>
                      <th className="px-4 py-3 text-left">Название</th>
                      <th className="px-4 py-3 text-left">Тип</th>
                      <th className="px-4 py-3 text-left">Статус</th>
                      <th className="px-4 py-3 text-left">Текущая версия</th>
                      <th className="px-4 py-3 text-left">Загрузил</th>
                      <th className="px-4 py-3 text-left">Дата загрузки</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item) => {
                      const current = item.versions[0];
                      return (
                        <tr
                          key={item.id}
                          className={`cursor-pointer hover:bg-muted/20 focus-within:bg-muted/20 ${selectedDoc?.id === item.id ? "bg-primary/5" : ""}`}
                          onClick={() => setSelectedDoc(item)}
                          onDoubleClick={() => router.push(`/documents/${item.id}`)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") router.push(`/documents/${item.id}`);
                            if (event.key === " ") {
                              event.preventDefault();
                              setSelectedDoc(item);
                            }
                          }}
                          tabIndex={0}
                          aria-selected={selectedDoc?.id === item.id}
                        >
                          <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(item.id)}
                              onChange={(event) => {
                                setSelectedIds((prev) => {
                                  if (event.target.checked) return [...new Set([...prev, item.id])];
                                  return prev.filter((id) => id !== item.id);
                                });
                              }}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-3">
                              <div className="pt-0.5">
                                {docTypeIcon(item.docType, "h-5 w-5 text-muted-foreground")}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium">{item.title}</p>
                                <p className="text-xs text-muted-foreground">{item.equipment.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">{docTypeLabel(item.docType)}</td>
                          <td className="px-4 py-3">
                            <Badge className={`border-0 ${documentStatusBadgeClass(item.status)}`}>{documentStatusLabel(item.status)}</Badge>
                          </td>
                          <td className="px-4 py-3">v{current?.versionNumber || "-"}</td>
                          <td className="px-4 py-3">{current?.createdBy?.displayName || "-"}</td>
                          <td className="px-4 py-3">{current?.createdAt ? new Date(current.createdAt).toLocaleString() : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="h-fit p-4">
              <h3 className="text-lg font-semibold">Панель метаданных</h3>
              {!selectedDoc ? (
                <EmptyState text="Выберите документ, чтобы увидеть метаданные и историю версий." />
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      {docTypeIcon(selectedDoc.docType)}
                      {selectedDoc.title} • {docTypeLabel(selectedDoc.docType)}
                    </span>
                  </p>
                  {selectedDoc.versions.map((version, index) => (
                    <div key={version.id} className={`rounded-md border p-3 ${index === 0 ? "border-primary bg-primary/5" : "border-border"}`}>
                      <div className="flex items-center justify-between">
                        <p className="font-medium">
                          v{version.versionNumber} {index === 0 ? "(текущая)" : ""}
                        </p>
                        <Badge className={`border-0 ${documentStatusBadgeClass(selectedDoc.status)}`}>{documentStatusLabel(selectedDoc.status)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{version.fileName}</p>
                      <p className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</p>
                      <p className="mt-1 text-xs text-muted-foreground">checksum: {version.checksum}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
          <p className="text-xs text-muted-foreground">Подсказка: один клик выбирает документ, двойной клик или клавиша Enter открывает карточку документа.</p>
        </>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Страница {page} из {pageCount}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Назад</Button>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Вперед</Button>
        </div>
      </div>
    </div>
  );
}
