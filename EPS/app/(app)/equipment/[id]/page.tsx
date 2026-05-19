"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { EmptyState } from "@/components/states/empty-state";
import { hasAnyRole } from "@/lib/client/auth";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { notifyError, notifySuccess } from "@/lib/client/notify";
import { AlertTriangle, ArrowLeft, CircleDot, Download, FilePlus2, GitBranchPlus, PencilLine, RefreshCw, Search, ShieldCheck, Sparkles } from "lucide-react";
import { ESCAPE_EVENT } from "@/components/layout/app-hotkeys";

type EquipmentVersion = {
  id: string;
  versionNumber: number;
  changeSummary?: string | null;
  snapshot: Record<string, unknown>;
  createdAt: string;
  createdBy: { displayName: string };
};

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
  title: string;
  docType: "PASSPORT" | "OPERATION_MANUAL" | "CERTIFICATE" | "ACT" | "DRAWING" | "OTHER";
  status: string;
  createdAt: string;
  updatedAt: string;
  versions: DocumentVersion[];
};

type EquipmentEvent = {
  id: string;
  title: string;
  description?: string | null;
  eventType: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
};

type Approval = {
  id: string;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
  submittedAt: string;
  comments?: string | null;
  requestedBy: { displayName: string };
  decidedBy?: { displayName: string } | null;
};

type EquipmentDetails = {
  id: string;
  equipmentCode: string;
  name: string;
  type?: string | null;
  category?: string | null;
  model: string;
  serialNumber?: string | null;
  inventoryNumber?: string | null;
  manufacturer?: string | null;
  supplier?: string | null;
  productionDate?: string | null;
  deliveryDate?: string | null;
  commissioningDate?: string | null;
  department?: string | null;
  location?: string | null;
  responsibleUser?: { displayName: string; email: string } | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "DECOMMISSIONED";
  lifecycleStage: "PLANNED" | "COMMISSIONED" | "IN_OPERATION" | "MAINTENANCE" | "RETIRED";
  warrantyExpiration?: string | null;
  serviceDueDate?: string | null;
  notes?: string | null;
  customAttributes?: Record<string, string> | null;
  currentVersion: number;
  updatedAt: string;
  versions: EquipmentVersion[];
  documents: DocumentItem[];
  events: EquipmentEvent[];
  summary: { openApprovals: number; missingRequiredDocuments: string[] };
};

type Paged<T> = { items: T[] };
type Tab = "overview" | "maintenance" | "history" | "documents" | "events" | "approvals";
type RuntimeSettings = { workflow: { documentChangesRequireApproval: boolean } };
type PprMaintenanceType = "PREVENTIVE" | "SEASONAL" | "CAPITAL" | "DIAGNOSTIC";
type PprSchedulePoint = { date: string; daysLeft: number };
type EquipmentTypeAttributeDefinition = {
  id: string;
  key: string;
  label: string;
  dataType: "TEXT" | "NUMBER" | "DATE" | "SELECT";
  options?: Array<{ value: string; label: string }> | null;
};
const DEFAULT_PPR_MAINTENANCE_TYPE: PprMaintenanceType = "PREVENTIVE";

function normalizeAttributeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isTechnicalAttributeKey(key: string) {
  const normalized = normalizeAttributeKey(key);
  return normalized.startsWith("__ppr_") || normalized.startsWith("ppr_");
}

