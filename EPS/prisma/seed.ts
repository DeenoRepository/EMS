import {
  ApprovalStatus,
  DocumentStatus,
  DocumentType,
  EquipmentStatus,
  EventType,
  LifecycleStage,
  PrismaClient,
  RoleKey
} from "@prisma/client";

const prisma = new PrismaClient();

const roleSeeds: Array<{ key: RoleKey; name: string }> = [
  { key: "VIEWER", name: "Наблюдатель" },
  { key: "EDITOR", name: "Редактор" },
  { key: "APPROVER", name: "Согласующий" },
  { key: "ADMIN", name: "Администратор" }
];

const userSeeds: Array<{ email: string; displayName: string; role: RoleKey }> = [
  { email: "admin@enterprise.local", displayName: "Анна Администратор", role: "ADMIN" },
  { email: "editor@enterprise.local", displayName: "Егор Редактор", role: "EDITOR" },
  { email: "approver@enterprise.local", displayName: "Алина Согласующий", role: "APPROVER" },
  { email: "viewer@enterprise.local", displayName: "Виктор Наблюдатель", role: "VIEWER" },
  { email: "ops.lead@enterprise.local", displayName: "Ольга Операции", role: "EDITOR" },
  { email: "maintenance@enterprise.local", displayName: "Максим Обслуживание", role: "EDITOR" }
];

const equipmentTypes = ["MACHINERY", "SAFETY", "UTILITIES", "HVAC", "ELECTRICAL"];
const equipmentCategories = ["PRESS", "COMPRESSOR", "PUMP", "LIFT", "CONVEYOR", "WELDING"];
const departments = ["Операции", "Обслуживание", "Производство", "Логистика", "Качество"];
const locations = ["Цех A / Этаж 1", "Цех A / Этаж 2", "Цех B / Этаж 1", "Склад 3", "Сервисная зона"];
const manufacturers = ["HydraWorks", "NordTech", "PrimeMotion", "AeroSystems", "SteelCore"];
const suppliers = ["Industrial Hub", "Machline", "FlowDirect", "ProSupply", "Global Parts"];

function pick<T>(arr: T[], idx: number) {
  return arr[idx % arr.length];
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function docTypeLabel(docType: DocumentType) {
  const map: Record<DocumentType, string> = {
    PASSPORT: "Паспорт",
    OPERATION_MANUAL: "Руководство по эксплуатации",
    CERTIFICATE: "Сертификат",
    ACT: "Акт",
    DRAWING: "Чертеж",
    OTHER: "Прочее"
  };
  return map[docType];
}

async function ensureRoles() {
  for (const role of roleSeeds) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name },
      create: role
    });
  }
}

async function ensureUsers() {
  const map: Record<string, string> = {};
  for (const seed of userSeeds) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {
        displayName: seed.displayName,
        adExternalId: seed.email,
        isActive: true
      },
      create: {
        email: seed.email,
        displayName: seed.displayName,
        adExternalId: seed.email,
        isActive: true
      }
    });

    const role = await prisma.role.findUniqueOrThrow({ where: { key: seed.role } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id }
    });

    map[seed.email] = user.id;
  }
  return map;
}

async function clearDomainData() {
  await prisma.auditLog.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.equipmentEvent.deleteMany();
  await prisma.equipmentVersion.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.equipmentTypeAttribute.deleteMany();
  await prisma.referenceValue.deleteMany();
  await prisma.referenceField.deleteMany();
}

async function seedReferenceCatalog() {
  const fieldDefinitions = [
    { key: "type", label: "Тип оборудования", values: equipmentTypes },
    { key: "category", label: "Группа оборудования", values: equipmentCategories },
    { key: "department", label: "Подразделение", values: departments },
    { key: "location", label: "Расположение", values: locations }
  ];

  for (let i = 0; i < fieldDefinitions.length; i += 1) {
    const field = fieldDefinitions[i];
    const createdField = await prisma.referenceField.create({
      data: {
        entityType: "EQUIPMENT",
        key: field.key,
        label: field.label,
        sortOrder: i
      }
    });

    if (field.values.length > 0) {
      await prisma.referenceValue.createMany({
        data: field.values.map((value, index) => ({
          fieldId: createdField.id,
          value,
          label: value,
          sortOrder: index
        }))
      });
    }
  }
}

