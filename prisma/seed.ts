// prisma/seed.ts — Единый мастер-seed для EPS и WMS модулей
import {
  PrismaClient,
  // EPS
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
  // WMS
  WmsItemType,
  WmsItemStatus,
  WmsMovementType,
  WmsTransferStatus,
  WmsRequisitionStatus,
  WmsWriteOffReason,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  EMS — Полный Seed: EPS + WMS модули");
  console.log("═══════════════════════════════════════════════════\n");

  // ══════════════════════════════════════════════════════
  // БЛОК 1: EPS — РОЛИ, ПОЛЬЗОВАТЕЛИ, ОБОРУДОВАНИЕ
  // ══════════════════════════════════════════════════════
  console.log("► Шаг 1: Создание Ролей и Пользователей...");

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

  const userAdmin = await prisma.user.upsert({
    where: { email: "admin@ems.local" },
    update: { displayName: "Администратор EMS" },
    create: { email: "admin@ems.local", displayName: "Администратор EMS", isActive: true },
  });
  const userEditor = await prisma.user.upsert({
    where: { email: "editor@ems.local" },
    update: { displayName: "Иванов Иван Петрович (Инженер)" },
    create: { email: "editor@ems.local", displayName: "Иванов Иван Петрович (Инженер)", isActive: true },
  });
  const userApprover = await prisma.user.upsert({
    where: { email: "approver@ems.local" },
    update: { displayName: "Смирнов Дмитрий Олегович (Нач. цеха)" },
    create: { email: "approver@ems.local", displayName: "Смирнов Дмитрий Олегович (Нач. цеха)", isActive: true },
  });
  const userViewer = await prisma.user.upsert({
    where: { email: "viewer@ems.local" },
    update: {},
    create: { email: "viewer@ems.local", displayName: "Наблюдатель (Viewer)", isActive: true },
  });

  for (const [userId, roleId] of [
    [userAdmin.id, roleAdmin.id],
    [userEditor.id, roleEditor.id],
    [userApprover.id, roleApprover.id],
    [userViewer.id, roleViewer.id],
  ]) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }

  // Справочники
  console.log("► Шаг 2: Справочные поля и типы оборудования...");
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

  // EquipmentTypeAttributes
  const typeAttrs = [
    { typeValue: "Насосное оборудование", key: "power_kw", label: "Мощность (кВт)", dataType: "NUMBER", required: true, sortOrder: 1 },
    { typeValue: "Насосное оборудование", key: "flow_m3h", label: "Подача (м³/ч)", dataType: "NUMBER", required: true, sortOrder: 2 },
    { typeValue: "Насосное оборудование", key: "head_m", label: "Напор (м)", dataType: "NUMBER", required: false, sortOrder: 3 },
    { typeValue: "Электрооборудование", key: "power_kva", label: "Мощность (кВА)", dataType: "NUMBER", required: true, sortOrder: 1 },
    { typeValue: "Электрооборудование", key: "voltage_high_kv", label: "Напряжение ВН (кВ)", dataType: "NUMBER", required: true, sortOrder: 2 },
    { typeValue: "Компрессорное оборудование", key: "pressure_bar", label: "Давление (бар)", dataType: "NUMBER", required: true, sortOrder: 1 },
    { typeValue: "Вентиляционное оборудование", key: "flow_m3h", label: "Производительность (м³/ч)", dataType: "NUMBER", required: true, sortOrder: 1 },
    { typeValue: "Технологическое оборудование", key: "power_kw", label: "Мощность (кВт)", dataType: "NUMBER", required: false, sortOrder: 1 },
  ];
  for (const attr of typeAttrs) {
    await prisma.equipmentTypeAttribute.upsert({
      where: { typeValue_key: { typeValue: attr.typeValue, key: attr.key } },
      update: {},
      create: attr,
    });
  }

  // ── ОБОРУДОВАНИЕ ──────────────────────────────────────
  console.log("► Шаг 3: Создание единиц оборудования EPS...");
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
    },
  });

  // Equipment Versions
  for (const [eqId, version, summary, createdById, snapshot] of [
    [eq1.id, 1, "Первичная регистрация", userEditor.id, { status: "DRAFT", lifecycleStage: "COMMISSIONED" }],
    [eq1.id, 2, "Ввод в эксплуатацию после проверки", userApprover.id, { status: "ACTIVE", lifecycleStage: "IN_OPERATION" }],
    [eq4.id, 1, "Первичная запись вентилятора ВЦ-14", userAdmin.id, { status: "ACTIVE", lifecycleStage: "IN_OPERATION" }],
    [eq4.id, 2, "Вывод на плановый ремонт", userAdmin.id, { status: "INACTIVE", lifecycleStage: "MAINTENANCE" }],
  ] as any[]) {
    await prisma.equipmentVersion.upsert({
      where: { equipmentId_versionNumber: { equipmentId: eqId, versionNumber: version } },
      update: {},
      create: {
        equipmentId: eqId,
        versionNumber: version,
        changeSummary: summary,
        createdById,
        snapshot,
      },
    });
  }

  // Documents
  console.log("► Шаг 4: Документы, согласования, события...");
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

  // Approvals
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

  // Equipment Events
  await prisma.equipmentEvent.createMany({
    data: [
      { equipmentId: eq1.id, eventType: EventType.CREATED, title: "Оборудование зарегистрировано", description: "Первичная регистрация насосной станции Ц-12", actorId: userEditor.id, createdAt: new Date("2023-01-25") },
      { equipmentId: eq1.id, eventType: EventType.STATUS_CHANGED, title: "Статус: DRAFT → ACTIVE", description: "Оборудование введено в эксплуатацию", actorId: userApprover.id, createdAt: new Date("2023-02-03"), payload: { from: "DRAFT", to: "ACTIVE" } },
      { equipmentId: eq1.id, eventType: EventType.DOCUMENT_ATTACHED, title: "Прикреплён паспорт оборудования", actorId: userEditor.id, createdAt: new Date("2023-02-01") },
      { equipmentId: eq2.id, eventType: EventType.CREATED, title: "Оборудование зарегистрировано", description: "Первичная регистрация трансформатора ТМ-630", actorId: userAdmin.id, createdAt: new Date("2021-04-01") },
      { equipmentId: eq4.id, eventType: EventType.STATUS_CHANGED, title: "Статус: ACTIVE → INACTIVE", description: "Вентилятор выведен на плановый ремонт", actorId: userAdmin.id, createdAt: new Date("2025-07-15"), payload: { from: "ACTIVE", to: "INACTIVE" } },
      { equipmentId: eq3.id, eventType: EventType.CREATED, title: "Оборудование зарегистрировано", description: "Первичная регистрация компрессора АИР-160", actorId: userEditor.id, createdAt: new Date("2022-06-01") },
    ],
  });

  // Audit Logs
  await prisma.auditLog.createMany({
    data: [
      { actorId: userEditor.id, actorEmail: userEditor.email, action: AuditAction.CREATE, entityType: "Equipment", entityId: eq1.id, afterState: { equipmentCode: "EQ-NS-001", name: "Насосная станция Ц-12" }, createdAt: new Date("2023-01-25") },
      { actorId: userApprover.id, actorEmail: userApprover.email, action: AuditAction.APPROVE, entityType: "EquipmentVersion", entityId: eq1.id, metadata: { version: 2, decision: "APPROVED" }, createdAt: new Date("2023-02-03") },
      { actorId: userAdmin.id, actorEmail: userAdmin.email, action: AuditAction.UPDATE, entityType: "Equipment", entityId: eq4.id, beforeState: { status: "ACTIVE" }, afterState: { status: "INACTIVE" }, createdAt: new Date("2025-07-15") },
      { actorId: userAdmin.id, actorEmail: userAdmin.email, action: AuditAction.LOGIN, entityType: "User", entityId: userAdmin.id, metadata: { method: "mock" }, createdAt: new Date() },
    ],
  });

  // ══════════════════════════════════════════════════════
  // БЛОК 2: WMS — СКЛАДЫ, ЯЧЕЙКИ, НОМЕНКЛАТУРА, ДВИЖЕНИЯ
  // ══════════════════════════════════════════════════════
  console.log("\n► Шаг 5: Склады и ячейки хранения WMS...");

  const wh1 = await prisma.warehouse.upsert({
    where: { name: "Склад №1 (Главный хаб ЗИП)" },
    update: { responsibleUser: "Иванов Иван Петрович (Инженер)", responsibleUsername: "editor" },
    create: {
      name: "Склад №1 (Главный хаб ЗИП)",
      code: "WH-001",
      location: "Цех №3, корпус А",
      responsibleUser: "Иванов Иван Петрович (Инженер)",
      responsibleUsername: "editor",
      storageCells: {
        create: [
          { code: "А-01-1", description: "Стеллаж 1, Секция А, Полка 1" },
          { code: "А-01-2", description: "Стеллаж 1, Секция А, Полка 2" },
          { code: "Б-02-1", description: "Стеллаж 2, Секция Б, Полка 1" },
          { code: "Б-03-2", description: "Стеллаж 3, Секция Б, Полка 2" },
        ],
      },
    },
  });

  const wh2 = await prisma.warehouse.upsert({
    where: { name: "Склад №2 (Расходные материалы & СИЗ)" },
    update: { responsibleUser: "Смирнов Дмитрий Олегович (Нач. цеха)", responsibleUsername: "approver" },
    create: {
      name: "Склад №2 (Расходные материалы & СИЗ)",
      code: "WH-002",
      location: "АБК, этаж 1",
      responsibleUser: "Смирнов Дмитрий Олегович (Нач. цеха)",
      responsibleUsername: "approver",
      storageCells: {
        create: [
          { code: "В-01-1", description: "Стеллаж 3, Секция В, Полка 1 — СИЗ" },
          { code: "В-02-3", description: "Стеллаж 3, Секция В, Полка 3 — Расходники" },
          { code: "Г-01-1", description: "Шкаф 1, Полка 1 — Химия" },
        ],
      },
    },
  });

  const wh3 = await prisma.warehouse.upsert({
    where: { name: "Склад №3 (Инструментальный участок)" },
    update: { responsibleUser: "Администратор EMS", responsibleUsername: "admin" },
    create: {
      name: "Склад №3 (Инструментальный участок)",
      code: "WH-003",
      location: "Цех №1, бытовка",
      responsibleUser: "Администратор EMS",
      responsibleUsername: "admin",
      storageCells: {
        create: [
          { code: "Г-05-1", description: "Стеллаж 5, Шкаф инструментов А" },
          { code: "Г-05-2", description: "Стеллаж 5, Шкаф инструментов Б" },
        ],
      },
    },
  });

  // ── НОМЕНКЛАТУРА ТМЦ ──────────────────────────────────
  console.log("► Шаг 6: Номенклатурные единицы ТМЦ...");

  const item1 = await prisma.wmsItem.upsert({
    where: { sku: "SKU-ZIP-10023" },
    update: { quantity: 45 },
    create: {
      sku: "SKU-ZIP-10023",
      name: "Подшипник роликовый SKF 32210",
      category: "Запчасти & Механика",
      type: WmsItemType.ZIP,
      unit: "шт",
      warehouse: wh1.name,
      cell: "А-01-1",
      quantity: 45,
      minQuantity: 10,
      maxQuantity: 100,
      unitPrice: 2450.00,
      currency: "RUB",
      status: WmsItemStatus.IN_STOCK,
      supplier: "ООО Промышленный Подшипник",
      barcode: "2000000100234",
      description: "Усиленный роликовый подшипник для редукторов насосных станций",
    },
  });

  const item2 = await prisma.wmsItem.upsert({
    where: { sku: "SKU-PPE-50012" },
    update: { quantity: 18 },
    create: {
      sku: "SKU-PPE-50012",
      name: "Костюм термостойкий изолирующий СИЗ-4",
      category: "СИЗ & Спецодежда",
      type: WmsItemType.PPE,
      unit: "компл",
      warehouse: wh2.name,
      cell: "В-01-1",
      quantity: 18,
      minQuantity: 5,
      maxQuantity: 50,
      unitPrice: 8900.00,
      currency: "RUB",
      status: WmsItemStatus.IN_STOCK,
      supplier: "АО Восток-Сервис",
      barcode: "2000000500128",
      description: "Термостойкий комплект защиты для ремонтных бригад. ГОСТ Р 12.4.222",
    },
  });

  const item3 = await prisma.wmsItem.upsert({
    where: { sku: "SKU-TL-80004" },
    update: { quantity: 8 },
    create: {
      sku: "SKU-TL-80004",
      name: "Набор ключей динамометрических Hazet 1/2\"",
      category: "Инструменты",
      type: WmsItemType.TOOL,
      unit: "шт",
      warehouse: wh3.name,
      cell: "Г-05-1",
      quantity: 8,
      minQuantity: 3,
      maxQuantity: 20,
      unitPrice: 16500.00,
      currency: "RUB",
      status: WmsItemStatus.IN_STOCK,
      supplier: "Hazet Russia",
      barcode: "2000000800041",
      description: "Профессиональный динамометрический ключ с поверкой",
    },
  });

  const item4 = await prisma.wmsItem.upsert({
    where: { sku: "SKU-ZIP-20044" },
    update: { quantity: 3 },
    create: {
      sku: "SKU-ZIP-20044",
      name: "Манжета гидравлическая 50×70 (уплотнение насоса)",
      category: "Запчасти & Механика",
      type: WmsItemType.ZIP,
      unit: "шт",
      warehouse: wh1.name,
      cell: "А-01-2",
      quantity: 3,
      minQuantity: 5,
      maxQuantity: 30,
      unitPrice: 890.00,
      currency: "RUB",
      status: WmsItemStatus.LOW_STOCK,
      supplier: "ООО Гидроком",
      description: "Уплотнительная манжета для торцевых уплотнений насосных агрегатов",
    },
  });

  const item5 = await prisma.wmsItem.upsert({
    where: { sku: "SKU-CON-30007" },
    update: { quantity: 120 },
    create: {
      sku: "SKU-CON-30007",
      name: "Масло индустриальное И-40А (20л)",
      category: "ГСМ & Расходники",
      type: WmsItemType.CONSUMABLE,
      unit: "канистра",
      warehouse: wh2.name,
      cell: "В-02-3",
      quantity: 120,
      minQuantity: 20,
      maxQuantity: 200,
      unitPrice: 3200.00,
      currency: "RUB",
      status: WmsItemStatus.IN_STOCK,
      supplier: "ООО Лукойл-Смазочные",
      description: "Индустриальное масло для смазки редукторов и подшипников",
    },
  });

  const item6 = await prisma.wmsItem.upsert({
    where: { sku: "SKU-PPE-50034" },
    update: { quantity: 45 },
    create: {
      sku: "SKU-PPE-50034",
      name: "Каска защитная JSP Evolution 6151 (белая)",
      category: "СИЗ & Спецодежда",
      type: WmsItemType.PPE,
      unit: "шт",
      warehouse: wh2.name,
      cell: "В-01-1",
      quantity: 45,
      minQuantity: 10,
      maxQuantity: 100,
      unitPrice: 1850.00,
      currency: "RUB",
      status: WmsItemStatus.IN_STOCK,
      supplier: "АО Восток-Сервис",
      description: "Защитная каска для ИТР и персонала цехов",
    },
  });

  const item7 = await prisma.wmsItem.upsert({
    where: { sku: "SKU-ZIP-10088" },
    update: { quantity: 0 },
    create: {
      sku: "SKU-ZIP-10088",
      name: "Рем. комплект уплотнений насоса Grundfos CR32",
      category: "Запчасти & Механика",
      type: WmsItemType.ZIP,
      unit: "компл",
      warehouse: wh1.name,
      cell: "Б-02-1",
      quantity: 0,
      minQuantity: 2,
      maxQuantity: 10,
      unitPrice: 12400.00,
      currency: "RUB",
      status: WmsItemStatus.OUT_OF_STOCK,
      supplier: "ООО Грундфос Россия",
      equipmentId: eq1.id,
      isEps: true,
      description: "Оригинальный ремонтный комплект торцевых уплотнений для CR32-3",
    },
  });

  // ── ДВИЖЕНИЯ ТМЦ ──────────────────────────────────────
  console.log("► Шаг 7: История движений ТМЦ...");
  await prisma.wmsMovement.createMany({
    data: [
      { itemId: item1.id, itemSku: item1.sku, itemName: item1.name, type: WmsMovementType.INCOMING, quantity: 50, fromLocation: "Поставщик ООО Промышленный Подшипник", toLocation: "А-01-1", performedBy: "Иванов И.П.", reason: "Приход по накладной №452" },
      { itemId: item1.id, itemSku: item1.sku, itemName: item1.name, type: WmsMovementType.OUTGOING, quantity: 5, fromLocation: "А-01-1", toLocation: "Насосная станция Ц-12", performedBy: "Иванов И.П.", reason: "Плановая замена подшипника", relatedOrderOrEq: "EQ-NS-001 — Насосная станция Ц-12" },
      { itemId: item2.id, itemSku: item2.sku, itemName: item2.name, type: WmsMovementType.INCOMING, quantity: 20, fromLocation: "Поставщик АО Восток-Сервис", toLocation: "В-01-1", performedBy: "Смирнов Д.О.", reason: "Квартальное пополнение СИЗ" },
      { itemId: item2.id, itemSku: item2.sku, itemName: item2.name, type: WmsMovementType.PERSONAL_CARD, quantity: 2, fromLocation: "В-01-1", toLocation: "Петров А.С. (таб. 00112)", performedBy: "Смирнов Д.О.", reason: "Выдача СИЗ по личной карточке сотрудника" },
      { itemId: item4.id, itemSku: item4.sku, itemName: item4.name, type: WmsMovementType.INCOMING, quantity: 10, fromLocation: "Поставщик ООО Гидроком", toLocation: "А-01-2", performedBy: "Иванов И.П.", reason: "Новая партия манжет" },
      { itemId: item4.id, itemSku: item4.sku, itemName: item4.name, type: WmsMovementType.OUTGOING, quantity: 7, fromLocation: "А-01-2", toLocation: "Ц-12 — замена уплотнения", performedBy: "Иванов И.П.", reason: "Аварийная замена уплотнения насоса", relatedOrderOrEq: "EQ-NS-001 — Насосная станция Ц-12" },
      { itemId: item5.id, itemSku: item5.sku, itemName: item5.name, type: WmsMovementType.INCOMING, quantity: 120, fromLocation: "Поставщик ООО Лукойл-Смазочные", toLocation: "В-02-3", performedBy: "Смирнов Д.О.", reason: "Годовой запас ГСМ" },
      { itemId: item3.id, itemSku: item3.sku, itemName: item3.name, type: WmsMovementType.TRANSFER, quantity: 2, fromLocation: wh3.name, toLocation: wh1.name, performedBy: "Администратор EMS", reason: "Передача инструмента в Склад №1" },
    ],
    skipDuplicates: true,
  });

  // ── СОТРУДНИКИ WMS ──────────────────────────────────────
  console.log("► Шаг 8: Реестр сотрудников для личных карточек СИЗ...");
  const employees = [
    { name: "Петров Алексей Сергеевич", employeeNumber: "00112", position: "Инженер-механик", department: "Цех №1", warehouse: wh1.name },
    { name: "Козлов Виктор Андреевич", employeeNumber: "00213", position: "Электромонтёр 4р.", department: "Цех №2", warehouse: wh2.name },
    { name: "Новикова Елена Юрьевна", employeeNumber: "00347", position: "Оператор установки", department: "Цех №3", warehouse: wh1.name },
    { name: "Морозов Сергей Игоревич", employeeNumber: "00421", position: "Слесарь-ремонтник 5р.", department: "ОГМ", warehouse: wh1.name },
    { name: "Захаров Николай Петрович", employeeNumber: "00512", position: "Мастер смены", department: "Цех №1", warehouse: wh3.name },
    { name: "Федорова Ирина Васильевна", employeeNumber: "00614", position: "Лаборант ОТК", department: "ОГЭ", warehouse: wh2.name },
  ];
  for (const emp of employees) {
    await prisma.wmsEmployee.upsert({
      where: { employeeNumber: emp.employeeNumber },
      update: {},
      create: emp,
    });
  }

  // ── ЛИЧНЫЕ КАРТОЧКИ ──────────────────────────────────────
  console.log("► Шаг 9: Личные карточки выдачи СИЗ...");
  await prisma.wmsPersonalCard.createMany({
    data: [
      {
        itemId: item2.id,
        itemSku: item2.sku,
        itemName: item2.name,
        employeeName: "Петров Алексей Сергеевич",
        employeePosition: "Инженер-механик",
        employeeNumber: "00112",
        department: "Цех №1",
        issuedQuantity: 1,
        issuedAt: new Date("2025-01-15"),
        notes: "Выдача термокомплекта под расписку",
      },
      {
        itemId: item6.id,
        itemSku: item6.sku,
        itemName: item6.name,
        employeeName: "Козлов Виктор Андреевич",
        employeePosition: "Электромонтёр 4р.",
        employeeNumber: "00213",
        department: "Цех №2",
        issuedQuantity: 1,
        issuedAt: new Date("2025-03-10"),
        notes: "Выдача каски при трудоустройстве",
      },
      {
        itemId: item6.id,
        itemSku: item6.sku,
        itemName: item6.name,
        employeeName: "Морозов Сергей Игоревич",
        employeePosition: "Слесарь-ремонтник 5р.",
        employeeNumber: "00421",
        department: "ОГМ",
        issuedQuantity: 1,
        issuedAt: new Date("2025-05-22"),
        returnedAt: new Date("2025-07-10"),
        returnCondition: "GOOD",
        notes: "Каска возвращена в удовлетворительном состоянии",
      },
    ],
    skipDuplicates: true,
  });

  // ── ЗАПРОСЫ НА ПЕРЕМЕЩЕНИЕ ──────────────────────────────
  console.log("► Шаг 10: Запросы на межскладское перемещение...");
  await prisma.wmsTransferRequest.createMany({
    data: [
      {
        itemId: item1.id,
        itemSku: item1.sku,
        itemName: item1.name,
        quantity: 5,
        fromWarehouse: wh1.name,
        toWarehouse: wh2.name,
        requestedBy: wh1.responsibleUser,
        requestedByUsername: wh1.responsibleUsername,
        targetMolUser: wh2.responsibleUser,
        targetMolUsername: wh2.responsibleUsername,
        reason: "Пополнение запаса ЗИП для СИЗ на участке №2",
        status: WmsTransferStatus.PENDING,
      },
      {
        itemId: item5.id,
        itemSku: item5.sku,
        itemName: item5.name,
        quantity: 20,
        fromWarehouse: wh2.name,
        toWarehouse: wh1.name,
        requestedBy: wh2.responsibleUser,
        requestedByUsername: wh2.responsibleUsername,
        targetMolUser: wh1.responsibleUser,
        targetMolUsername: wh1.responsibleUsername,
        reason: "Передача масла для ТО насосного оборудования",
        status: WmsTransferStatus.APPROVED,
      },
    ],
    skipDuplicates: true,
  });

  // ── ЗАЯВКИ НА ПОПОЛНЕНИЕ ──────────────────────────────────
  console.log("► Шаг 11: Заявки на пополнение со склада (Requisitions)...");
  const req1 = await prisma.wmsRequisition.upsert({
    where: { requisitionNumber: "REQ-2025-001" },
    update: {},
    create: {
      requisitionNumber: "REQ-2025-001",
      fromWarehouse: wh1.name,
      toWarehouse: wh2.name,
      requestedBy: "Иванов И.П.",
      status: WmsRequisitionStatus.REQUESTED,
      note: "Срочный запрос расходников для планового ТО насосов",
      items: {
        create: [
          { itemId: item5.id, itemSku: item5.sku, itemName: item5.name, quantity: 30 },
          { itemId: item4.id, itemSku: item4.sku, itemName: item4.name, quantity: 10 },
        ],
      },
    },
  });

  const req2 = await prisma.wmsRequisition.upsert({
    where: { requisitionNumber: "REQ-2025-002" },
    update: {},
    create: {
      requisitionNumber: "REQ-2025-002",
      fromWarehouse: wh2.name,
      toWarehouse: wh3.name,
      requestedBy: "Администратор EMS",
      status: WmsRequisitionStatus.APPROVED,
      note: "Плановое пополнение инструментальной комнаты",
      items: {
        create: [
          { itemId: item3.id, itemSku: item3.sku, itemName: item3.name, quantity: 2 },
        ],
      },
    },
  });

  // ── РЕЗЕРВИРОВАНИЕ ──────────────────────────────────────────
  console.log("► Шаг 12: Резервирование ТМЦ для плановых ТО...");
  await prisma.wmsReservation.createMany({
    data: [
      {
        itemId: item1.id,
        equipmentId: eq1.id,
        equipmentName: "Насосная станция Ц-12 (EQ-NS-001)",
        maintenancePlanDate: new Date("2025-08-15"),
        reservedQuantity: 4,
        reservedBy: "Иванов И.П.",
        reason: "Плановая замена подшипников насоса Ц-12",
        isActive: true,
      },
      {
        itemId: item4.id,
        equipmentId: eq1.id,
        equipmentName: "Насосная станция Ц-12 (EQ-NS-001)",
        maintenancePlanDate: new Date("2025-08-15"),
        reservedQuantity: 2,
        reservedBy: "Иванов И.П.",
        reason: "Замена манжет уплотнения в рамках планового ТО",
        isActive: true,
      },
      {
        itemId: item5.id,
        equipmentId: eq4.id,
        equipmentName: "Вентилятор ВЦ-14 (EQ-VN-004)",
        maintenancePlanDate: new Date("2025-09-15"),
        reservedQuantity: 10,
        reservedBy: "Администратор EMS",
        reason: "Смазка подшипников при капитальном ремонте",
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });

  // ── АКТЫ СПИСАНИЯ ──────────────────────────────────────────
  console.log("► Шаг 13: Акты списания ТМЦ (WriteOffs)...");
  await prisma.wmsWriteOff.createMany({
    data: [
      {
        itemId: item4.id,
        itemSku: item4.sku,
        itemName: item4.name,
        quantity: 7,
        reason: WmsWriteOffReason.EQUIPMENT_REPAIR,
        equipmentId: eq1.id,
        equipmentName: "Насосная станция Ц-12 (EQ-NS-001)",
        performedBy: "Иванов И.П.",
        comments: "Плановая замена уплотнений. Акт от 15.07.2025.",
      },
      {
        itemId: item1.id,
        itemSku: item1.sku,
        itemName: item1.name,
        quantity: 5,
        reason: WmsWriteOffReason.EQUIPMENT_REPAIR,
        equipmentId: eq4.id,
        equipmentName: "Вентилятор ВЦ-14 (EQ-VN-004)",
        performedBy: "Администратор EMS",
        comments: "Замена подшипников при капитальном ремонте вентилятора",
      },
    ],
    skipDuplicates: true,
  });

  // ── СИСТЕМНЫЕ МОДУЛИ ────────────────────────────────────────
  console.log("► Шаг 14: Системные модули и объекты предприятия...");
  const moduleDefs = [
    { code: "EPS", name: "Паспорт оборудования", description: "Управление жизненным циклом оборудования, документооборот, согласования" },
    { code: "WMS", name: "Складской учет (WMS)", description: "Управление складами, ТМЦ, движения, личные карточки СИЗ" },
  ];
  for (const mod of moduleDefs) {
    await prisma.systemModule.upsert({
      where: { code: mod.code },
      update: {},
      create: { code: mod.code, name: mod.name, description: mod.description, isEnabled: true, version: "1.0.0" },
    });
  }

  await prisma.enterpriseFacility.upsert({
    where: { code: "MAIN-PLANT" },
    update: {},
    create: { code: "MAIN-PLANT", name: "Основное производство (Головной завод)", address: "г. Алматы, ул. Промышленная, 1", isActive: true },
  });

  // ══════════════════════════════════════════════════════
  // ИТОГ
  // ══════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  ✅ Seed завершён успешно!");
  console.log("═══════════════════════════════════════════════════");
  console.log("  EPS:  4 Роли | 4 Пользователя | 5 Единиц оборудования");
  console.log("        4 Документа | 2 Согласования | 6 Событий | 4 Журнал аудита");
  console.log("  WMS:  3 Склада | 9 Ячеек | 7 Номенклатурных единиц ТМЦ");
  console.log("        8 Движений | 6 Сотрудников | 3 Личные карточки");
  console.log("        2 Запроса на перемещение | 2 Заявки | 3 Резерва | 2 Акта списания");
  console.log("═══════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("Ошибка Seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
