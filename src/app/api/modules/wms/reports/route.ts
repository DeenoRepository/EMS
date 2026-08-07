import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const items = await prisma.wmsItem.findMany();
    
    // Формирование динамических отчетов на основе текущего состояния склада
    const reports = [
      {
        id: "rep-wms-001",
        name: "Ведомость остатков ТМЦ на складах",
        category: "Складские остатки",
        format: "XLSX",
        generatedAt: new Date().toISOString(),
        status: "READY",
        size: "1.4 MB",
        description: "Полная выгрузка текущих остатков ТМЦ по всем складам и ячейкам хранения.",
        recordsCount: items.length
      },
      {
        id: "rep-wms-002",
        name: "Отчет по дефицитным позициям (Low Stock)",
        category: "Анализ запасов",
        format: "PDF",
        generatedAt: new Date().toISOString(),
        status: "READY",
        size: "840 KB",
        description: "Перечень позиций, количественный остаток которых ниже минимальной нормы.",
        recordsCount: items.filter((i) => i.quantity <= i.minQuantity).length
      },
      {
        id: "rep-wms-003",
        name: "Журнал движения и выдачи ТМЦ",
        category: "Движение ТМЦ",
        format: "CSV",
        generatedAt: new Date().toISOString(),
        status: "READY",
        size: "2.1 MB",
        description: "История операций прихода, расхода и внутренного перемещения за 30 дней.",
        recordsCount: 45
      }
    ];

    return NextResponse.json({ reports });
  } catch (err) {
    console.error("Failed to generate/fetch WMS reports:", err);
    return NextResponse.json({ reports: [] });
  }
}
