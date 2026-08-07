import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const headers = [
    "ID",
    "Артикул (SKU)",
    "Наименование ТМЦ / ЗИП",
    "Категория",
    "Тип",
    "Склад хранения",
    "Ячейка / Место хранения",
    "Остаток",
    "Ед. изм.",
    "Минимальный остаток",
    "Зарезервировано",
    "Цена за ед. (руб.)",
    "Общая стоимость (руб.)",
    "Статус остатка",
    "Поставщик",
    "Совместимое оборудование",
    "Штрихкод / QR"
  ];

  let items: any[] = [];
  try {
    items = await prisma.wmsItem.findMany();
  } catch (err) {
    console.error("Failed to query WMS items for export:", err);
  }

  const rows = items.map((item) => [
    item.id,
    `"${item.sku.replace(/"/g, '""')}"`,
    `"${item.name.replace(/"/g, '""')}"`,
    `"${item.category.replace(/"/g, '""')}"`,
    `"${item.type.replace(/"/g, '""')}"`,
    `"${item.warehouse.replace(/"/g, '""')}"`,
    `"${item.cell.replace(/"/g, '""')}"`,
    item.quantity,
    item.unit,
    item.minQuantity,
    item.reservedQuantity,
    item.unitPrice,
    item.quantity * item.unitPrice,
    item.status,
    `"${(item.supplier || "").replace(/"/g, '""')}"`,
    `"${(Array.isArray(item.compatibleEquipment) ? item.compatibleEquipment : []).join("; ").replace(/"/g, '""')}"`,
    `"${(item.barcode || "").replace(/"/g, '""')}"`
  ]);

  const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((row) => row.join(";"))].join("\n");

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wms_inventory_export_${new Date().toISOString().split("T")[0]}.csv"`
    }
  });
}
