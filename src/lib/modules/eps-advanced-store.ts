export interface DocumentItem {
  id: string;
  equipmentId: string;
  equipmentCode: string;
  title: string;
  docType: "PASSPORT" | "OPERATION_MANUAL" | "CERTIFICATE" | "ACT" | "DRAWING" | "OTHER";
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED";
  fileName: string;
  fileSize: string;
  storagePath?: string;
  version: number;
  updatedAt: string;
}

export interface ApprovalItem {
  id: string;
  targetType: "EQUIPMENT_VERSION" | "DOCUMENT_VERSION";
  targetCode: string;
  title: string;
  requestedBy: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: string;
  comments?: string;
}

export interface TimelineEvent {
  id: string;
  equipmentId: string;
  eventType: "CREATED" | "UPDATED" | "STATUS_CHANGED" | "DOCUMENT_ATTACHED" | "APPROVAL_SUBMITTED" | "APPROVAL_RESOLVED";
  title: string;
  description: string;
  actor: string;
  createdAt: string;
}
