import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Функция для получения даты последнего просмотра пользователем подраздела
    const getSeenDate = (subId: string): Date => {
      const param = searchParams.get(`seen_${subId}`);
      if (param && !isNaN(Number(param))) {
        return new Date(Number(param));
      }
      // По умолчанию берем прошлые 24 часа
      return new Date(Date.now() - 24 * 60 * 60 * 1000);
    };

    const epsReportsSeen = getSeenDate("nav-eps-reports");
    const epsHistorySeen = getSeenDate("nav-eps-history");
    const wmsMovementsSeen = getSeenDate("nav-wms-movements");

    // Параллельные запросы для подразделов EPS и WMS
    const [
      // EPS Counters
      epsMaintenanceCount,
      epsDocReviewCount,
      epsEventsCount,
      epsPendingApprovals,
      epsAuditHistoryCount,

      // WMS Counters
      wmsLowStockCount,
      wmsRecentMovementsCount,
      wmsActivePersonalCardsCount,
      wmsTopologyAttentionCount,
      wmsPendingRequisitionsCount,
      wmsPendingTransfersCount,
      wmsActiveReservationsCount,
    ] = await Promise.all([
      // EPS: Оборудование в ТО или черновиках
      prisma.equipment
        .count({
          where: {
            OR: [{ status: "DRAFT" }, { lifecycleStage: "MAINTENANCE" }],
          },
        })
        .catch(() => 0),

      // EPS: Документы на рассмотрении / черновики
      prisma.document
        .count({
          where: {
            status: { in: ["DRAFT", "IN_REVIEW"] },
          },
        })
        .catch(() => 0),

      // EPS: Непросмотренные отчёты и события оборудования (созданные ПОСЛЕ времени последнего просмотра)
      prisma.equipmentEvent
        .count({
          where: {
            createdAt: { gt: epsReportsSeen },
          },
        })
        .catch(() => 0),

      // EPS: Очередь нерассмотренных согласований (PENDING)
      prisma.approvalRequest
        .count({
          where: { status: "PENDING" },
        })
        .catch(() => 0),

      // EPS: Непросмотренная история изменений (записи аудита ПОСЛЕ просмотра)
      prisma.auditLog
        .count({
          where: {
            createdAt: { gt: epsHistorySeen },
          },
        })
        .catch(() => 0),

      // WMS: Непополненные ТМЦ с низким остатком или отсутствующие
      prisma.wmsItem
        .count({
          where: {
            OR: [{ status: "LOW_STOCK" }, { status: "OUT_OF_STOCK" }],
          },
        })
        .catch(() => 0),

      // WMS: Непросмотренные движения ТМЦ (созданные ПОСЛЕ просмотра)
      prisma.wmsMovement
        .count({
          where: {
            createdAt: { gt: wmsMovementsSeen },
          },
        })
        .catch(() => 0),

      // WMS: Невозвращенные личные карточки СИЗ
      prisma.wmsPersonalCard
        .count({
          where: { returnedAt: null },
        })
        .catch(() => 0),

      // WMS: Ячейки с исчерпанной емкостью
      prisma.storageCell
        .count({
          where: { capacity: { lte: 0 } },
        })
        .catch(() => 0),

      // WMS: Необработанные запросы со складов
      prisma.wmsRequisition
        .count({
          where: { status: "REQUESTED" },
        })
        .catch(() => 0),

      // WMS: Неподтвержденные межскладские перемещения
      prisma.wmsTransferRequest
        .count({
          where: { status: "PENDING" },
        })
        .catch(() => 0),

      // WMS: Активные резервы ЗИП
      prisma.wmsReservation
        .count({
          where: { isActive: true },
        })
        .catch(() => 0),
    ]);

    const counters: Record<string, number> = {
      "nav-eps-registry": epsMaintenanceCount,
      "nav-eps-documents": epsDocReviewCount,
      "nav-eps-reports": epsEventsCount,
      "nav-eps-approvals": epsPendingApprovals,
      "nav-eps-history": epsAuditHistoryCount,

      "nav-wms-dashboard": wmsLowStockCount,
      "nav-wms-movements": wmsRecentMovementsCount,
      "nav-wms-personal-cards": wmsActivePersonalCardsCount,
      "nav-wms-topology": wmsTopologyAttentionCount,
      "nav-wms-requisitions": wmsPendingRequisitionsCount + wmsPendingTransfersCount,
      "nav-wms-toir": wmsActiveReservationsCount,
    };

    return NextResponse.json({
      counters,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[Sidebar Counters API Error]:", error);
    return NextResponse.json(
      {
        counters: {},
        error: "Ошибка получения счетчиков сайдбара",
      },
      { status: 500 }
    );
  }
}
