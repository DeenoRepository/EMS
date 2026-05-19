import { Prisma, PrismaClient } from "@prisma/client";
import { mmsApiClient } from "@/lib/integrations/mms-api-client";

const D = Prisma.Decimal;

export type StockContext = {
  prisma: PrismaClient;
  actor?: string;
};

function toDecimal(value: number | string | Prisma.Decimal) {
  return value instanceof D ? value : new D(value);
}

function sub(a: Prisma.Decimal, b: Prisma.Decimal) {
  return a.sub(b);
}

function add(a: Prisma.Decimal, b: Prisma.Decimal) {
  return a.add(b);
}

function gte(a: Prisma.Decimal, b: Prisma.Decimal) {
  return a.greaterThanOrEqualTo(b);
}

function toNumber(value: Prisma.Decimal) {
  return Number(value.toString());
}

function availableOf(balance: { quantity: Prisma.Decimal; reservedQuantity: Prisma.Decimal }) {
  return sub(balance.quantity, balance.reservedQuantity);
}

async function ensureBalanceRow(
  tx: Prisma.TransactionClient,
  params: { itemId: string; warehouseId: string }
) {
  const existing = await tx.stockBalance.findFirst({
    where: {
      itemId: params.itemId,
      warehouseId: params.warehouseId
    }
  });

  if (existing) return existing;

  return tx.stockBalance.create({
    data: {
      itemId: params.itemId,
      warehouseId: params.warehouseId,
      quantity: new D(0),
      reservedQuantity: new D(0)
    }
  });
}

async function pickBalanceWithAvailability(
  tx: Prisma.TransactionClient,
  params: { itemId: string; quantity: Prisma.Decimal; warehouseId?: string }
) {
  const rows = await tx.stockBalance.findMany({
    where: {
      itemId: params.itemId,
      ...(params.warehouseId ? { warehouseId: params.warehouseId } : {})
    },
    orderBy: [{ updatedAt: "desc" }]
  });

  return rows.find((row) => gte(availableOf(row), params.quantity));
}

async function createMovement(
  tx: Prisma.TransactionClient,
  params: {
    itemId: string;
    warehouseId: string;
    toWarehouseId?: string;
    movementType: "RECEIPT" | "ISSUE" | "TRANSFER" | "ADJUSTMENT" | "RESERVATION" | "RESERVATION_CANCEL";
    quantity: Prisma.Decimal;
    relatedMmsWorkOrderId?: string;
    relatedMmsRequiredPartId?: string;
    reservationId?: string;
    comment?: string;
    createdBy?: string;
  }
) {
  return tx.stockMovement.create({
    data: {
      itemId: params.itemId,
      warehouseId: params.warehouseId,
      toWarehouseId: params.toWarehouseId,
      movementType: params.movementType,
      quantity: params.quantity,
      relatedMmsWorkOrderId: params.relatedMmsWorkOrderId,
      relatedMmsRequiredPartId: params.relatedMmsRequiredPartId,
      reservationId: params.reservationId,
      comment: params.comment,
      createdBy: params.createdBy
    }
  });
}

