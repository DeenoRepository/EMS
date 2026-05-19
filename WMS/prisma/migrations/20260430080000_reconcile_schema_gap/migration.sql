-- Reconcile schema gaps for environments where internal request tables
-- were not created in earlier migration history.

DO $$ BEGIN
  CREATE TYPE "InternalRequestStatus" AS ENUM ('NEW', 'RESERVED', 'PARTIAL', 'FULFILLED', 'TO_PROCUREMENT', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InternalRequestLineStatus" AS ENUM ('NEW', 'RESERVED', 'ISSUED', 'TO_PROCUREMENT', 'ANALOG_SUGGESTED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "InternalRequest" (
  "id" TEXT NOT NULL,
  "requestNumber" TEXT NOT NULL,
  "fromWarehouseId" TEXT NOT NULL,
  "toWarehouseId" TEXT NOT NULL,
  "status" "InternalRequestStatus" NOT NULL DEFAULT 'NEW',
  "comment" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InternalRequestLine" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "requestedQty" DECIMAL(14,3) NOT NULL,
  "reservedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "issuedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "status" "InternalRequestLineStatus" NOT NULL DEFAULT 'NEW',
  "resolutionNote" TEXT,
  "reservationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalRequestLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InternalRequest_requestNumber_key" ON "InternalRequest"("requestNumber");
CREATE INDEX IF NOT EXISTS "InternalRequest_fromWarehouseId_idx" ON "InternalRequest"("fromWarehouseId");
CREATE INDEX IF NOT EXISTS "InternalRequest_toWarehouseId_idx" ON "InternalRequest"("toWarehouseId");
CREATE INDEX IF NOT EXISTS "InternalRequest_status_idx" ON "InternalRequest"("status");
CREATE INDEX IF NOT EXISTS "InternalRequest_createdAt_idx" ON "InternalRequest"("createdAt");

CREATE INDEX IF NOT EXISTS "InternalRequestLine_requestId_idx" ON "InternalRequestLine"("requestId");
CREATE INDEX IF NOT EXISTS "InternalRequestLine_itemId_idx" ON "InternalRequestLine"("itemId");
CREATE INDEX IF NOT EXISTS "InternalRequestLine_status_idx" ON "InternalRequestLine"("status");
CREATE INDEX IF NOT EXISTS "InternalRequestLine_status_createdAt_idx" ON "InternalRequestLine"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "InternalRequestLine_reservationId_idx" ON "InternalRequestLine"("reservationId");

DO $$ BEGIN
  ALTER TABLE "InternalRequest"
    ADD CONSTRAINT "InternalRequest_fromWarehouseId_fkey"
    FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InternalRequest"
    ADD CONSTRAINT "InternalRequest_toWarehouseId_fkey"
    FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InternalRequestLine"
    ADD CONSTRAINT "InternalRequestLine_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "InternalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InternalRequestLine"
    ADD CONSTRAINT "InternalRequestLine_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InternalRequestLine"
    ADD CONSTRAINT "InternalRequestLine_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "StockReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Warehouse" ADD COLUMN IF NOT EXISTS "responsibleEmail" TEXT;
CREATE INDEX IF NOT EXISTS "Warehouse_responsibleEmail_idx" ON "Warehouse"("responsibleEmail");

CREATE TABLE IF NOT EXISTS "WmsProjectSettings" (
  "id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WmsProjectSettings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WmsProjectSettings_updatedAt_idx" ON "WmsProjectSettings"("updatedAt");
