"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { hasAnyRole } from "@/lib/client/auth";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { notifyError, notifySuccess } from "@/lib/client/notify";
import { Archive, ArrowLeft, Copy, Download, FileBadge2, FileCheck2, FileCog2, FileSpreadsheet, FileText, PencilLine, Save, Send, Shapes, Trash2, X } from "lucide-react";

type RuntimeSettings = { workflow: { documentChangesRequireApproval: boolean } };

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

type DocumentDetails = {
  id: string;
  title: string;
  docType: "PASSPORT" | "OPERATION_MANUAL" | "CERTIFICATE" | "ACT" | "DRAWING" | "OTHER";
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  equipment: { id: string; equipmentCode: string; name: string };
  versions: DocumentVersion[];
};

type UploadedFilePayload = {
  fileName: string;
  storagePath: string;
  checksum: string;
};

function docTypeLabel(value: DocumentDetails["docType"]) {
  const map: Record<DocumentDetails["docType"], string> = {
    PASSPORT: "Паспорт",
    OPERATION_MANUAL: "Руководство по эксплуатации",
    CERTIFICATE: "Сертификат",
    ACT: "Акт",
    DRAWING: "Чертеж",
    OTHER: "Прочее"
  };
  return map[value];
}

function docTypeIcon(value: DocumentDetails["docType"], className = "h-5 w-5 text-muted-foreground") {
  if (value === "PASSPORT") return <FileBadge2 className={className} />;
  if (value === "OPERATION_MANUAL") return <FileText className={className} />;
  if (value === "CERTIFICATE") return <FileCheck2 className={className} />;
  if (value === "ACT") return <FileSpreadsheet className={className} />;
  if (value === "DRAWING") return <FileCog2 className={className} />;
  return <Shapes className={className} />;
}

function documentStatusLabel(status: DocumentDetails["status"]) {
  const map: Record<DocumentDetails["status"], string> = {
    DRAFT: "Черновик",
    IN_REVIEW: "На проверке",
    APPROVED: "Согласован",
    REJECTED: "Отклонен",
    ARCHIVED: "Устаревший"
  };
  return map[status];
}

function documentStatusBadgeClass(status: DocumentDetails["status"]) {
  if (status === "APPROVED") return "bg-status-success/20 text-status-success";
  if (status === "IN_REVIEW") return "bg-status-warning/20 text-status-warning";
  if (status === "REJECTED") return "bg-status-error/20 text-status-error";
  if (status === "DRAFT") return "bg-status-info/20 text-status-info";
  return "bg-muted text-muted-foreground";
}

function canSubmitForApproval(status: DocumentDetails["status"]) {
  return status === "DRAFT" || status === "REJECTED";
}

function canEditDocument(status: DocumentDetails["status"]) {
  return status === "DRAFT" || status === "REJECTED";
}

