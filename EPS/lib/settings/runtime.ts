import { readProjectSettings } from "@/lib/settings/store";
import { DocumentType } from "@prisma/client";

const DEFAULT_REQUIRED: DocumentType[] = ["PASSPORT", "OPERATION_MANUAL"];

function normalizeDocumentType(value: string): DocumentType | null {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_") as DocumentType;
  return Object.values(DocumentType).includes(normalized) ? normalized : null;
}

export async function getRuntimeSettings() {
  return readProjectSettings();
}

export async function getDefaultPageSize() {
  const settings = await readProjectSettings();
  return settings.ui.defaultPageSize;
}

export async function isEquipmentApprovalRequired() {
  const settings = await readProjectSettings();
  return settings.workflow.equipmentChangesRequireApproval;
}

export async function isDocumentApprovalRequired() {
  const settings = await readProjectSettings();
  return settings.workflow.documentChangesRequireApproval;
}

export async function isRollbackEnabled() {
  const settings = await readProjectSettings();
  return settings.workflow.rollbackEnabledForApprover;
}

export async function getRequiredDocumentTypesByEquipmentType(equipmentType?: string | null): Promise<DocumentType[]> {
  const settings = await readProjectSettings();
  const map = settings.documents.requiredByEquipmentType;

  const exactKey = (equipmentType || "").trim().toUpperCase();
  const rawList = map[exactKey] || map.DEFAULT || DEFAULT_REQUIRED;

  const normalized = rawList
    .map((item) => normalizeDocumentType(String(item)))
    .filter((item): item is DocumentType => Boolean(item));

  return normalized.length ? normalized : DEFAULT_REQUIRED;
}
