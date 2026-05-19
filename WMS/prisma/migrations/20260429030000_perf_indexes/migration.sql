-- Performance indexes for operational queries and dashboards
CREATE INDEX IF NOT EXISTS "StockMovement_warehouseId_createdAt_idx" ON "StockMovement"("warehouseId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockMovement_itemId_createdAt_idx" ON "StockMovement"("itemId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockMovement_toWarehouseId_idx" ON "StockMovement"("toWarehouseId");

CREATE INDEX IF NOT EXISTS "StockReservation_status_updatedAt_idx" ON "StockReservation"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "StockReservation_mmsWorkOrderId_status_idx" ON "StockReservation"("mmsWorkOrderId", "status");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'InternalRequestLine'
  ) THEN
    CREATE INDEX IF NOT EXISTS "InternalRequestLine_status_createdAt_idx" ON "InternalRequestLine"("status", "createdAt");
    CREATE INDEX IF NOT EXISTS "InternalRequestLine_reservationId_idx" ON "InternalRequestLine"("reservationId");
  END IF;
END $$;