async function seedEquipmentTypeAttributes() {
  await prisma.equipmentTypeAttribute.createMany({
    data: [
      {
        typeValue: "MACHINERY",
        key: "power_kw",
        label: "Мощность, кВт",
        dataType: "NUMBER",
        required: true,
        sortOrder: 1,
        description: "Номинальная мощность оборудования в кВт"
      },
      {
        typeValue: "MACHINERY",
        key: "voltage_class",
        label: "Класс напряжения",
        dataType: "SELECT",
        required: true,
        options: [{ value: "220V", label: "220V" }, { value: "380V", label: "380V" }, { value: "660V", label: "660V" }],
        sortOrder: 2,
        description: "Рабочий класс напряжения"
      },
      {
        typeValue: "SAFETY",
        key: "safety_category",
        label: "Категория безопасности",
        dataType: "SELECT",
        required: true,
        options: [{ value: "A", label: "A" }, { value: "B", label: "B" }, { value: "C", label: "C" }],
        sortOrder: 1,
        description: "Категория оборудования по классу безопасности"
      }
    ]
  });
}

function buildEquipmentSeed(index: number, users: Record<string, string>) {
  const equipmentCode = `EQP-${String(index + 1).padStart(4, "0")}`;
  const inventoryNumber = `INV-${new Date().getFullYear()}-${String(index + 1).padStart(5, "0")}`;
  const name = `${pick(equipmentCategories, index)} Установка ${index + 1}`;
  const statusCycle: EquipmentStatus[] = ["ACTIVE", "ACTIVE", "INACTIVE", "DRAFT", "DECOMMISSIONED"];
  const lifecycleCycle: LifecycleStage[] = ["IN_OPERATION", "MAINTENANCE", "COMMISSIONED", "PLANNED", "RETIRED"];
  const status = statusCycle[index % statusCycle.length];
  const lifecycleStage = lifecycleCycle[index % lifecycleCycle.length];
  const now = new Date();
  const productionDate = addDays(now, -(1200 + index * 5));
  const deliveryDate = addDays(productionDate, 90);
  const commissioningDate = addDays(deliveryDate, 30);
  const serviceDueDate = addDays(now, (index % 10) * 7 - 20);
  const warrantyExpiration = addDays(now, (index % 12) * 15 - 45);

  const type = pick(equipmentTypes, index);
  const customAttributes =
    type === "MACHINERY"
      ? { power_kw: String(50 + (index % 10) * 5), voltage_class: pick(["220V", "380V", "660V"], index) }
      : type === "SAFETY"
        ? { safety_category: pick(["A", "B", "C"], index) }
        : {};

  return {
    equipmentCode,
    name,
    type,
    category: pick(equipmentCategories, index),
    model: `M-${1000 + index}`,
    serialNumber: `SN-${20000 + index}`,
    inventoryNumber,
    department: pick(departments, index),
    location: pick(locations, index),
    responsibleUserId: pick(Object.values(users), index),
    manufacturer: pick(manufacturers, index),
    supplier: pick(suppliers, index),
    productionDate,
    deliveryDate,
    commissioningDate,
    warrantyExpiration,
    serviceDueDate,
    customAttributes,
    status,
    lifecycleStage,
    notes: `Автосозданная карточка оборудования ${equipmentCode}.`
  };
}

function buildDocumentType(index: number): DocumentType {
  const docTypes: DocumentType[] = ["PASSPORT", "OPERATION_MANUAL", "CERTIFICATE", "ACT", "DRAWING", "OTHER"];
  return docTypes[index % docTypes.length];
}