export const stockService = {
  async receipt(ctx: StockContext, input: { itemId: string; warehouseId: string; quantity: number; comment?: string; createdBy?: string }) {
    const qty = toDecimal(input.quantity);
    const movement = await ctx.prisma.$transaction(async (tx) => {
      const balance = await ensureBalanceRow(tx, input);
      await tx.stockBalance.update({
        where: { id: balance.id },
        data: {
          quantity: add(balance.quantity, qty)
        }
      });

      return createMovement(tx, {
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        movementType: "RECEIPT",
        quantity: qty,
        comment: input.comment,
        createdBy: input.createdBy || ctx.actor
      });
    });

    return movement;
  },

  async issue(ctx: StockContext, input: { itemId: string; warehouseId?: string; quantity: number; relatedMmsWorkOrderId?: string; relatedMmsRequiredPartId?: string; comment?: string; createdBy?: string }) {
    const qty = toDecimal(input.quantity);

    const movement = await ctx.prisma.$transaction(async (tx) => {
      const picked = await pickBalanceWithAvailability(tx, {
        itemId: input.itemId,
        quantity: qty,
        warehouseId: input.warehouseId
      });

      if (!picked) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      await tx.stockBalance.update({
        where: { id: picked.id },
        data: {
          quantity: sub(picked.quantity, qty)
        }
      });

      return createMovement(tx, {
        itemId: input.itemId,
        warehouseId: picked.warehouseId,
        movementType: "ISSUE",
        quantity: qty,
        relatedMmsWorkOrderId: input.relatedMmsWorkOrderId,
        relatedMmsRequiredPartId: input.relatedMmsRequiredPartId,
        comment: input.comment,
        createdBy: input.createdBy || ctx.actor
      });
    });

    return movement;
  },

  async transfer(ctx: StockContext, input: { itemId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; comment?: string; createdBy?: string }) {
    const qty = toDecimal(input.quantity);

    const movement = await ctx.prisma.$transaction(async (tx) => {
      const source = await ensureBalanceRow(tx, {
        itemId: input.itemId,
        warehouseId: input.fromWarehouseId
      });

      if (!gte(availableOf(source), qty)) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      const target = await ensureBalanceRow(tx, {
        itemId: input.itemId,
        warehouseId: input.toWarehouseId
      });

      await tx.stockBalance.update({
        where: { id: source.id },
        data: { quantity: sub(source.quantity, qty) }
      });

      await tx.stockBalance.update({
        where: { id: target.id },
        data: { quantity: add(target.quantity, qty) }
      });

      return createMovement(tx, {
        itemId: input.itemId,
        warehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        movementType: "TRANSFER",
        quantity: qty,
        comment: input.comment,
        createdBy: input.createdBy || ctx.actor
      });
    });

    return movement;
  },

  async adjustment(ctx: StockContext, input: { itemId: string; warehouseId: string; quantityDelta: number; comment?: string; createdBy?: string }) {
    const delta = toDecimal(input.quantityDelta);

    const movement = await ctx.prisma.$transaction(async (tx) => {
      const balance = await ensureBalanceRow(tx, {
        itemId: input.itemId,
        warehouseId: input.warehouseId
      });

      const nextQty = add(balance.quantity, delta);
      if (nextQty.lessThan(0)) {
        throw new Error("NEGATIVE_STOCK_FORBIDDEN");
      }
      if (balance.reservedQuantity.greaterThan(nextQty)) {
        throw new Error("RESERVED_EXCEEDS_QUANTITY");
      }

      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { quantity: nextQty }
      });

      return createMovement(tx, {
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        movementType: "ADJUSTMENT",
        quantity: delta.abs(),
        comment: input.comment,
        createdBy: input.createdBy || ctx.actor
      });
    });

    return movement;
  },

  async reserve(ctx: StockContext, input: { itemId: string; warehouseId?: string; mmsWorkOrderId: string; mmsRequiredPartId: string; quantity: number }) {
    const qty = toDecimal(input.quantity);

    const result = await ctx.prisma.$transaction(async (tx) => {
      const picked = await pickBalanceWithAvailability(tx, {
        itemId: input.itemId,
        quantity: qty,
        warehouseId: input.warehouseId
      });

      if (!picked) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      await tx.stockBalance.update({
        where: { id: picked.id },
        data: {
          reservedQuantity: add(picked.reservedQuantity, qty)
        }
      });

      const reservation = await tx.stockReservation.create({
        data: {
          itemId: input.itemId,
          warehouseId: picked.warehouseId,
          mmsWorkOrderId: input.mmsWorkOrderId,
          mmsRequiredPartId: input.mmsRequiredPartId,
          quantity: qty,
          status: "ACTIVE"
        }
      });

      await createMovement(tx, {
        itemId: input.itemId,
        warehouseId: picked.warehouseId,
        movementType: "RESERVATION",
        quantity: qty,
        reservationId: reservation.id,
        relatedMmsWorkOrderId: input.mmsWorkOrderId,
        relatedMmsRequiredPartId: input.mmsRequiredPartId,
        comment: "Reserved for MMS work order",
        createdBy: ctx.actor
      });

      return reservation;
    });

    return {
      reservationId: result.id,
      status: "active",
      itemId: result.itemId,
      quantity: toNumber(result.quantity),
      warehouseId: result.warehouseId
    };
  },

  async cancelReservation(ctx: StockContext, reservationId: string, params?: { comment?: string; createdBy?: string }) {
    return ctx.prisma.$transaction(async (tx) => {
      const reservation = await tx.stockReservation.findUnique({ where: { id: reservationId } });
      if (!reservation) throw new Error("RESERVATION_NOT_FOUND");
      if (reservation.status !== "ACTIVE") throw new Error("RESERVATION_NOT_ACTIVE");

      const balance = await ensureBalanceRow(tx, {
        itemId: reservation.itemId,
        warehouseId: reservation.warehouseId
      });

      const nextReserved = sub(balance.reservedQuantity, reservation.quantity);
      if (nextReserved.lessThan(0)) throw new Error("INVALID_RESERVED_STATE");

      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { reservedQuantity: nextReserved }
      });

      const updated = await tx.stockReservation.update({
        where: { id: reservationId },
        data: { status: "CANCELLED" }
      });

      await createMovement(tx, {
        itemId: reservation.itemId,
        warehouseId: reservation.warehouseId,
        movementType: "RESERVATION_CANCEL",
        quantity: reservation.quantity,
        reservationId,
        relatedMmsWorkOrderId: reservation.mmsWorkOrderId,
        relatedMmsRequiredPartId: reservation.mmsRequiredPartId,
        comment: params?.comment || "Reservation cancelled",
        createdBy: params?.createdBy || ctx.actor
      });

      return updated;
    });
  },

  async issueReservation(ctx: StockContext, reservationId: string, params?: { comment?: string; createdBy?: string }) {
    const txResult = await ctx.prisma.$transaction(async (tx) => {
      const reservation = await tx.stockReservation.findUnique({ where: { id: reservationId } });
      if (!reservation) throw new Error("RESERVATION_NOT_FOUND");
      if (reservation.status !== "ACTIVE") throw new Error("RESERVATION_NOT_ACTIVE");

      const balance = await ensureBalanceRow(tx, {
        itemId: reservation.itemId,
        warehouseId: reservation.warehouseId
      });

      if (!gte(balance.quantity, reservation.quantity)) {
        throw new Error("INSUFFICIENT_STOCK");
      }
      if (!gte(balance.reservedQuantity, reservation.quantity)) {
        throw new Error("INVALID_RESERVED_STATE");
      }

      await tx.stockBalance.update({
        where: { id: balance.id },
        data: {
          quantity: sub(balance.quantity, reservation.quantity),
          reservedQuantity: sub(balance.reservedQuantity, reservation.quantity)
        }
      });

      const updated = await tx.stockReservation.update({
        where: { id: reservationId },
        data: { status: "ISSUED" }
      });

      await createMovement(tx, {
        itemId: reservation.itemId,
        warehouseId: reservation.warehouseId,
        movementType: "ISSUE",
        quantity: reservation.quantity,
        reservationId: reservation.id,
        relatedMmsWorkOrderId: reservation.mmsWorkOrderId,
        relatedMmsRequiredPartId: reservation.mmsRequiredPartId,
        comment: params?.comment || "Issued by reservation",
        createdBy: params?.createdBy || ctx.actor
      });

      return updated;
    });

    const syncResult = await mmsApiClient.tryUpdateRequiredPartStatus(txResult.mmsRequiredPartId, "issued");

    return {
      reservation: txResult,
      ...(syncResult.ok ? {} : { mms_sync_warning: syncResult.warning })
    };
  }
};
