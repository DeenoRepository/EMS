import { PrismaClient, WmsItemType, WmsItemStatus, WmsMovementType, WmsTransferStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding WMS warehouses, storage cells, items, movements, and personal cards...");

  // 1. Seed Warehouses & MOLs
  const wh1 = await prisma.warehouse.upsert({
    where: { name: "Склад №1 (Главный хаб ЗИП)" },
    update: {
      responsibleUser: "Инженер Редактор (editor)",
      responsibleUsername: "editor",
    },
    create: {
      name: "Склад №1 (Главный хаб ЗИП)",
      responsibleUser: "Инженер Редактор (editor)",
      responsibleUsername: "editor",
      storageCells: {
        create: [
          { code: "А-01-1", description: "Стеллаж 1, Секция А, Полка 1" },
          { code: "А-01-2", description: "Стеллаж 1, Секция А, Полка 2" },
          { code: "Б-02-1", description: "Стеллаж 2, Секция Б, Полка 1" },
        ]
      }
    }
  });

  const wh2 = await prisma.warehouse.upsert({
    where: { name: "Склад №2 (Расходные материалы & СИЗ)" },
    update: {
      responsibleUser: "Руководитель Согласующий (approver)",
      responsibleUsername: "approver",
    },
    create: {
      name: "Склад №2 (Расходные материалы & СИЗ)",
      responsibleUser: "Руководитель Согласующий (approver)",
      responsibleUsername: "approver",
      storageCells: {
        create: [
          { code: "В-01-1", description: "Стеллаж 3, Секция В, Полка 1" },
          { code: "В-02-3", description: "Стеллаж 3, Секция В, Полка 3" },
        ]
      }
    }
  });

  const wh3 = await prisma.warehouse.upsert({
    where: { name: "Склад №3 (Инструментальный участок)" },
    update: {
      responsibleUser: "Администратор EMS (admin)",
      responsibleUsername: "admin",
    },
    create: {
      name: "Склад №3 (Инструментальный участок)",
      responsibleUser: "Администратор EMS (admin)",
      responsibleUsername: "admin",
      storageCells: {
        create: [
          { code: "Г-05-1", description: "Стеллаж 5, Шкаф инструментов" },
        ]
      }
    }
  });

  // 2. Seed WMS Items
  const item1 = await prisma.wmsItem.upsert({
    where: { sku: "SKU-ZIP-10023" },
    update: {},
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
      description: "Усиленный роликовый подшипник для редукторов насосных станций"
    }
  });

  const item2 = await prisma.wmsItem.upsert({
    where: { sku: "SKU-PPE-50012" },
    update: {},
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
      description: "Термостойкий комплект защиты для ремонтных бригад"
    }
  });

  const item3 = await prisma.wmsItem.upsert({
    where: { sku: "SKU-TL-80004" },
    update: {},
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
      description: "Профессиональный динамометрический ключ с поверкой"
    }
  });

  // 3. Seed WMS Movements
  await prisma.wmsMovement.createMany({
    data: [
      {
        itemId: item1.id,
        itemSku: item1.sku,
        itemName: item1.name,
        type: WmsMovementType.INCOMING,
        quantity: 50,
        fromLocation: "Поставка от поставщика ООО Промышленный Подшипник",
        toLocation: "А-01-1",
        performedBy: "Инженер Редактор (editor)",
        reason: "Приход по накладной №452",
      },
      {
        itemId: item1.id,
        itemSku: item1.sku,
        itemName: item1.name,
        type: WmsMovementType.OUTGOING,
        quantity: 5,
        fromLocation: "А-01-1",
        toLocation: "Насосная станция Ц-12",
        performedBy: "Инженер Редактор (editor)",
        reason: "Плановая замена подшипника",
        relatedOrderOrEq: "Насосная станция Ц-12 (EQ-1770440367)"
      }
    ],
    skipDuplicates: true
  });

  // 4. Seed Personal Cards
  await prisma.wmsPersonalCard.create({
    data: {
      itemId: item2.id,
      itemSku: item2.sku,
      itemName: item2.name,
      employeeName: "Петров Алексей Сергеевич",
      employeePosition: "Инженер-механик",
      department: "Цех №1",
      issuedQuantity: 1,
      notes: "Выдача комплекта СИЗ под расписку",
      createdById: "usr-editor"
    }
  });

  // 5. Seed Transfer Requests
  await prisma.wmsTransferRequest.create({
    data: {
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
      reason: "Пополнение запаса ЗИП на участке №2",
      status: WmsTransferStatus.PENDING
    }
  });

  console.log("WMS Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("WMS Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
