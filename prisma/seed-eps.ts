import {
  PrismaClient,
  RoleKey,
  EquipmentStatus,
  LifecycleStage,
  DocumentType,
  DocumentStatus,
  ApprovalTargetType,
  ApprovalStatus,
  AuditAction,
  EventType,
  ReferenceEntityType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding EPS module: Roles, Users, Equipment, Documents, Approvals, Events, References...");

  // ─── 1. ROLES ─────────────────────────────────────────────────────────────
  const roleViewer = await prisma.role.upsert({
    where: { key: RoleKey.VIEWER },
    update: {},
    create: { key: RoleKey.VIEWER, name: "Просмотр" },
  });
  const roleEditor = await prisma.role.upsert({
    where: { key: RoleKey.EDITOR },
    update: {},
    create: { key: RoleKey.EDITOR, name: "Редактор" },
  });
  const roleApprover = await prisma.role.upsert({
    where: { key: RoleKey.APPROVER },
    update: {},
    create: { key: RoleKey.APPROVER, name: "Согласующий" },
  });
  const roleAdmin = await prisma.role.upsert({
    where: { key: RoleKey.ADMIN },
    update: {},
    create: { key: RoleKey.ADMIN, name: "Администратор" },
  });

  // ─── 2. USERS ─────────────────────────────────────────────────────────────
  const userAdmin = await prisma.user.upsert({
    where: { email: "admin@ems.local" },
    update: {},
    create: { email: "admin@ems.local", displayName: "Администратор EMS", isActive: true },
  });
  const userEditor = await prisma.user.upsert({
    where: { email: "editor@ems.local" },
    update: {},
    create: { email: "editor@ems.local", displayName: "Инженер Редактор", isActive: true },
  });
  const userApprover = await prisma.user.upsert({
    where: { email: "approver@ems.local" },
    update: {},
    create: { email: "approver@ems.local", displayName: "Руководитель Согласующий", isActive: true },
  });
  const userViewer = await prisma.user.upsert({
    where: { email: "viewer@ems.local" },
    update: {},
    create: { email: "viewer@ems.local", displayName: "Наблюдатель", isActive: true },
  });

  // ─── 3. USER ROLES ────────────────────────────────────────────────────────
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: userAdmin.id, roleId: roleAdmin.id } },
    update: {},
    create: { userId: userAdmin.id, roleId: roleAdmin.id },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: userEditor.id, roleId: roleEditor.id } },
    update: {},
    create: { userId: userEditor.id, roleId: roleEditor.id },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: userApprover.id, roleId: roleApprover.id } },
    update: {},
    create: { userId: userApprover.id, roleId: roleApprover.id },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: userViewer.id, roleId: roleViewer.id } },
    update: {},
    create: { userId: userViewer.id, roleId: roleViewer.id },
  });

  // ─── 4. REFERENCE FIELDS ──────────────────────────────────────────────────
  await prisma.referenceField.upsert({
    where: { entityType_key: { entityType: ReferenceEntityType.EQUIPMENT, key: "department" } },
    update: {},
    create: {
      entityType: ReferenceEntityType.EQUIPMENT,
      key: "department",
      label: "Подразделение",
      description: "Структурное подразделение предприятия",
      isActive: true,
      sortOrder: 1,
      values: {
        create: [
          { value: "Цех №1", label: "Цех №1 (Механический)", sortOrder: 1 },
          { value: "Цех №2", label: "Цех №2 (Электрический)", sortOrder: 2 },
          { value: "Цех №3", label: "Цех №3 (Насосный)", sortOrder: 3 },
          { value: "ОГМ", label: "ОГМ (Отдел гл. механика)", sortOrder: 4 },
          { value: "ОГЭ", label: "ОГЭ (Отдел гл. энергетика)", sortOrder: 5 },
        ],
      },
    },
  });

  await prisma.referenceField.upsert({
    where: { entityType_key: { entityType: ReferenceEntityType.EQUIPMENT, key: "manufacturer" } },
    update: {},
    create: {
      entityType: ReferenceEntityType.EQUIPMENT,
      key: "manufacturer",
      label: "Производитель",
      isActive: true,
      sortOrder: 2,
      values: {
        create: [
          { value: "Grundfos", label: "Grundfos (Дания)", sortOrder: 1 },
          { value: "ABB", label: "ABB (Швейцария)", sortOrder: 2 },
          { value: "Siemens", label: "Siemens (Германия)", sortOrder: 3 },
          { value: "КМЗ", label: "КМЗ (Россия)", sortOrder: 4 },
          { value: "ЭлМаш", label: "ЭлМаш (Россия)", sortOrder: 5 },
        ],
      },
    },
  });

  // ─── 5. EQUIPMENT ─────────────────────────────────────────────────────────
  const eq1 = await prisma.equipment.upsert({
    where: { equipmentCode: "EQ-NS-001" },
    update: {},
    create: {
      equipmentCode: "EQ-NS-001",
      name: "Насосная станция Ц-12",
      type: "Насосное оборудование",
      category: "Гидравлика",
      model: "Grundfos CR 32-3",
      serialNumber: "GF-CR32-2023-001",
      inventoryNumber: "ИНВ-2023-0441",
      department: "Цех №3",
      location: "Насосная hall B, позиция 12",
      responsibleUserId: userEditor.id,
      manufacturer: "Grundfos",
      supplier: "ООО Грундфос Россия",
      productionDate: new Date("2022-06-15"),
      deliveryDate: new Date("2023-01-20"),
      commissioningDate: new Date("2023-02-01"),
      warrantyExpiration: new Date("2026-02-01"),
      serviceDueDate: new Date("2025-08-01"),
      status: EquipmentStatus.ACTIVE,
      lifecycleStage: LifecycleStage.IN_OPERATION,
      currentVersion: 2,
      notes: "Основная насосная станция подачи воды для цеха №3. Плановое ТО каждые 6 месяцев.",
      customAttributes: { power_kw: 15, flow_m3h: 32, head_m: 75, voltage_v: 380 },
    },
  });

  const eq2 = await prisma.equipment.upsert({
    where: { equipmentCode: "EQ-TR-002" },
    update: {},
    create: {
      equipmentCode: "EQ-TR-002",
      name: "Трансформатор силовой ТМ-630",
      type: "Электрооборудование",
      category: "Трансформаторы",
      model: "ТМ-630/10",
      serialNumber: "TM630-2021-0089",
      inventoryNumber: "ИНВ-2021-0089",
      department: "Цех №2",
      location: "РУ-10кВ, ячейка 4",
      responsibleUserId: userApprover.id,
      manufacturer: "ЭлМаш",
      supplier: "ЗАО ЭлМаш-Трейд",
      productionDate: new Date("2020-11-10"),
      deliveryDate: new Date("2021-03-15"),
      commissioningDate: new Date("2021-04-01"),
      warrantyExpiration: new Date("2024-04-01"),
      serviceDueDate: new Date("2025-10-01"),
      status: EquipmentStatus.ACTIVE,
      lifecycleStage: LifecycleStage.IN_OPERATION,
      currentVersion: 1,
      notes: "Силовой трансформатор 10/0.4 кВ. Испытания диэлектрики раз в год.",
      customAttributes: { power_kva: 630, voltage_high_kv: 10, voltage_low_v: 400, cooling: "Масляное" },
    },
  });

  const eq3 = await prisma.equipment.upsert({
    where: { equipmentCode: "EQ-CM-003" },
    update: {},
    create: {
      equipmentCode: "EQ-CM-003",
      name: "Компрессор воздушный АИР-160",
      type: "Компрессорное оборудование",
      category: "Пневматика",
      model: "АИР-160М4",
      serialNumber: "AIR160-2022-0034",
      inventoryNumber: "ИНВ-2022-0034",
      department: "Цех №1",
      location: "Компрессорная, позиция 3",
      responsibleUserId: userEditor.id,
      manufacturer: "КМЗ",
      supplier: "ООО КомпрессорТехника",
      productionDate: new Date("2021-08-20"),
      deliveryDate: new Date("2022-05-10"),
      commissioningDate: new Date("2022-06-01"),
      warrantyExpiration: new Date("2025-06-01"),
      serviceDueDate: new Date("2025-12-01"),
      status: EquipmentStatus.ACTIVE,
      lifecycleStage: LifecycleStage.IN_OPERATION,
      currentVersion: 1,
      notes: "Поршневой компрессор для питания пневмоинструмента и продувки.",
      customAttributes: { power_kw: 18.5, pressure_bar: 10, capacity_m3min: 2.4 },
    },
  });

  const eq4 = await prisma.equipment.upsert({
    where: { equipmentCode: "EQ-VN-004" },
    update: {},
    create: {
      equipmentCode: "EQ-VN-004",
      name: "Вентилятор промышленный ВЦ-14",
      type: "Вентиляционное оборудование",
      category: "Вентиляция",
      model: "ВЦ-14-46-8",
      serialNumber: "VC14-2019-0112",
      inventoryNumber: "ИНВ-2019-0112",
      department: "ОГМ",
      location: "Крыша корпуса 2, В-1",
      responsibleUserId: userAdmin.id,
      manufacturer: "КМЗ",
      supplier: "ООО ВентТех",
      productionDate: new Date("2018-04-15"),
      deliveryDate: new Date("2019-01-10"),
      commissioningDate: new Date("2019-02-01"),
      warrantyExpiration: new Date("2022-02-01"),
      serviceDueDate: new Date("2025-09-15"),
      status: EquipmentStatus.INACTIVE,
      lifecycleStage: LifecycleStage.MAINTENANCE,
      currentVersion: 3,
      notes: "Выведен на плановый ремонт. Замена подшипников и балансировка крыльчатки.",
      customAttributes: { power_kw: 37, flow_m3h: 40000, pressure_pa: 1800 },
    },
  });

  const eq5 = await prisma.equipment.upsert({
    where: { equipmentCode: "EQ-DR-005" },
    update: {},
    create: {
      equipmentCode: "EQ-DR-005",
      name: "Дробилка молотковая ДМ-0.25",
      type: "Технологическое оборудование",
      category: "Дробильное",
      model: "ДМ-0.25А",
      serialNumber: "DM025-2015-0008",
      inventoryNumber: "ИНВ-2015-0008",
      department: "Цех №1",
      location: "Участок дробления, позиция 1",
      responsibleUserId: userEditor.id,
      manufacturer: "КМЗ",
      supplier: "ОАО КомпрессорМашЗавод",
      productionDate: new Date("2014-09-10"),
      deliveryDate: new Date("2015-03-01"),
      commissioningDate: new Date("2015-04-15"),
      warrantyExpiration: new Date("2018-04-15"),
      serviceDueDate: new Date("2024-12-01"),
      status: EquipmentStatus.DRAFT,
      lifecycleStage: LifecycleStage.COMMISSIONED,
      currentVersion: 1,
      notes: "Плановая оценка технического состояния перед вводом в эксплуатацию.",
    },
  });

  // ─── 6. EQUIPMENT VERSIONS ────────────────────────────────────────────────
  await prisma.equipmentVersion.upsert({
    where: { equipmentId_versionNumber: { equipmentId: eq1.id, versionNumber: 1 } },
    update: {},
    create: {
      equipmentId: eq1.id,
      versionNumber: 1,
      changeSummary: "Первичная регистрация оборудования в системе",
      createdById: userEditor.id,
      snapshot: { name: "Насосная станция Ц-12", status: "DRAFT", lifecycleStage: "COMMISSIONED" },
    },
  });
  await prisma.equipmentVersion.upsert({
    where: { equipmentId_versionNumber: { equipmentId: eq1.id, versionNumber: 2 } },
    update: {},
    create: {
      equipmentId: eq1.id,
      versionNumber: 2,
      changeSummary: "Смена статуса на ACTIVE после ввода в эксплуатацию",
      createdById: userApprover.id,
      snapshot: { name: "Насосная станция Ц-12", status: "ACTIVE", lifecycleStage: "IN_OPERATION" },
    },
  });
  await prisma.equipmentVersion.upsert({
    where: { equipmentId_versionNumber: { equipmentId: eq4.id, versionNumber: 1 } },
    update: {},
    create: {
      equipmentId: eq4.id,
      versionNumber: 1,
      changeSummary: "Первичная запись",
      createdById: userAdmin.id,
      snapshot: { name: "Вентилятор ВЦ-14", status: "ACTIVE" },
    },
  });

  // ─── 7. DOCUMENTS ─────────────────────────────────────────────────────────
  const doc1 = await prisma.document.create({
    data: {
      equipmentId: eq1.id,
      title: "Паспорт Grundfos CR 32-3",
      docType: DocumentType.PASSPORT,
      status: DocumentStatus.APPROVED,
      versions: {
        create: {
          versionNumber: 1,
          fileName: "grundfos_cr32_passport_v1.pdf",
          storagePath: "/docs/eq-ns-001/passport_v1.pdf",
          checksum: "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
          notes: "Оригинальный паспорт от производителя",
          createdById: userEditor.id,
        },
      },
    },
  });

  await prisma.document.create({
    data: {
      equipmentId: eq1.id,
      title: "Руководство по эксплуатации CR 32",
      docType: DocumentType.OPERATION_MANUAL,
      status: DocumentStatus.APPROVED,
      versions: {
        create: {
          versionNumber: 1,
          fileName: "cr32_operation_manual_ru.pdf",
          storagePath: "/docs/eq-ns-001/manual_v1.pdf",
          checksum: "sha256:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
          createdById: userEditor.id,
        },
      },
    },
  });

  const doc3 = await prisma.document.create({
    data: {
      equipmentId: eq2.id,
      title: "Акт испытаний трансформатора ТМ-630",
      docType: DocumentType.ACT,
      status: DocumentStatus.IN_REVIEW,
      versions: {
        create: {
          versionNumber: 1,
          fileName: "tm630_test_act_2024.pdf",
          storagePath: "/docs/eq-tr-002/act_v1.pdf",
          checksum: "sha256:c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
          notes: "Результаты ежегодных испытаний изоляции",
          createdById: userAdmin.id,
        },
      },
    },
  });

  await prisma.document.create({
    data: {
      equipmentId: eq4.id,
      title: "Сертификат соответствия вентилятора ВЦ-14",
      docType: DocumentType.CERTIFICATE,
      status: DocumentStatus.DRAFT,
      versions: {
        create: {
          versionNumber: 1,
          fileName: "vc14_cert_rostest.pdf",
          storagePath: "/docs/eq-vn-004/cert_v1.pdf",
          checksum: "sha256:d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1",
          createdById: userEditor.id,
        },
      },
    },
  });

  // ─── 8. APPROVAL REQUESTS ────────────────────────────────────────────────
  const docVersion3 = await prisma.documentVersion.findFirst({ where: { documentId: doc3.id } });
  const eqVersion2 = await prisma.equipmentVersion.findFirst({ where: { equipmentId: eq1.id, versionNumber: 2 } });

  if (docVersion3) {
    await prisma.approvalRequest.create({
      data: {
        targetType: ApprovalTargetType.DOCUMENT_VERSION,
        targetId: docVersion3.id,
        status: ApprovalStatus.PENDING,
        requestedById: userAdmin.id,
        assignedApproverId: userApprover.id,
        comments: "Прошу согласовать акт испытаний трансформатора за 2024 год",
      },
    });
  }

  if (eqVersion2) {
    await prisma.approvalRequest.create({
      data: {
        targetType: ApprovalTargetType.EQUIPMENT_VERSION,
        targetId: eqVersion2.id,
        status: ApprovalStatus.APPROVED,
        requestedById: userEditor.id,
        assignedApproverId: userApprover.id,
        decidedById: userApprover.id,
        decidedAt: new Date("2023-02-03"),
        comments: "Согласовано. Оборудование введено в эксплуатацию.",
      },
    });
  }

  // ─── 9. EQUIPMENT EVENTS ─────────────────────────────────────────────────
  await prisma.equipmentEvent.createMany({
    data: [
      {
        equipmentId: eq1.id,
        eventType: EventType.CREATED,
        title: "Оборудование зарегистрировано в системе",
        description: "Первичная регистрация насосной станции Ц-12",
        actorId: userEditor.id,
        createdAt: new Date("2023-01-25"),
      },
      {
        equipmentId: eq1.id,
        eventType: EventType.STATUS_CHANGED,
        title: "Статус изменён: DRAFT → ACTIVE",
        description: "Оборудование введено в эксплуатацию после проверки",
        actorId: userApprover.id,
        createdAt: new Date("2023-02-03"),
        payload: { from: "DRAFT", to: "ACTIVE" },
      },
      {
        equipmentId: eq1.id,
        eventType: EventType.DOCUMENT_ATTACHED,
        title: "Прикреплён паспорт оборудования",
        description: "Добавлен документ: Паспорт Grundfos CR 32-3",
        actorId: userEditor.id,
        createdAt: new Date("2023-02-01"),
      },
      {
        equipmentId: eq2.id,
        eventType: EventType.CREATED,
        title: "Оборудование зарегистрировано в системе",
        description: "Первичная регистрация трансформатора ТМ-630",
        actorId: userAdmin.id,
        createdAt: new Date("2021-04-01"),
      },
      {
        equipmentId: eq4.id,
        eventType: EventType.STATUS_CHANGED,
        title: "Статус изменён: ACTIVE → INACTIVE",
        description: "Вентилятор выведен на плановый ремонт",
        actorId: userAdmin.id,
        createdAt: new Date("2025-07-15"),
        payload: { from: "ACTIVE", to: "INACTIVE", reason: "Плановый ремонт" },
      },
      {
        equipmentId: eq4.id,
        eventType: EventType.UPDATED,
        title: "Обновлена дата следующего ТО",
        description: "serviceDueDate скорректирована на 15.09.2025",
        actorId: userEditor.id,
        createdAt: new Date("2025-07-20"),
      },
    ],
  });

  // ─── 10. AUDIT LOGS ───────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      {
        actorId: userEditor.id,
        actorEmail: userEditor.email,
        action: AuditAction.CREATE,
        entityType: "Equipment",
        entityId: eq1.id,
        afterState: { equipmentCode: "EQ-NS-001", name: "Насосная станция Ц-12" },
        createdAt: new Date("2023-01-25"),
      },
      {
        actorId: userApprover.id,
        actorEmail: userApprover.email,
        action: AuditAction.APPROVE,
        entityType: "EquipmentVersion",
        entityId: eq1.id,
        metadata: { version: 2, decision: "APPROVED" },
        createdAt: new Date("2023-02-03"),
      },
      {
        actorId: userAdmin.id,
        actorEmail: userAdmin.email,
        action: AuditAction.UPDATE,
        entityType: "Equipment",
        entityId: eq4.id,
        beforeState: { status: "ACTIVE" },
        afterState: { status: "INACTIVE", lifecycleStage: "MAINTENANCE" },
        createdAt: new Date("2025-07-15"),
      },
      {
        actorId: userAdmin.id,
        actorEmail: userAdmin.email,
        action: AuditAction.LOGIN,
        entityType: "User",
        entityId: userAdmin.id,
        metadata: { method: "mock" },
        createdAt: new Date("2026-08-08"),
      },
    ],
  });

  // ─── 11. EQUIPMENT TYPE ATTRIBUTES ───────────────────────────────────────
  const typeAttrs = [
    { typeValue: "Насосное оборудование", key: "power_kw", label: "Мощность (кВт)", dataType: "NUMBER", required: true, sortOrder: 1 },
    { typeValue: "Насосное оборудование", key: "flow_m3h", label: "Подача (м³/ч)", dataType: "NUMBER", required: true, sortOrder: 2 },
    { typeValue: "Насосное оборудование", key: "head_m", label: "Напор (м)", dataType: "NUMBER", required: false, sortOrder: 3 },
    { typeValue: "Электрооборудование", key: "power_kva", label: "Мощность (кВА)", dataType: "NUMBER", required: true, sortOrder: 1 },
    { typeValue: "Электрооборудование", key: "voltage_high_kv", label: "Напряжение ВН (кВ)", dataType: "NUMBER", required: true, sortOrder: 2 },
    { typeValue: "Компрессорное оборудование", key: "pressure_bar", label: "Давление (бар)", dataType: "NUMBER", required: true, sortOrder: 1 },
  ];

  for (const attr of typeAttrs) {
    await prisma.equipmentTypeAttribute.upsert({
      where: { typeValue_key: { typeValue: attr.typeValue, key: attr.key } },
      update: {},
      create: attr,
    });
  }

  console.log("EPS Seeding completed successfully!");
  console.log("  Users: 4 | Roles: 4 | Equipment: 5 | Documents: 4 | Approvals: 2 | Events: 6 | Audit: 4 | Refs: 2 | TypeAttrs: 6");
}

main()
  .catch((e) => {
    console.error("EPS Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