async function main() {
  await ensureRoles();
  const users = await ensureUsers();
  await clearDomainData();
  await seedReferenceCatalog();
  await seedEquipmentTypeAttributes();

  const editorId = users["editor@enterprise.local"];
  const approverId = users["approver@enterprise.local"];
  const viewerId = users["viewer@enterprise.local"];
  const adminId = users["admin@enterprise.local"];

  const documentVersionForApproval: string[] = [];

  for (let i = 0; i < 50; i += 1) {
    const equipmentData = buildEquipmentSeed(i, users);
    const createdEquipment = await prisma.equipment.create({
      data: {
        ...equipmentData,
        currentVersion: 2
      }
    });

    await prisma.equipmentVersion.createMany({
      data: [
        {
          equipmentId: createdEquipment.id,
          versionNumber: 1,
          changeSummary: "Первичная регистрация",
          snapshot: { ...equipmentData, currentVersion: 1 },
          createdById: editorId
        },
        {
          equipmentId: createdEquipment.id,
          versionNumber: 2,
          changeSummary: "Обновление после ввода в эксплуатацию",
          snapshot: { ...equipmentData, currentVersion: 2, notes: `${equipmentData.notes} Обновлено после проверки.` },
          createdById: adminId
        }
      ]
    });

    const eventPayload: Array<{ eventType: EventType; title: string; description: string; actorId: string }> = [
      {
        eventType: "CREATED",
        title: "Оборудование зарегистрировано",
        description: `${createdEquipment.equipmentCode} зарегистрировано в корпоративном реестре.`,
        actorId: editorId
      },
      {
        eventType: "UPDATED",
        title: "Базовые данные обновлены",
        description: "Подтверждены поля жизненного цикла и планового обслуживания.",
        actorId: adminId
      }
    ];

    await prisma.equipmentEvent.createMany({
      data: eventPayload.map((event) => ({
        equipmentId: createdEquipment.id,
        eventType: event.eventType,
        title: event.title,
        description: event.description,
        actorId: event.actorId
      }))
    });

    const docType = buildDocumentType(i);
    const document = await prisma.document.create({
      data: {
        equipmentId: createdEquipment.id,
        title: `${docTypeLabel(docType)} для ${createdEquipment.equipmentCode}`,
        docType,
        status: i % 4 === 0 ? "IN_REVIEW" : i % 5 === 0 ? "DRAFT" : ("APPROVED" as DocumentStatus)
      }
    });

    const v1 = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: 1,
        fileName: `${createdEquipment.equipmentCode.toLowerCase()}-${docType.toLowerCase()}-v1.pdf`,
        storagePath: `/docs/${createdEquipment.equipmentCode.toLowerCase()}/${docType.toLowerCase()}-v1.pdf`,
        checksum: `sha256-v1-${createdEquipment.equipmentCode}-${docType}`,
        notes: "Первичная загрузка",
        metadata: { source: "seed", version: 1 },
        createdById: editorId
      }
    });

    if (i % 3 === 0) {
      await prisma.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 2,
          fileName: `${createdEquipment.equipmentCode.toLowerCase()}-${docType.toLowerCase()}-v2.pdf`,
          storagePath: `/docs/${createdEquipment.equipmentCode.toLowerCase()}/${docType.toLowerCase()}-v2.pdf`,
          checksum: `sha256-v2-${createdEquipment.equipmentCode}-${docType}`,
          notes: "Обновленная версия",
          metadata: { source: "seed", version: 2, revised: true },
          createdById: adminId
        }
      });
    }

    if (i % 2 === 0) {
      documentVersionForApproval.push(v1.id);
    }
  }

  const equipmentVersions = await prisma.equipmentVersion.findMany({
    where: { versionNumber: 2 },
    select: { id: true }
  });

  const approvalSeeds = [];
  for (let i = 0; i < Math.min(20, equipmentVersions.length); i += 1) {
    approvalSeeds.push({
      targetType: "EQUIPMENT_VERSION" as const,
      targetId: equipmentVersions[i].id,
      status: i % 3 === 0 ? ("APPROVED" as ApprovalStatus) : ("PENDING" as ApprovalStatus),
      requestedById: editorId,
      assignedApproverId: approverId,
      decidedById: i % 3 === 0 ? approverId : null,
      decidedAt: i % 3 === 0 ? addDays(new Date(), -i) : null,
      comments: i % 3 === 0 ? "Согласовано после проверки" : "Ожидает решения согласующего"
    });
  }

  for (let i = 0; i < Math.min(20, documentVersionForApproval.length); i += 1) {
    approvalSeeds.push({
      targetType: "DOCUMENT_VERSION" as const,
      targetId: documentVersionForApproval[i],
      status: i % 4 === 0 ? ("REJECTED" as ApprovalStatus) : ("PENDING" as ApprovalStatus),
      requestedById: viewerId,
      assignedApproverId: approverId,
      decidedById: i % 4 === 0 ? approverId : null,
      decidedAt: i % 4 === 0 ? addDays(new Date(), -i) : null,
      comments: i % 4 === 0 ? "Отклонено из-за неполных метаданных" : "Ожидает согласования"
    });
  }

  if (approvalSeeds.length > 0) {
    await prisma.approvalRequest.createMany({
      data: approvalSeeds
    });
  }

  await prisma.auditLog.createMany({
    data: [
      {
        actorId: adminId,
        actorEmail: "admin@enterprise.local",
        action: "LOGIN",
        entityType: "AuthSession",
        entityId: adminId,
        metadata: { source: "seed" }
      },
      {
        actorId: editorId,
        actorEmail: "editor@enterprise.local",
        action: "CREATE",
        entityType: "EquipmentBatch",
        entityId: `BATCH-${Date.now()}`,
        metadata: { equipmentCount: 50, documentCount: 50 }
      },
      {
        actorId: approverId,
        actorEmail: "approver@enterprise.local",
        action: "APPROVE",
        entityType: "ApprovalRequest",
        entityId: "seed-approvals",
        metadata: { approved: approvalSeeds.filter((x) => x.status === "APPROVED").length }
      }
    ]
  });

  // eslint-disable-next-line no-console
  console.log("Сидирование завершено: создано 50 единиц оборудования и 50 документов.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
