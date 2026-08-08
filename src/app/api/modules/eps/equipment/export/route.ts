import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Prisma, EquipmentStatus } from "@prisma/client";
import { EquipmentItem } from "@/lib/modules/eps-store";
import { getSession } from "@/lib/auth/session";
import { logEvent } from "@/lib/telemetry/logger";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  logEvent({
    level: "audit",
    module: "EPS",
    action: "EXPORT_EQUIPMENT",
    userId: session.id,
    userEmail: session.email,
    details: { url: request.url }
  });

  const { searchParams } = new URL(request.url);
  const selectedFieldsParam = searchParams.get("fields");
  const departmentFilter = searchParams.get("department");
  const categoryFilter = searchParams.get("category");
  const statusFilter = searchParams.get("status");

  const where: Prisma.EquipmentWhereInput = {};
  if (departmentFilter && departmentFilter !== "ALL") {
    where.department = departmentFilter;
  }
  if (categoryFilter && categoryFilter !== "ALL") {
    where.category = categoryFilter;
  }
  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter as EquipmentStatus;
  }

  let items: Prisma.EquipmentGetPayload<object>[] = [];
  try {
    items = await prisma.equipment.findMany({ where });
  } catch (err) {
    console.error("Failed to query equipment for export:", err);
  }

  // Definition of ALL available fields in EquipmentItem
  const ALL_FIELDS: { key: keyof EquipmentItem | "techSpecs"; label: string; extract: (item: EquipmentItem) => string }[] = [
    { key: "equipmentCode", label: "Код оборудования", extract: (i) => i.equipmentCode || "" },
    { key: "name", label: "Наименование", extract: (i) => i.name || "" },
    { key: "type", label: "Тип оборудования", extract: (i) => i.type || "" },
    { key: "category", label: "Категория", extract: (i) => i.category || "" },
    { key: "model", label: "Модель", extract: (i) => i.model || "" },
    { key: "serialNumber", label: "Заводской №", extract: (i) => i.serialNumber || "" },
    { key: "inventoryNumber", label: "Инвентарный №", extract: (i) => i.inventoryNumber || "" },
    { key: "department", label: "Подразделение (Цех)", extract: (i) => i.department || "" },
    { key: "location", label: "Локация / Позиция", extract: (i) => i.location || "" },
    { key: "status", label: "Статус учета", extract: (i) => i.status || "" },
    { key: "lifecycleStage", label: "Стадия жизненного цикла", extract: (i) => i.lifecycleStage || "" },
    { key: "criticality", label: "Критичность", extract: (i) => i.criticality || "" },
    { key: "manufacturer", label: "Изготовитель", extract: (i) => i.manufacturer || "" },
    { key: "supplier", label: "Поставщик", extract: (i) => i.supplier || "" },
    { key: "countryOfOrigin", label: "Страна производства", extract: (i) => i.countryOfOrigin || "" },
    { key: "isImported", label: "Импортное", extract: (i) => (i.isImported ? "Да" : "Нет") },
    { key: "isUnique", label: "Уникальное", extract: (i) => (i.isUnique ? "Да" : "Нет") },
    { key: "productionDate", label: "Дата выпуска", extract: (i) => i.productionDate || "" },
    { key: "deliveryDate", label: "Дата поставки", extract: (i) => i.deliveryDate || "" },
    { key: "commissioningDate", label: "Дата ввода в эксплуатацию", extract: (i) => i.commissioningDate || "" },
    { key: "responsibleUser", label: "Ответственный сотрудник", extract: (i) => i.responsibleUser || "" },
    { key: "warrantyExpiration", label: "Гарантия до", extract: (i) => i.warrantyExpiration || "" },
    { key: "serviceDueDate", label: "Дата следующего ТО", extract: (i) => i.serviceDueDate || "" },
    { key: "notes", label: "Примечания / Описание", extract: (i) => i.notes || "" },
    {
      key: "techSpecs",
      label: "Технические характеристики",
      extract: (i) =>
        i.techSpecs
          ? Object.entries(i.techSpecs)
              .map(([k, v]) => `${k}: ${v}`)
              .join("; ")
          : "",
    },
    { key: "version", label: "Версия техпаспорта", extract: (i) => String(i.version || 1) },
    { key: "updatedAt", label: "Дата обновления", extract: (i) => i.updatedAt || "" },
  ];

  let selectedFields = ALL_FIELDS;
  if (selectedFieldsParam) {
    const keys = selectedFieldsParam.split(",");
    selectedFields = ALL_FIELDS.filter((f) => keys.includes(f.key));
    if (selectedFields.length === 0) {
      selectedFields = ALL_FIELDS;
    }
  }

  const headers = selectedFields.map((f) => f.label);
  const rows = items.map((item) =>
    selectedFields.map((field) => {
      const val = field.extract(item as unknown as EquipmentItem);
      return `"${val.replace(/"/g, '""')}"`;
    })
  );

  const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((e) => e.join(";"))].join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="equipment_export_full.csv"',
    },
  });
}