function shortChecksum(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export default function DocumentDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const canEdit = hasAnyRole(user, ["EDITOR", "ADMIN"]);

  const [item, setItem] = useState<DocumentDetails | null>(null);
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [uploadingEditFile, setUploadingEditFile] = useState(false);
  const [editForm, setEditForm] = useState<{ title: string; docType: DocumentDetails["docType"] }>({
    title: "",
    docType: "PASSPORT"
  });
  const [editFile, setEditFile] = useState<UploadedFilePayload | null>(null);
  const latestVersion = item?.versions?.[0] || null;

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/documents");
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [documentRes, settingsRes] = await Promise.all([
        fetch(`/api/documents/${params.id}`, { cache: "no-store" }),
        fetch("/api/settings/public", { cache: "no-store" })
      ]);
      if (!documentRes.ok || !settingsRes.ok) {
        setError("Не удалось загрузить документ");
        return;
      }
      const documentData: DocumentDetails = await documentRes.json();
      const settingsData: RuntimeSettings = await settingsRes.json();
      setItem(documentData);
      setEditForm({ title: documentData.title, docType: documentData.docType });
      setEditFile(null);
      setEditOpen(false);
      setRuntimeSettings(settingsData);
    } catch {
      setError("Сетевая ошибка при загрузке документа");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  const submitForApproval = async () => {
    if (!item) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/documents/${item.id}/submit-approval`, { method: "POST" });
      if (!res.ok) {
        setError("Не удалось отправить документ на согласование");
        notifyError("Не удалось отправить на согласование");
        return;
      }
      notifySuccess("Документ отправлен на согласование");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сетевая ошибка при отправке на согласование");
      notifyError("Ошибка отправки на согласование");
    } finally {
      setActionLoading(false);
    }
  };

  const markAsObsolete = async () => {
    if (!item) return;
    const confirmed = window.confirm("Пометить документ как устаревший?");
    if (!confirmed) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/documents/${item.id}/archive`, { method: "POST" });
      if (!res.ok) {
        setError("Не удалось перевести документ в устаревшие");
        notifyError("Не удалось пометить документ устаревшим");
        return;
      }
      notifySuccess("Документ помечен как устаревший");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сетевая ошибка при архивировании");
      notifyError("Ошибка архивирования документа");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteDraft = async () => {
    if (!item || item.status !== "DRAFT") return;
    const confirmed = window.confirm("Удалить черновик документа? Это действие нельзя отменить.");
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/documents/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Не удалось удалить черновик");
        notifyError("Не удалось удалить черновик");
        return;
      }
      notifySuccess("Черновик удален");
      router.push("/documents");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сетевая ошибка при удалении черновика");
      notifyError("Ошибка удаления черновика");
    } finally {
      setActionLoading(false);
    }
  };

  const saveDraftEdit = async () => {
    if (!item || !canEditDocument(item.status)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/documents/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          ...(editFile
            ? {
                fileName: editFile.fileName,
                storagePath: editFile.storagePath,
                checksum: editFile.checksum
              }
            : {})
        })
      });
      if (!res.ok) {
        setError("Не удалось сохранить изменения документа");
        notifyError("Не удалось сохранить документ");
        return;
      }
      notifySuccess("Документ сохранен");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сетевая ошибка при сохранении документа");
      notifyError("Ошибка сохранения документа");
    } finally {
      setActionLoading(false);
    }
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/files/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || "Не удалось загрузить файл");
    }
    return (await res.json()) as UploadedFilePayload;
  };

  const onSelectEditFile = async (file?: File | null) => {
    if (!file) return;
    setUploadingEditFile(true);
    try {
      const uploaded = await uploadFile(file);
      setEditFile(uploaded);
      notifySuccess("Новый файл подготовлен");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сетевая ошибка при загрузке файла");
      notifyError("Ошибка загрузки файла");
    } finally {
      setUploadingEditFile(false);
    }
  };

  const copyChecksum = async (checksum: string) => {
    try {
      await navigator.clipboard.writeText(checksum);
      notifySuccess("Контрольная сумма скопирована");
    } catch {
      notifyError("Не удалось скопировать контрольную сумму");
    }
  };

  if (loading) return <LoadingState text="Загрузка документа..." />;
  if (error || !item) return <ErrorState text={error || "Документ не найден"} />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={goBack} title="Назад">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Breadcrumbs
            items={[
              { label: "Документы", href: "/documents" },
              { label: item.title }
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`border-0 ${documentStatusBadgeClass(item.status)}`}>{documentStatusLabel(item.status)}</Badge>
          {latestVersion?.downloadUrl ? (
            <a href={latestVersion.downloadUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Скачать текущую
              </Button>
            </a>
          ) : null}
          <Link href={`/equipment/${item.equipment.id}`}>
            <Button variant="outline">Открыть оборудование</Button>
          </Link>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-xl font-semibold">
              {docTypeIcon(item.docType, "h-6 w-6 text-muted-foreground")}
              {item.title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {docTypeLabel(item.docType)} • {item.equipment.equipmentCode} - {item.equipment.name}
            </p>
          </div>
          <div className="grid min-w-[260px] grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-border bg-muted/20 p-2">
              <p className="text-xs text-muted-foreground">Текущая версия</p>
              <p className="mt-1 font-semibold">v{latestVersion?.versionNumber || "-"}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-2">
              <p className="text-xs text-muted-foreground">Всего версий</p>
              <p className="mt-1 font-semibold">{item.versions.length}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && canEditDocument(item.status) ? (
            <Button variant="outline" className="gap-2" disabled={actionLoading} onClick={() => setEditOpen((prev) => !prev)}>
              <PencilLine className="h-4 w-4" />
              {editOpen ? "Свернуть редактирование" : "Редактировать документ"}
            </Button>
          ) : null}
          {canEdit && runtimeSettings?.workflow.documentChangesRequireApproval && canSubmitForApproval(item.status) ? (
            <Button variant="outline" className="gap-2" disabled={actionLoading} onClick={() => void submitForApproval()}>
              <Send className="h-4 w-4" />
              На согласование
            </Button>
          ) : null}
          {canEdit && item.status !== "ARCHIVED" && item.status !== "DRAFT" ? (
            <Button variant="outline" className="gap-2" disabled={actionLoading} onClick={() => void markAsObsolete()}>
              <Archive className="h-4 w-4" />
              Сделать устаревшим
            </Button>
          ) : null}
          {canEdit && item.status === "DRAFT" ? (
            <Button variant="outline" className="gap-2 text-status-error hover:text-status-error" disabled={actionLoading} onClick={() => void deleteDraft()}>
              <Trash2 className="h-4 w-4" />
              Удалить черновик
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => router.push("/documents")}>Назад к реестру</Button>
        </div>
      </Card>

      {canEdit && canEditDocument(item.status) && editOpen ? (
        <Card className="p-4">
          <h2 className="text-lg font-semibold">Редактирование документа</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Название документа</label>
              <Input
                className="mt-1"
                value={editForm.title}
                onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Тип документа</label>
              <AppSelect
                className="mt-1"
                value={editForm.docType}
                onChange={(event) => setEditForm((prev) => ({ ...prev, docType: event.target.value as DocumentDetails["docType"] }))}
              >
                <option value="PASSPORT">Паспорт</option>
                <option value="OPERATION_MANUAL">Руководство по эксплуатации</option>
                <option value="CERTIFICATE">Сертификат</option>
                <option value="ACT">Акт</option>
                <option value="DRAWING">Чертеж</option>
                <option value="OTHER">Прочее</option>
              </AppSelect>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Заменить прикладываемый файл</label>
              <input
                type="file"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) => void onSelectEditFile(event.target.files?.[0])}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {uploadingEditFile
                  ? "Загрузка файла..."
                  : editFile
                    ? `Подготовлен новый файл: ${editFile.fileName}`
                    : `Текущий файл: ${item.versions[0]?.fileName || "не указан"}`}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button className="gap-2" disabled={actionLoading || uploadingEditFile} onClick={() => void saveDraftEdit()}>
              <Save className="h-4 w-4" />
              Сохранить
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={actionLoading}
              onClick={() => {
                setEditForm({ title: item.title, docType: item.docType });
                setEditFile(null);
                setEditOpen(false);
              }}
            >
              <X className="h-4 w-4" />
              Отмена
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <h2 className="text-lg font-semibold">Данные документа</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Тип</p>
            <p className="mt-1">{docTypeLabel(item.docType)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Статус</p>
            <p className="mt-1">{documentStatusLabel(item.status)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Последнее обновление</p>
            <p className="mt-1">{new Date(item.updatedAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-4 rounded-md border border-border bg-muted/20 p-3">
          <p className="text-sm font-medium">Что дальше</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {runtimeSettings?.workflow.documentChangesRequireApproval
              ? canSubmitForApproval(item.status)
                ? "Документ готов к отправке на согласование."
                : item.status === "IN_REVIEW"
                  ? "Документ на проверке. Ожидайте решения согласующего."
                  : item.status === "APPROVED"
                    ? "Документ согласован и доступен для использования."
                    : "Изменение документа в текущем статусе ограничено."
              : "Согласование документов отключено, изменения публикуются сразу."}
          </p>
        </div>
      </Card>

      <Card className="p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">История версий</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left">Версия</th>
                <th className="px-4 py-3 text-left">Файл</th>
                <th className="px-4 py-3 text-left">Кто загрузил</th>
                <th className="px-4 py-3 text-left">Дата</th>
                <th className="px-4 py-3 text-left">Контрольная сумма</th>
                <th className="px-4 py-3 text-left">Примечание</th>
                <th className="px-4 py-3 text-left">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {item.versions.map((version, index) => (
                <tr key={version.id} className={index === 0 ? "bg-primary/5" : ""}>
                  <td className="px-4 py-3 font-medium">v{version.versionNumber}{index === 0 ? " (текущая)" : ""}</td>
                  <td className="px-4 py-3">{version.fileName}</td>
                  <td className="px-4 py-3">{version.createdBy?.displayName || "-"}</td>
                  <td className="px-4 py-3">{new Date(version.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span title={version.checksum}>{shortChecksum(version.checksum)}</span>
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Скопировать checksum"
                        onClick={() => void copyChecksum(version.checksum)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{version.notes || "-"}</td>
                  <td className="px-4 py-3">
                    {version.downloadUrl ? (
                      <a href={version.downloadUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="gap-2">
                          <Download className="h-3 w-3" />
                          Скачать
                        </Button>
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
