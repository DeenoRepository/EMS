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

export const MOCK_DOCUMENTS: DocumentItem[] = [
  {
    id: "doc-01",
    equipmentId: "eq-001",
    equipmentCode: "EQ-CNC-2026-01",
    title: "Технический паспорт HAAS VF-2",
    docType: "PASSPORT",
    status: "APPROVED",
    fileName: "Passport_HAAS_VF2_v1.pdf",
    fileSize: "4.2 MB",
    version: 1,
    updatedAt: "2026-07-20T12:00:00Z"
  },
  {
    id: "doc-02",
    equipmentId: "eq-001",
    equipmentCode: "EQ-CNC-2026-01",
    title: "Электрическая схема привода",
    docType: "DRAWING",
    status: "APPROVED",
    fileName: "Electrical_Scheme_VF2.pdf",
    fileSize: "1.8 MB",
    version: 2,
    updatedAt: "2026-07-25T15:30:00Z"
  },
  {
    id: "doc-03",
    equipmentId: "eq-002",
    equipmentCode: "EQ-PRESS-2026-04",
    title: "Акт первичного ввода в эксплуатацию",
    docType: "ACT",
    status: "IN_REVIEW",
    fileName: "Act_Commissioning_P6334.pdf",
    fileSize: "850 KB",
    version: 1,
    updatedAt: "2026-08-01T09:00:00Z"
  }
];

let approvalsStore: ApprovalItem[] = [
  {
    id: "appr-01",
    targetType: "DOCUMENT_VERSION",
    targetCode: "EQ-PRESS-2026-04",
    title: "Согласование акта ввода пресса П6334",
    requestedBy: "editor@ems.local",
    status: "PENDING",
    submittedAt: "2026-08-01T09:10:00Z",
    comments: "Требуется подпись главного инженера"
  },
  {
    id: "appr-02",
    targetType: "EQUIPMENT_VERSION",
    targetCode: "EQ-CNC-2026-01",
    title: "Изменение статуса оборудования на MAINTENANCE",
    requestedBy: "admin@ems.local",
    status: "APPROVED",
    submittedAt: "2026-07-29T14:00:00Z",
    comments: "Утверждено плановое ТО"
  }
];

export function getApprovalsStore(): ApprovalItem[] {
  return approvalsStore;
}

export function updateApprovalStatus(id: string, status: "APPROVED" | "REJECTED"): ApprovalItem | null {
  const index = approvalsStore.findIndex((a) => a.id === id);
  if (index !== -1) {
    approvalsStore[index] = { ...approvalsStore[index], status };
    return approvalsStore[index];
  }
  return null;
}

export function addApprovalItem(item: Omit<ApprovalItem, "id" | "submittedAt">): ApprovalItem {
  const newItem: ApprovalItem = {
    ...item,
    id: `appr-${Date.now()}`,
    submittedAt: new Date().toISOString()
  };
  approvalsStore = [newItem, ...approvalsStore];
  return newItem;
}



export const MOCK_EVENTS: TimelineEvent[] = [
  {
    id: "evt-01",
    equipmentId: "eq-001",
    eventType: "STATUS_CHANGED",
    title: "Статус оборудования изменен на В эксплуатации (IN_OPERATION)",
    description: "Обрабатывающий центр HAAS VF-2 успешно прошел пусконаладочные работы и запущен в эксплуатацию.",
    actor: "admin@ems.local",
    createdAt: "2026-08-05T14:30:00Z"
  },
  {
    id: "evt-02",
    equipmentId: "eq-001",
    eventType: "DOCUMENT_ATTACHED",
    title: "Прикреплен технический паспорт v1.0",
    description: "Загружен электронный документ Passport_HAAS_VF2_v1.pdf (4.2 MB) в архив оборудования.",
    actor: "editor@ems.local",
    createdAt: "2026-08-04T11:15:00Z"
  },
  {
    id: "evt-03",
    equipmentId: "eq-002",
    eventType: "APPROVAL_SUBMITTED",
    title: "Подана заявка на согласование акта ввода",
    description: "Формирование комиссии и отправка акта ввода пресса П6334 главным механиком.",
    actor: "petrov@ems.local",
    createdAt: "2026-08-03T16:45:00Z"
  },
  {
    id: "evt-04",
    equipmentId: "eq-002",
    eventType: "UPDATED",
    title: "Обновлены технические характеристики пресса",
    description: "Внесены параметры номинального усилия (250 тонн) и типа привода.",
    actor: "editor@ems.local",
    createdAt: "2026-08-02T09:20:00Z"
  },
  {
    id: "evt-05",
    equipmentId: "eq-003",
    eventType: "CREATED",
    title: "Первичная паспортизация единицы оборудования",
    description: "Создан новый паспорт токарного станка 1К62D в реестре оборудования EPS.",
    actor: "admin@ems.local",
    createdAt: "2026-08-01T10:00:00Z"
  }
];