function humanizeAttributeKey(key: string) {
  const normalized = normalizeAttributeKey(key).replace(/^_+/, "");
  if (!normalized) return key;
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pprMaintenanceTypeLabel(value: PprMaintenanceType) {
  const map: Record<PprMaintenanceType, string> = {
    PREVENTIVE: "Профилактическое ТО",
    SEASONAL: "Сезонное ТО",
    CAPITAL: "Капитальное ТО",
    DIAGNOSTIC: "Диагностика"
  };
  return map[value];
}

function equipmentStatusLabel(status: EquipmentDetails["status"]) {
  const map: Record<EquipmentDetails["status"], string> = {
    DRAFT: "Черновик",
    ACTIVE: "В работе",
    INACTIVE: "Обслуживание",
    DECOMMISSIONED: "Списано"
  };
  return map[status];
}

function equipmentStatusBadgeClass(status: EquipmentDetails["status"]) {
  if (status === "ACTIVE") return "bg-status-success/20 text-status-success";
  if (status === "INACTIVE") return "bg-status-warning/20 text-status-warning";
  if (status === "DECOMMISSIONED") return "bg-status-error/20 text-status-error";
  return "bg-muted text-muted-foreground";
}

function lifecycleStageLabel(stage: EquipmentDetails["lifecycleStage"]) {
  const map: Record<EquipmentDetails["lifecycleStage"], string> = {
    PLANNED: "Планирование",
    COMMISSIONED: "Ввод",
    IN_OPERATION: "Эксплуатация",
    MAINTENANCE: "Обслуживание",
    RETIRED: "Выведено"
  };
  return map[stage];
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

function approvalStatusLabel(status: Approval["status"]) {
  const map: Record<Approval["status"], string> = {
    DRAFT: "Черновик",
    PENDING: "Ожидает",
    APPROVED: "Согласовано",
    REJECTED: "Отклонено",
    CANCELED: "Отменено"
  };
  return map[status];
}

function eventTypeLabel(eventType: string) {
  const map: Record<string, string> = {
    CREATED: "Создание",
    UPDATED: "Изменение",
    STATUS_CHANGED: "Смена статуса",
    DOCUMENT_ATTACHED: "Документ добавлен",
    APPROVAL_SUBMITTED: "Отправлено на согласование",
    APPROVAL_RESOLVED: "Решение по согласованию"
  };
  return map[eventType] || eventType;
}

function eventIconMeta(eventType: string) {
  if (eventType === "CREATED") return { Icon: Sparkles, iconClassName: "text-status-info", wrapClassName: "bg-status-info/10" };
  if (eventType === "UPDATED") return { Icon: RefreshCw, iconClassName: "text-status-info", wrapClassName: "bg-status-info/10" };
  if (eventType === "STATUS_CHANGED") return { Icon: AlertTriangle, iconClassName: "text-status-warning", wrapClassName: "bg-status-warning/10" };
  if (eventType === "DOCUMENT_ATTACHED") return { Icon: FilePlus2, iconClassName: "text-primary", wrapClassName: "bg-primary/10" };
  if (eventType === "APPROVAL_SUBMITTED") return { Icon: ShieldCheck, iconClassName: "text-status-warning", wrapClassName: "bg-status-warning/10" };
  if (eventType === "APPROVAL_RESOLVED") return { Icon: ShieldCheck, iconClassName: "text-status-success", wrapClassName: "bg-status-success/10" };
  return { Icon: CircleDot, iconClassName: "text-foreground", wrapClassName: "bg-muted" };
}

function labelDocType(docType: DocumentItem["docType"]) {
  const map: Record<DocumentItem["docType"], string> = {
    PASSPORT: "Паспорт",
    OPERATION_MANUAL: "Руководство по эксплуатации",
    CERTIFICATE: "Сертификат",
    ACT: "Акт",
    DRAWING: "Чертеж",
    OTHER: "Прочее"
  };
  return map[docType];
}

function diffSnapshots(newSnapshot: Record<string, unknown>, oldSnapshot: Record<string, unknown>) {
  const keys = new Set([...Object.keys(newSnapshot), ...Object.keys(oldSnapshot)]);
  const result: Array<{ field: string; before: string; after: string }> = [];
  for (const key of keys) {
    const beforeRaw = oldSnapshot[key];
    const afterRaw = newSnapshot[key];
    if (JSON.stringify(beforeRaw) === JSON.stringify(afterRaw)) continue;
    result.push({
      field: key,
      before: beforeRaw == null ? "-" : String(beforeRaw),
      after: afterRaw == null ? "-" : String(afterRaw)
    });
  }
  return result;
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const now = new Date();
  const target = new Date(value);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function dueBadgeClass(days: number | null) {
  if (days == null) return "bg-muted text-muted-foreground";
  if (days < 0) return "bg-status-error/20 text-status-error";
  if (days <= 30) return "bg-status-warning/20 text-status-warning";
  return "bg-status-success/20 text-status-success";
}

function dueLabel(prefix: string, days: number | null) {
  if (days == null) return `${prefix}: не задано`;
  if (days < 0) return `${prefix}: просрочено (${Math.abs(days)} дн.)`;
  if (days === 0) return `${prefix}: сегодня`;
  return `${prefix}: через ${days} дн.`;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function approvalCommentForUi(raw?: string | null) {
  if (!raw?.trim()) return "Комментарий отсутствует";
  const text = raw.trim();

  if (text.startsWith("[MAINTENANCE_EXIT:")) {
    const markerEnd = text.indexOf("]");
    const content = markerEnd >= 0 ? text.slice(markerEnd + 1).trim() : "";
    const decisionIndex = content.indexOf("\n[DECISION]:");
    const userPart = decisionIndex >= 0 ? content.slice(0, decisionIndex).trim() : content;
    return userPart || "Вывод из технического обслуживания";
  }

  if (text.startsWith("[PPR_PLAN:")) {
    const markerEnd = text.indexOf("]");
    const content = markerEnd >= 0 ? text.slice(markerEnd + 1).trim() : "";
    const decisionIndex = content.indexOf("\n[DECISION]:");
    const payloadPart = decisionIndex >= 0 ? content.slice(0, decisionIndex).trim() : content;
    try {
      const parsed = JSON.parse(payloadPart) as { comments?: string };
      if (parsed.comments?.trim()) return parsed.comments.trim();
      return "Обновление графика ППР";
    } catch {
      return "Обновление графика ППР";
    }
  }

  const decisionIndex = text.indexOf("\n[DECISION]:");
  if (decisionIndex >= 0) {
    const userPart = text.slice(0, decisionIndex).trim();
    return userPart || "Комментарий отсутствует";
  }

  return text;
}

function buildPprSchedule(lastServiceDate: string, intervalDays: number, horizonMonths: number): PprSchedulePoint[] {
  const pprLastDate = lastServiceDate ? new Date(lastServiceDate) : null;
  if (!pprLastDate || Number.isNaN(pprLastDate.getTime())) return [];
  if (!Number.isFinite(intervalDays) || intervalDays <= 0) return [];
  if (!Number.isFinite(horizonMonths) || horizonMonths <= 0) return [];

  const pprNextDate = addDays(pprLastDate, intervalDays);
  const pprHorizonDate = addMonths(pprLastDate, horizonMonths);
  const rows: PprSchedulePoint[] = [];
  let cursor = new Date(pprNextDate);
  while (cursor <= pprHorizonDate && rows.length < 24) {
    const daysLeft = Math.ceil((cursor.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    rows.push({ date: cursor.toISOString().slice(0, 10), daysLeft });
    cursor = addDays(cursor, intervalDays);
  }
  return rows;
}

export default function EquipmentDetailsPage() {
  const { user } = useCurrentUser();
  const canEdit = hasAnyRole(user, ["EDITOR", "ADMIN"]);
  const canApprove = hasAnyRole(user, ["APPROVER", "ADMIN"]);
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("overview");
  const [item, setItem] = useState<EquipmentDetails | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [docCreateOpen, setDocCreateOpen] = useState(false);
  const [docVersionOpen, setDocVersionOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

  const [newDoc, setNewDoc] = useState({
    title: "",
    docType: "PASSPORT",
    fileName: "",
    storagePath: "",
    checksum: "",
    notes: ""
  });
  const [newVersion, setNewVersion] = useState({ fileName: "", storagePath: "", checksum: "", notes: "" });
  const [uploadingDocFile, setUploadingDocFile] = useState(false);
  const [uploadingVersionFile, setUploadingVersionFile] = useState(false);
  const [maintenanceSubmitting, setMaintenanceSubmitting] = useState(false);
  const [uploadingMaintenanceAct, setUploadingMaintenanceAct] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    comments: "",
    fileName: "",
    storagePath: "",
    checksum: "",
    notes: ""
  });
  const [pprSaving, setPprSaving] = useState(false);
  const [pprForm, setPprForm] = useState({
    lastServiceDate: "",
    intervalDays: 90,
    horizonMonths: 12,
    comments: ""
  });
  const [pprIntervalTypes, setPprIntervalTypes] = useState<Record<string, PprMaintenanceType>>({});
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentStatusFilter, setDocumentStatusFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");
  const [historySort, setHistorySort] = useState<"desc" | "asc">("desc");
  const [eventSearch, setEventSearch] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [eventSort, setEventSort] = useState<"desc" | "asc">("desc");
  const [approvalSearch, setApprovalSearch] = useState("");
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<Approval["status"] | "all">("all");
  const [approvalSort, setApprovalSort] = useState<"desc" | "asc">("desc");
  const [typeAttributeDefinitions, setTypeAttributeDefinitions] = useState<EquipmentTypeAttributeDefinition[]>([]);

  const [compareFrom, setCompareFrom] = useState<number | "">("");
  const [compareTo, setCompareTo] = useState<number | "">("");

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/equipment");
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [equipmentRes, approvalsRes, settingsRes] = await Promise.all([
        fetch(`/api/equipment/${params.id}`),
        fetch("/api/approvals?page=1&pageSize=300"),
        fetch("/api/settings/public", { cache: "no-store" })
      ]);

      if (!equipmentRes.ok || !approvalsRes.ok || !settingsRes.ok) {
        setError("Не удалось загрузить карточку оборудования");
        return;
      }

      const equipmentData: EquipmentDetails = await equipmentRes.json();
      const approvalsData: Paged<Approval & { target?: { equipmentId?: string } | null }> = await approvalsRes.json();
      const settingsData: RuntimeSettings = await settingsRes.json();
      setItem(equipmentData);
      setSelectedDoc(equipmentData.documents[0] || null);
      setApprovals((approvalsData.items || []).filter((a) => (a as { target?: { equipmentId?: string } }).target?.equipmentId === equipmentData.id));
      setRuntimeSettings(settingsData);
    } catch {
      setError("Сетевая ошибка при загрузке карточки оборудования");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  useEffect(() => {
    const equipmentType = item?.type;
    if (!equipmentType) {
      setTypeAttributeDefinitions([]);
      return;
    }
    const loadTypeAttributes = async () => {
      try {
        const res = await fetch(`/api/equipment-type-attributes?type=${encodeURIComponent(equipmentType)}`, { cache: "no-store" });
        if (!res.ok) {
          setTypeAttributeDefinitions([]);
          return;
        }
        const data: EquipmentTypeAttributeDefinition[] = await res.json();
        setTypeAttributeDefinitions(data || []);
      } catch {
        setTypeAttributeDefinitions([]);
      }
    };
    void loadTypeAttributes();
  }, [item?.type]);

  useEffect(() => {
    if (!item) return;
    const attrs = (item.customAttributes || {}) as Record<string, string>;
    const intervalDays = Number(attrs.__ppr_interval_days || 90);
    const horizonMonths = Number(attrs.__ppr_horizon_months || 12);
    const lastServiceDate = attrs.__ppr_last_service_date || item.serviceDueDate?.slice(0, 10) || new Date().toISOString().slice(0, 10);
    setPprForm((prev) => ({
      ...prev,
      lastServiceDate,
      intervalDays: Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : 90,
      horizonMonths: Number.isFinite(horizonMonths) && horizonMonths > 0 ? horizonMonths : 12
    }));

    const intervalTypesRaw = attrs.__ppr_interval_maintenance_types;
    if (!intervalTypesRaw) {
      setPprIntervalTypes({});
      return;
    }
    try {
      const parsed = JSON.parse(intervalTypesRaw) as Array<{ date?: string; maintenanceType?: string }>;
      if (!Array.isArray(parsed)) {
        setPprIntervalTypes({});
        return;
      }
      const map: Record<string, PprMaintenanceType> = {};
      for (const point of parsed) {
        if (!point?.date) continue;
        const type = point.maintenanceType || "";
        if (["PREVENTIVE", "SEASONAL", "CAPITAL", "DIAGNOSTIC"].includes(type)) {
          map[point.date] = type as PprMaintenanceType;
        }
      }
      setPprIntervalTypes(map);
    } catch {
      setPprIntervalTypes({});
    }
  }, [item]);

  useEffect(() => {
    const onEscape = () => {
      setDocCreateOpen(false);
      setDocVersionOpen(false);
    };
    window.addEventListener(ESCAPE_EVENT, onEscape);
    return () => window.removeEventListener(ESCAPE_EVENT, onEscape);
  }, []);

  const versionCompare = useMemo(() => {
    if (!item || !compareFrom || !compareTo) return [];
    const from = item.versions.find((version) => version.versionNumber === compareFrom);
    const to = item.versions.find((version) => version.versionNumber === compareTo);
    if (!from || !to) return [];
    return diffSnapshots(to.snapshot || {}, from.snapshot || {});
  }, [item, compareFrom, compareTo]);

  const filteredDocuments = useMemo(() => {
    if (!item) return [];
    const q = documentSearch.trim().toLowerCase();
    return item.documents.filter((document) => {
      const matchesStatus = documentStatusFilter === "all" || document.status === documentStatusFilter;
      const matchesSearch =
        !q ||
        document.title.toLowerCase().includes(q) ||
        labelDocType(document.docType).toLowerCase().includes(q) ||
        (document.versions[0]?.fileName || "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [item, documentSearch, documentStatusFilter]);

  const filteredHistoryVersions = useMemo(() => {
    if (!item) return [];
    const q = historySearch.trim().toLowerCase();
    const rows = item.versions.filter((version) => {
      if (!q) return true;
      return (
        String(version.versionNumber).includes(q) ||
        (version.changeSummary || "").toLowerCase().includes(q) ||
        version.createdBy.displayName.toLowerCase().includes(q)
      );
    });
    return rows.sort((a, b) =>
      historySort === "desc" ? b.versionNumber - a.versionNumber : a.versionNumber - b.versionNumber
    );
  }, [item, historySearch, historySort]);

  const filteredEvents = useMemo(() => {
    if (!item) return [];
    const q = eventSearch.trim().toLowerCase();
    const rows = item.events.filter((event) => {
      const matchesType = eventTypeFilter === "all" || event.eventType === eventTypeFilter;
      const matchesSearch =
        !q ||
        event.title.toLowerCase().includes(q) ||
        (event.description || "").toLowerCase().includes(q) ||
        eventTypeLabel(event.eventType).toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
    return rows.sort((a, b) =>
      eventSort === "desc"
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [item, eventSearch, eventTypeFilter, eventSort]);

  const filteredApprovals = useMemo(() => {
    const q = approvalSearch.trim().toLowerCase();
    const rows = approvals.filter((approval) => {
      const matchesStatus = approvalStatusFilter === "all" || approval.status === approvalStatusFilter;
      const comment = approvalCommentForUi(approval.comments).toLowerCase();
      const matchesSearch =
        !q ||
        comment.includes(q) ||
        approval.requestedBy.displayName.toLowerCase().includes(q) ||
        (approval.decidedBy?.displayName || "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
    return rows.sort((a, b) =>
      approvalSort === "desc"
        ? new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        : new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );
  }, [approvals, approvalSearch, approvalStatusFilter, approvalSort]);

  const additionalAttributeEntries = useMemo(() => {
    if (!item) return [] as Array<[string, string]>;
    return Object.entries(item.customAttributes || {}).filter(([key]) => !isTechnicalAttributeKey(key));
  }, [item]);

  const typeAttributeByKey = useMemo(() => {
    const map = new Map<string, EquipmentTypeAttributeDefinition>();
    for (const definition of typeAttributeDefinitions) {
      map.set(definition.key, definition);
      map.set(normalizeAttributeKey(definition.key), definition);
    }
    return map;
  }, [typeAttributeDefinitions]);

  const createDocument = async () => {
    if (!item) return;
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipmentId: item.id, ...newDoc })
      });
      if (!res.ok) {
        setError("Не удалось создать документ");
        notifyError("Не удалось создать документ");
        return;
      }
      setDocCreateOpen(false);
      setNewDoc({ title: "", docType: "PASSPORT", fileName: "", storagePath: "", checksum: "", notes: "" });
      notifySuccess("Документ создан");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сетевая ошибка при создании документа");
      notifyError("Ошибка создания документа");
    }
  };

  const createDocumentVersion = async () => {
    if (!selectedDocId) return;
    try {
      const res = await fetch(`/api/documents/${selectedDocId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newVersion)
      });
      if (!res.ok) {
        setError("Не удалось создать новую версию документа");
        notifyError("Не удалось создать новую версию");
        return;
      }
      setDocVersionOpen(false);
      setNewVersion({ fileName: "", storagePath: "", checksum: "", notes: "" });
      notifySuccess("Новая версия загружена");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сетевая ошибка при создании версии документа");
      notifyError("Ошибка загрузки версии документа");
    }
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/files/upload", {
      method: "POST",
      body: formData
    });
    if (!res.ok) throw new Error("upload failed");
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
      notifySuccess("Файл документа загружен");
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

  const onSelectMaintenanceActFile = async (file?: File | null) => {
    if (!file) return;
    setUploadingMaintenanceAct(true);
    try {
      const uploaded = await uploadFile(file);
      setMaintenanceForm((prev) => ({
        ...prev,
        fileName: uploaded.fileName,
        storagePath: uploaded.storagePath,
        checksum: uploaded.checksum
      }));
      notifySuccess("Акт выполненных работ загружен");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка загрузки акта");
      notifyError("Ошибка загрузки акта");
    } finally {
      setUploadingMaintenanceAct(false);
    }
  };

  const submitMaintenance = async (mode: "ENTER" | "EXIT") => {
    if (!item) return;
    if (mode === "EXIT" && (!maintenanceForm.fileName || !maintenanceForm.storagePath || !maintenanceForm.checksum)) {
      setError("Для вывода из ТО требуется прикрепить акт выполненных работ");
      notifyError("Прикрепите акт выполненных работ");
      return;
    }
    setMaintenanceSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/equipment/${item.id}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          comments: maintenanceForm.comments,
          fileName: mode === "EXIT" ? maintenanceForm.fileName : undefined,
          storagePath: mode === "EXIT" ? maintenanceForm.storagePath : undefined,
          checksum: mode === "EXIT" ? maintenanceForm.checksum : undefined,
          notes: mode === "EXIT" ? maintenanceForm.notes : undefined
        })
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const message = payload.error || "Не удалось выполнить операцию ТО";
        setError(message);
        notifyError(message);
        return;
      }
      notifySuccess(
        mode === "ENTER"
          ? "Оборудование переведено в ТО"
          : "Вывод из ТО отправлен на согласование. Статус сменится после одобрения."
      );
      setMaintenanceForm({ comments: "", fileName: "", storagePath: "", checksum: "", notes: "" });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сетевая ошибка при операции ТО");
      notifyError("Сетевая ошибка при операции ТО");
    } finally {
      setMaintenanceSubmitting(false);
    }
  };

  const savePprPlan = async () => {
    if (!item) return;
    if (!canEdit) {
      setError("Изменение графика ППР доступно только редакторам и администраторам");
      notifyError("Недостаточно прав для изменения графика ППР");
      return;
    }
    if (item.status === "DECOMMISSIONED") {
      setError("Для списанного оборудования график ППР недоступен");
      notifyError("График ППР заблокирован для списанного оборудования");
      return;
    }
    if (!pprForm.lastServiceDate) {
      setError("Укажите дату последнего ТО");
      notifyError("Укажите дату последнего ТО");
      return;
    }
    if (!pprForm.comments.trim()) {
      setError("Укажите цель отправки плана ППР на согласование");
      notifyError("Комментарий с целью отправки обязателен");
      return;
    }
    const intervalMaintenanceTypes = buildPprSchedule(
      pprForm.lastServiceDate,
      Number(pprForm.intervalDays),
      Number(pprForm.horizonMonths)
    ).map((point) => ({
      date: point.date,
      maintenanceType: pprIntervalTypes[point.date] || DEFAULT_PPR_MAINTENANCE_TYPE
    }));
    const primaryMaintenanceType = intervalMaintenanceTypes[0]?.maintenanceType || DEFAULT_PPR_MAINTENANCE_TYPE;

    setPprSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/equipment/${item.id}/ppr-plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastServiceDate: pprForm.lastServiceDate,
          intervalDays: Number(pprForm.intervalDays),
          horizonMonths: Number(pprForm.horizonMonths),
          maintenanceType: primaryMaintenanceType,
          intervalMaintenanceTypes,
          comments: pprForm.comments.trim()
        })
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const message = payload.error || "Не удалось отправить график ППР на согласование";
        setError(message);
        notifyError(message);
        return;
      }
      notifySuccess("График ППР отправлен на согласование");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сетевая ошибка при сохранении графика ППР");
      notifyError("Сетевая ошибка при сохранении графика ППР");
    } finally {
      setPprSaving(false);
    }
  };

  const markAsObsolete = async (documentId: string) => {
    const confirmed = window.confirm("Пометить документ как устаревший?");
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/documents/${documentId}/archive`, {
        method: "POST"
      });
      if (!res.ok) {
        setError("Не удалось перевести документ в устаревшие");
        notifyError("Не удалось пометить документ устаревшим");
        return;
      }
      notifySuccess("Документ помечен как устаревший");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сетевая ошибка при архивировании документа");
      notifyError("Ошибка архивирования документа");
    }
  };

  if (loading) return <LoadingState text="Загрузка карточки оборудования..." />;
  if (error || !item) return <ErrorState text={error || "Оборудование не найдено"} />;

  const statusBadge = equipmentStatusBadgeClass(item.status);
  const isInMaintenance = item.lifecycleStage === "MAINTENANCE";
  const isDecommissioned = item.status === "DECOMMISSIONED";
  const maintenanceExitApproval = approvals.find(
    (approval) =>
      ["DRAFT", "PENDING", "APPROVED", "REJECTED"].includes(approval.status) &&
      (approval.comments || "").startsWith(`[MAINTENANCE_EXIT:${item.id}]`)
  );
  const hasPendingMaintenanceExitApproval = approvals.some(
    (approval) =>
      ["DRAFT", "PENDING"].includes(approval.status) &&
      (approval.comments || "").startsWith(`[MAINTENANCE_EXIT:${item.id}]`)
  );
  const pprApproval = approvals.find(
    (approval) =>
      ["DRAFT", "PENDING", "APPROVED", "REJECTED"].includes(approval.status) &&
      (approval.comments || "").startsWith(`[PPR_PLAN:${item.id}]`)
  );
  const hasPendingPprApproval = approvals.some(
    (approval) =>
      ["DRAFT", "PENDING"].includes(approval.status) && (approval.comments || "").startsWith(`[PPR_PLAN:${item.id}]`)
  );
  const serviceDueDays = daysUntil(item.serviceDueDate);
  const warrantyDueDays = daysUntil(item.warrantyExpiration);
  const tabCounts = {
    documents: item.documents.length,
    history: item.versions.length,
    events: item.events.length,
    approvals: approvals.length
  };
  const lastPprDate = (() => {
    const attrs = (item.customAttributes || {}) as Record<string, string>;
    const value = attrs.__ppr_last_service_date;
    return value?.slice(0, 10) || null;
  })();
  const pprLastDate = pprForm.lastServiceDate ? new Date(pprForm.lastServiceDate) : null;
  const pprNextDate = pprLastDate ? addDays(pprLastDate, Number(pprForm.intervalDays || 0)) : null;
  const pprSchedule = buildPprSchedule(
    pprForm.lastServiceDate,
    Number(pprForm.intervalDays || 0),
    Number(pprForm.horizonMonths || 0)
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={goBack} title="Назад">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Breadcrumbs items={[{ label: "Оборудование", href: "/equipment" }, { label: item.name }]} />
        </div>
        <div className="flex gap-2">
          {canEdit ? (
            <Link href={`/equipment/${item.id}/edit`}>
              <Button className="gap-2"><PencilLine className="h-4 w-4" />Редактировать</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{item.equipmentCode} - {item.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Модель: {item.model} • Обновлено: {new Date(item.updatedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={`border-0 ${dueBadgeClass(serviceDueDays)}`}>{dueLabel("ТО", serviceDueDays)}</Badge>
            <Badge className={`border-0 ${dueBadgeClass(warrantyDueDays)}`}>{dueLabel("Гарантия", warrantyDueDays)}</Badge>
            <Badge className={`border-0 ${item.summary.missingRequiredDocuments.length ? "bg-status-error/20 text-status-error" : "bg-status-success/20 text-status-success"}`}>
              {item.summary.missingRequiredDocuments.length ? `Не хватает документов: ${item.summary.missingRequiredDocuments.length}` : "Обязательные документы в порядке"}
            </Badge>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground">Версия</p>
            <p className="font-semibold">v{item.currentVersion}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground">Документы</p>
            <p className="font-semibold">{item.documents.length}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground">События</p>
            <p className="font-semibold">{item.events.length}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground">Открытые согласования</p>
            <p className="font-semibold">{item.summary.openApprovals}</p>
          </div>
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex overflow-x-auto border-b border-border">
          {(["overview", "maintenance", "documents", "history", "events", "approvals"] as Tab[]).map((value) => (
            <button key={value} className={`border-b-2 px-5 py-3 text-sm font-medium ${tab === value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`} onClick={() => setTab(value)}>
              {value === "overview"
                ? "Обзор"
                : value === "maintenance"
                  ? "График ППР"
                  : value === "history"
                    ? `История (${tabCounts.history})`
                    : value === "documents"
                      ? `Документы (${tabCounts.documents})`
                      : value === "events"
                        ? `События (${tabCounts.events})`
                        : `Согласования (${tabCounts.approvals})`}
            </button>
          ))}
        </div>
      </Card>

      {tab === "overview" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card className="p-6">
              <h2 className="text-lg font-semibold">Основная информация</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Тип</p><p className="mt-1">{item.type || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Категория</p><p className="mt-1">{item.category || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Модель</p><p className="mt-1">{item.model}</p></div>
                <div><p className="text-xs text-muted-foreground">Серийный номер</p><p className="mt-1 font-mono">{item.serialNumber || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Инвентарный номер</p><p className="mt-1 font-mono">{item.inventoryNumber || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Производитель</p><p className="mt-1">{item.manufacturer || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Поставщик</p><p className="mt-1">{item.supplier || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Подразделение</p><p className="mt-1">{item.department || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Локация</p><p className="mt-1">{item.location || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Ответственный</p><p className="mt-1">{item.responsibleUser?.displayName || "-"}</p></div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold">Гарантия и примечания</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div><p className="text-xs text-muted-foreground">Окончание гарантии</p><p className="mt-1">{item.warrantyExpiration?.slice(0, 10) || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Дата производства</p><p className="mt-1">{item.productionDate?.slice(0, 10) || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Дата ввода в эксплуатацию</p><p className="mt-1">{item.commissioningDate?.slice(0, 10) || "-"}</p></div>
              </div>
              <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-sm">{item.notes || "Примечания отсутствуют."}</div>
            </Card>

            {additionalAttributeEntries.length > 0 ? (
              <Card className="p-6">
                <h2 className="text-lg font-semibold">Дополнительные атрибуты</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {additionalAttributeEntries.map(([key, value]) => {
                    const definition = typeAttributeByKey.get(key) || typeAttributeByKey.get(normalizeAttributeKey(key));
                    const label = definition?.label || humanizeAttributeKey(key);
                    const selectOptionLabel =
                      definition?.dataType === "SELECT"
                        ? definition.options?.find((option) => option.value === value)?.label
                        : null;
                    return (
                      <div key={key}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1">{selectOptionLabel || value || "-"}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : null}
          </div>

          <Card className="h-fit p-6">
            <h2 className="text-lg font-semibold">Сводная панель</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Текущий статус</span><Badge className={`border-0 ${statusBadge}`}>{equipmentStatusLabel(item.status)}</Badge></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Текущая версия</span><span>v{item.currentVersion}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Последнее обновление</span><span>{new Date(item.updatedAt).toLocaleString()}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Открытые согласования</span><span>{item.summary.openApprovals}</span></div>
              <div>
                <p className="text-muted-foreground">Отсутствующие обязательные документы</p>
                {item.summary.missingRequiredDocuments.length === 0 ? (
                  <p className="mt-1 text-status-success">Все обязательные документы на месте.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.summary.missingRequiredDocuments.map((docType) => (
                      <Badge key={docType} className="border-0 bg-status-error/20 text-status-error">
                        {labelDocType(docType as DocumentItem["docType"])}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </Card>
        </div>
      ) : null}

      {tab === "maintenance" ? (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-semibold">Управление техническим обслуживанием</p>
              <Badge className={`border-0 ${isInMaintenance ? "bg-status-warning/20 text-status-warning" : "bg-status-success/20 text-status-success"}`}>
                {isInMaintenance ? "Текущее состояние: В ТО" : "Текущее состояние: В эксплуатации"}
              </Badge>
            </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Здесь выполняется перевод в ТО и вывод из ТО с обязательным согласованием акта выполненных работ.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Дата последнего ППР: {lastPprDate || "не задана"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Плановая дата следующего ТО: {item.serviceDueDate?.slice(0, 10) || "не задана"}
              </p>
          </Card>

          {maintenanceExitApproval ? (
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Последняя заявка на вывод из ТО</p>
                  <p className="text-xs text-muted-foreground">
                    ID: {maintenanceExitApproval.id.slice(0, 8)} • {new Date(maintenanceExitApproval.submittedAt).toLocaleString()}
                  </p>
                </div>
                <Badge className={`border-0 ${maintenanceExitApproval.status === "APPROVED" ? "bg-status-success/20 text-status-success" : maintenanceExitApproval.status === "REJECTED" ? "bg-status-error/20 text-status-error" : "bg-status-warning/20 text-status-warning"}`}>
                  {approvalStatusLabel(maintenanceExitApproval.status)}
                </Badge>
              </div>
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => setTab("approvals")}>Открыть вкладку согласований</Button>
              </div>
            </Card>
          ) : null}

          <Card className="space-y-4 p-4">
            {canEdit ? (
              !isInMaintenance ? (
                <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
                  <p className="text-sm font-medium">Следующее действие: перевод в ТО</p>
                  <p className="text-sm text-muted-foreground">Оборудование в эксплуатации, можно начать обслуживание одним действием.</p>
                  <Input
                    placeholder="Комментарий (необязательно)"
                    value={maintenanceForm.comments}
                    onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, comments: e.target.value }))}
                  />
                  <Button className="w-full md:w-auto" disabled={maintenanceSubmitting || item.status === "DECOMMISSIONED"} onClick={() => void submitMaintenance("ENTER")}>
                    {maintenanceSubmitting ? "Выполняем..." : "Перевести в ТО"}
                  </Button>
                </div>
              ) : hasPendingMaintenanceExitApproval ? (
                <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
                  <p className="text-sm font-medium">Следующее действие: ожидание согласования</p>
                  <p className="text-sm text-muted-foreground">Заявка на вывод из ТО уже отправлена и ожидает решения согласующего.</p>
                  <Button className="w-full md:w-auto" variant="outline" onClick={() => setTab("approvals")}>
                    Открыть согласования
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
                  <p className="text-sm font-medium">Следующее действие: вывод из ТО</p>
                  <p className="text-sm text-muted-foreground">Шаг 1: загрузите акт. Шаг 2: отправьте заявку на согласование.</p>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={(e) => void onSelectMaintenanceActFile(e.target.files?.[0])}
                  />
                  <Input
                    placeholder="Комментарий к заявке (например: завершены работы ТО)"
                    value={maintenanceForm.comments}
                    onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, comments: e.target.value }))}
                  />
                  <Input
                    placeholder="Примечание к акту"
                    value={maintenanceForm.notes}
                    onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                  <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                    <p>Файл: {maintenanceForm.fileName || "не загружен"}</p>
                    <p className="mt-1">
                      Готовность: {maintenanceForm.fileName && maintenanceForm.storagePath && maintenanceForm.checksum ? "можно отправлять" : "нужно загрузить акт"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="w-full md:w-auto"
                      disabled={maintenanceSubmitting || uploadingMaintenanceAct || !maintenanceForm.fileName || !maintenanceForm.storagePath || !maintenanceForm.checksum}
                      onClick={() => void submitMaintenance("EXIT")}
                    >
                      {maintenanceSubmitting ? "Отправляем..." : uploadingMaintenanceAct ? "Загрузка акта..." : "Отправить вывод из ТО на согласование"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full md:w-auto"
                      disabled={maintenanceSubmitting}
                      onClick={() => setMaintenanceForm((prev) => ({ ...prev, comments: "", notes: "", fileName: "", storagePath: "", checksum: "" }))}
                    >
                      Очистить форму
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <p className="text-sm text-muted-foreground">Изменение статуса ТО доступно только редакторам и администраторам.</p>
            )}
          </Card>

          <Card className="space-y-4 p-4">
            <div>
              <p className="text-base font-semibold">График ППР</p>
              <p className="text-sm text-muted-foreground">Сформируйте график, отправьте на согласование и отслеживайте сроки выполнения.</p>
            </div>
            {!canEdit ? (
              <div className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                Просмотр доступен, но изменение графика ППР разрешено только редакторам и администраторам.
              </div>
            ) : null}
            {isDecommissioned ? (
              <div className="rounded-md border border-status-error/40 bg-status-error/10 p-3 text-sm text-status-error">
                Оборудование списано. Редактирование и отправка графика ППР заблокированы.
              </div>
            ) : null}
            {pprApproval ? (
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">Последняя заявка по графику ППР</p>
                    <p className="text-xs text-muted-foreground">
                      ID: {pprApproval.id.slice(0, 8)} • {new Date(pprApproval.submittedAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge className={`border-0 ${pprApproval.status === "APPROVED" ? "bg-status-success/20 text-status-success" : pprApproval.status === "REJECTED" ? "bg-status-error/20 text-status-error" : "bg-status-warning/20 text-status-warning"}`}>
                    {approvalStatusLabel(pprApproval.status)}
                  </Badge>
                </div>
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={() => setTab("approvals")}>Открыть согласования</Button>
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label className="text-sm font-medium">Последнее ТО</label>
                <Input
                  className="mt-1"
                  type="date"
                  value={pprForm.lastServiceDate}
                  disabled={!canEdit || isDecommissioned}
                  onChange={(e) => setPprForm((prev) => ({ ...prev, lastServiceDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Интервал, дней</label>
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  value={pprForm.intervalDays}
                  disabled={!canEdit || isDecommissioned}
                  onChange={(e) => setPprForm((prev) => ({ ...prev, intervalDays: Number(e.target.value || 90) }))}
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {[30, 60, 90, 180, 365].map((preset) => (
                    <Button key={preset} type="button" size="sm" variant="outline" disabled={!canEdit || isDecommissioned} onClick={() => setPprForm((prev) => ({ ...prev, intervalDays: preset }))}>
                      {preset}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Горизонт, месяцев</label>
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  max={60}
                  value={pprForm.horizonMonths}
                  disabled={!canEdit || isDecommissioned}
                  onChange={(e) => setPprForm((prev) => ({ ...prev, horizonMonths: Number(e.target.value || 12) }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Цель отправки (обязательно)</label>
                <Input
                  className="mt-1"
                  placeholder="Например: пересмотр интервала из-за роста нагрузки"
                  value={pprForm.comments}
                  disabled={!canEdit || isDecommissioned}
                  onChange={(e) => setPprForm((prev) => ({ ...prev, comments: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!canEdit || pprSaving || hasPendingPprApproval || isDecommissioned} onClick={() => void savePprPlan()}>
                {pprSaving ? "Отправляем..." : hasPendingPprApproval ? "Ожидает согласования" : "Отправить график ППР на согласование"}
              </Button>
              {hasPendingPprApproval ? (
                <Button variant="outline" onClick={() => setTab("approvals")}>
                  Перейти к согласованиям
                </Button>
              ) : null}
              <Badge className={`border-0 ${dueBadgeClass(pprNextDate ? Math.ceil((pprNextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null)}`}>
                {pprNextDate ? `Следующее ТО: ${pprNextDate.toISOString().slice(0, 10)}` : "Следующее ТО не рассчитано"}
              </Badge>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <p className="text-sm font-medium">Аналитика графика</p>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                <p>Точек ППР в горизонте: <span className="font-semibold">{pprSchedule.length}</span></p>
                <p>Ближайшая точка: <span className="font-semibold">{pprSchedule[0]?.date || "-"}</span></p>
                <p>Просроченных точек: <span className="font-semibold">{pprSchedule.filter((point) => point.daysLeft < 0).length}</span></p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 text-left">Дата ППР</th>
                    <th className="px-3 py-2 text-left">Тип ТО</th>
                    <th className="px-3 py-2 text-left">До срока</th>
                    <th className="px-3 py-2 text-left">Риск</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pprSchedule.map((point) => (
                    <tr key={point.date}>
                      <td className="px-3 py-2">{point.date}</td>
                      <td className="px-3 py-2">
                        <select
                          className="h-9 min-w-[170px] rounded-md border border-input bg-white px-2 text-sm"
                          value={pprIntervalTypes[point.date] || DEFAULT_PPR_MAINTENANCE_TYPE}
                          disabled={!canEdit || isDecommissioned}
                          onChange={(e) =>
                            setPprIntervalTypes((prev) => ({
                              ...prev,
                              [point.date]: e.target.value as PprMaintenanceType
                            }))
                          }
                        >
                          <option value="PREVENTIVE">{pprMaintenanceTypeLabel("PREVENTIVE")}</option>
                          <option value="SEASONAL">{pprMaintenanceTypeLabel("SEASONAL")}</option>
                          <option value="CAPITAL">{pprMaintenanceTypeLabel("CAPITAL")}</option>
                          <option value="DIAGNOSTIC">{pprMaintenanceTypeLabel("DIAGNOSTIC")}</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">{point.daysLeft < 0 ? `${Math.abs(point.daysLeft)} дн. просрочки` : `${point.daysLeft} дн.`}</td>
                      <td className="px-3 py-2">
                        <Badge className={`border-0 ${point.daysLeft < 0 ? "bg-status-error/20 text-status-error" : point.daysLeft <= 30 ? "bg-status-warning/20 text-status-warning" : "bg-status-success/20 text-status-success"}`}>
                          {point.daysLeft < 0 ? "Критично" : point.daysLeft <= 30 ? "Скоро" : "Планово"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {pprSchedule.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-muted-foreground" colSpan={4}>
                        Укажите параметры графика, чтобы увидеть расчет.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Input
                placeholder="Поиск по версии, автору, комментарию"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
              <select
                className="h-10 rounded-md border border-input bg-white px-3 text-sm"
                value={historySort}
                onChange={(e) => setHistorySort(e.target.value as "desc" | "asc")}
              >
                <option value="desc">Сначала новые версии</option>
                <option value="asc">Сначала старые версии</option>
              </select>
              <div className="h-10 rounded-md border border-input bg-muted/20 px-3 text-sm leading-10">
                Найдено версий: {filteredHistoryVersions.length}
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-lg font-semibold">Сравнение версий</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label className="text-sm font-medium">Из версии</label>
                <select className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3 text-sm" value={compareFrom} onChange={(e) => setCompareFrom(Number(e.target.value))}>
                  <option value="">Выберите</option>
                  {filteredHistoryVersions.map((version) => <option key={version.id} value={version.versionNumber}>v{version.versionNumber}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">В версию</label>
                <select className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3 text-sm" value={compareTo} onChange={(e) => setCompareTo(Number(e.target.value))}>
                  <option value="">Выберите</option>
                  {filteredHistoryVersions.map((version) => <option key={version.id} value={version.versionNumber}>v{version.versionNumber}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Измененные поля</label>
                <div className="mt-1 h-10 rounded-md border border-input bg-muted/20 px-3 text-sm leading-10">{versionCompare.length} полей изменено</div>
              </div>
            </div>
            {compareFrom && compareTo ? (
              <div className="mt-4 overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30"><tr><th className="px-3 py-2 text-left">Поле</th><th className="px-3 py-2 text-left">Было</th><th className="px-3 py-2 text-left">Стало</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {versionCompare.map((row) => <tr key={row.field}><td className="px-3 py-2 font-medium">{row.field}</td><td className="px-3 py-2">{row.before}</td><td className="px-3 py-2">{row.after}</td></tr>)}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Card>

          <Card className="p-0">
            {filteredHistoryVersions.length === 0 ? (
              <EmptyState text="По текущему фильтру версии не найдены." />
            ) : (
            <div className="divide-y divide-border">
              {filteredHistoryVersions.map((version) => {
                const previous = item.versions.find((candidate) => candidate.versionNumber === version.versionNumber - 1);
                const fieldChanges = previous ? diffSnapshots(version.snapshot || {}, previous.snapshot || {}) : [];
                return (
                  <div key={version.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Версия {version.versionNumber}</p>
                        <p className="text-sm text-muted-foreground">{version.changeSummary || "Комментарий отсутствует"}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground"><p>{new Date(version.createdAt).toLocaleString()}</p><p>Автор: {version.createdBy.displayName}</p></div>
                    </div>
                    {fieldChanges.length > 0 ? (
                      <div className="mt-3 rounded-md border border-border bg-muted/20 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Изменения полей</p>
                        <div className="space-y-1 text-sm">
                          {fieldChanges.slice(0, 8).map((change) => <p key={`${version.id}-${change.field}`}><span className="font-medium">{change.field}</span>: {change.before} {"->"} {change.after}</p>)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "documents" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <Card className="space-y-3 p-4">
              <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Привязанные документы</h3>
                {canEdit ? (
                  <div className="flex gap-2">
                    <Button className="gap-2" onClick={() => { setDocCreateOpen(true); setDocVersionOpen(false); }}><FilePlus2 className="h-4 w-4" />Новый документ</Button>
                    <Button variant="outline" className="gap-2" onClick={() => { setDocVersionOpen(true); setDocCreateOpen(false); }}><GitBranchPlus className="h-4 w-4" />Новая версия</Button>
                  </div>
                ) : null}
              </div>
              {runtimeSettings && !runtimeSettings.workflow.documentChangesRequireApproval ? (
                <p className="text-xs text-status-success">
                  Согласование документов отключено в настройках. Кнопка отправки на согласование скрыта.
                </p>
              ) : null}

              <div className="grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/10 p-3 md:grid-cols-3">
                <div className="relative md:col-span-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-10" placeholder="Поиск по названию, типу или файлу" value={documentSearch} onChange={(e) => setDocumentSearch(e.target.value)} />
                </div>
                <select className="h-10 rounded-md border border-input bg-white px-3 text-sm" value={documentStatusFilter} onChange={(e) => setDocumentStatusFilter(e.target.value)}>
                  <option value="all">Все статусы</option>
                  <option value="DRAFT">Черновик</option>
                  <option value="IN_REVIEW">На проверке</option>
                  <option value="APPROVED">Согласован</option>
                  <option value="REJECTED">Отклонен</option>
                  <option value="ARCHIVED">Устаревший</option>
                </select>
              </div>

              {docCreateOpen ? (
                <div className="grid grid-cols-1 gap-3 rounded-md border border-border bg-muted/10 p-3 md:grid-cols-2">
                  <Input placeholder="Название документа" value={newDoc.title} onChange={(e) => setNewDoc((prev) => ({ ...prev, title: e.target.value }))} />
                  <Input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(e) => void onSelectDocFile(e.target.files?.[0])} />
                  <select className="h-10 rounded-md border border-input bg-white px-3 text-sm" value={newDoc.docType} onChange={(e) => setNewDoc((prev) => ({ ...prev, docType: e.target.value }))}>
                    <option value="PASSPORT">Паспорт</option><option value="OPERATION_MANUAL">Руководство по эксплуатации</option><option value="CERTIFICATE">Сертификат</option><option value="ACT">Акт</option><option value="DRAWING">Чертеж</option><option value="OTHER">Прочее</option>
                  </select>
                  <Input placeholder="Имя файла" value={newDoc.fileName} onChange={(e) => setNewDoc((prev) => ({ ...prev, fileName: e.target.value }))} />
                  <Input placeholder="Путь хранения или URL" value={newDoc.storagePath} onChange={(e) => setNewDoc((prev) => ({ ...prev, storagePath: e.target.value }))} />
                  <Input placeholder="Контрольная сумма" value={newDoc.checksum} onChange={(e) => setNewDoc((prev) => ({ ...prev, checksum: e.target.value }))} />
                  <Input placeholder="Примечание" value={newDoc.notes} onChange={(e) => setNewDoc((prev) => ({ ...prev, notes: e.target.value }))} />
                  <div className="md:col-span-2"><Button disabled={uploadingDocFile} onClick={() => void createDocument()}>{uploadingDocFile ? "Загрузка файла..." : "Создать документ"}</Button></div>
                </div>
              ) : null}

              {docVersionOpen ? (
                <div className="grid grid-cols-1 gap-3 rounded-md border border-border bg-muted/10 p-3 md:grid-cols-2">
                  <select className="h-10 rounded-md border border-input bg-white px-3 text-sm" value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)}>
                    <option value="">Выберите документ</option>
                    {item.documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}
                  </select>
                  <Input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(e) => void onSelectVersionFile(e.target.files?.[0])} />
                  <Input placeholder="Имя файла" value={newVersion.fileName} onChange={(e) => setNewVersion((prev) => ({ ...prev, fileName: e.target.value }))} />
                  <Input placeholder="Путь хранения или URL" value={newVersion.storagePath} onChange={(e) => setNewVersion((prev) => ({ ...prev, storagePath: e.target.value }))} />
                  <Input placeholder="Контрольная сумма" value={newVersion.checksum} onChange={(e) => setNewVersion((prev) => ({ ...prev, checksum: e.target.value }))} />
                  <Input placeholder="Примечание" value={newVersion.notes} onChange={(e) => setNewVersion((prev) => ({ ...prev, notes: e.target.value }))} />
                  <div className="md:col-span-2"><Button disabled={uploadingVersionFile} onClick={() => void createDocumentVersion()}>{uploadingVersionFile ? "Загрузка файла..." : "Загрузить новую версию"}</Button></div>
                </div>
              ) : null}

              {filteredDocuments.length === 0 ? (
                <EmptyState text="К этому оборудованию документы не привязаны." />
              ) : (
                <div className="space-y-2">
                  {filteredDocuments.map((document) => {
                    const currentVersion = document.versions[0];
                    return (
                      <button
                        key={document.id}
                        className={`w-full rounded-md border p-3 text-left transition-colors ${selectedDoc?.id === document.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/20"}`}
                        onClick={() => setSelectedDoc(document)}
                        onDoubleClick={() => router.push(`/documents/${document.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{document.title}</p>
                            <p className="text-sm text-muted-foreground">{labelDocType(document.docType)} • v{currentVersion?.versionNumber || "-"} • {currentVersion?.createdBy?.displayName || "Неизвестно"}</p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <p>{document.updatedAt.slice(0, 10)}</p>
                            <Badge className={`mt-1 border-0 ${documentStatusBadgeClass(document.status)}`}>{documentStatusLabel(document.status)}</Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

        <Card className="h-fit p-4">
          <h3 className="text-lg font-semibold">Панель метаданных</h3>
            {!selectedDoc ? (
              <EmptyState text="Выберите документ для просмотра метаданных и истории версий." />
            ) : (
              <div className="space-y-3">
                <div><p className="text-sm text-muted-foreground">Текущая версия</p><p className="font-medium">v{selectedDoc.versions[0]?.versionNumber || "-"}</p></div>
                <div>
                  <p className="text-sm text-muted-foreground">История версий</p>
                  <div className="mt-2 space-y-2">
                    {selectedDoc.versions.map((version, index) => (
                      <div key={version.id} className={`rounded-md border p-2 ${index === 0 ? "border-primary bg-primary/5" : "border-border"}`}>
                        <p className="text-sm font-medium">v{version.versionNumber} {index === 0 ? "(текущая)" : ""}</p>
                        <p className="text-xs text-muted-foreground">{version.fileName}</p>
                        <p className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</p>
                        {version.downloadUrl ? <a href={version.downloadUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" className="mt-2 gap-2"><Download className="h-3 w-3" />Скачать</Button></a> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "events" ? (
        <div className="space-y-4">
        <Card className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              className="md:col-span-2"
              placeholder="Поиск по названию, описанию, типу события"
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
            />
            <select
              className="h-10 rounded-md border border-input bg-white px-3 text-sm"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
            >
              <option value="all">Все типы</option>
              <option value="CREATED">Создание</option>
              <option value="UPDATED">Изменение</option>
              <option value="STATUS_CHANGED">Смена статуса</option>
              <option value="DOCUMENT_ATTACHED">Документ добавлен</option>
              <option value="APPROVAL_SUBMITTED">Отправлено на согласование</option>
              <option value="APPROVAL_RESOLVED">Решение по согласованию</option>
            </select>
            <select
              className="h-10 rounded-md border border-input bg-white px-3 text-sm"
              value={eventSort}
              onChange={(e) => setEventSort(e.target.value as "desc" | "asc")}
            >
              <option value="desc">Сначала новые</option>
              <option value="asc">Сначала старые</option>
            </select>
          </div>
        </Card>
        <Card className="p-0">
          {filteredEvents.length === 0 ? <EmptyState text="По текущему фильтру событий не найдено." /> : (
            <div className="divide-y divide-border">
              {filteredEvents.map((event) => (
                <div key={event.id} className="p-4">
                  {(() => {
                    const { Icon: EventIcon, iconClassName: eventIconClassName, wrapClassName: eventIconWrapClassName } = eventIconMeta(event.eventType);

                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${eventIconWrapClassName}`}>
                            <EventIcon className={`h-4 w-4 ${eventIconClassName}`} />
                          </span>
                          <p className="font-medium">{event.title}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description || eventTypeLabel(event.eventType)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </Card>
        </div>
      ) : null}

      {tab === "approvals" ? (
        <div className="space-y-4">
        <Card className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              className="md:col-span-2"
              placeholder="Поиск по комментарию, инициатору, согласующему"
              value={approvalSearch}
              onChange={(e) => setApprovalSearch(e.target.value)}
            />
            <select
              className="h-10 rounded-md border border-input bg-white px-3 text-sm"
              value={approvalStatusFilter}
              onChange={(e) => setApprovalStatusFilter(e.target.value as Approval["status"] | "all")}
            >
              <option value="all">Все статусы</option>
              <option value="DRAFT">Черновик</option>
              <option value="PENDING">Ожидает</option>
              <option value="APPROVED">Согласовано</option>
              <option value="REJECTED">Отклонено</option>
              <option value="CANCELED">Отменено</option>
            </select>
            <select
              className="h-10 rounded-md border border-input bg-white px-3 text-sm"
              value={approvalSort}
              onChange={(e) => setApprovalSort(e.target.value as "desc" | "asc")}
            >
              <option value="desc">Сначала новые</option>
              <option value="asc">Сначала старые</option>
            </select>
          </div>
        </Card>
        <Card className="p-0">
          {filteredApprovals.length === 0 ? <EmptyState text="По текущему фильтру согласований не найдено." /> : (
            <div className="divide-y divide-border">
              {filteredApprovals.map((approval) => (
                <div key={approval.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">Заявка на согласование</p>
                      <p className="text-sm text-muted-foreground">{approvalCommentForUi(approval.comments)}</p>
                      <p className="text-xs text-muted-foreground">Запросил(а): {approval.requestedBy.displayName}, {new Date(approval.submittedAt).toLocaleString()}</p>
                      {approval.status === "APPROVED" && approval.decidedBy?.displayName ? (
                        <p className="text-xs text-muted-foreground">Согласовал(а): {approval.decidedBy.displayName}</p>
                      ) : null}
                      {approval.status === "REJECTED" && approval.decidedBy?.displayName ? (
                        <p className="text-xs text-muted-foreground">Отклонил(а): {approval.decidedBy.displayName}</p>
                      ) : null}
                    </div>
                    <Badge className={`border-0 ${approval.status === "APPROVED" ? "bg-status-success/20 text-status-success" : approval.status === "REJECTED" ? "bg-status-error/20 text-status-error" : "bg-status-warning/20 text-status-warning"}`}>{approvalStatusLabel(approval.status)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        </div>
      ) : null}
    </div>
  );
}
