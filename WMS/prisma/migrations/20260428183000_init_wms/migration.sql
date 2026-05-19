-- CreateEnum
CREATE TYPE "RoleKey" AS ENUM ('VIEWER', 'EDITOR', 'APPROVER', 'ADMIN');
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT', 'INTEGRATION');
CREATE TYPE "WarehouseStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "StockItemStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT', 'RESERVATION', 'RESERVATION_CANCEL');
CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVE', 'ISSUED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "adExternalId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "key" "RoleKey" NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRole" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId", "roleId")
);

CREATE TABLE "Warehouse" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "status" "WarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockLocation" (
  "id" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockItem" (
  "id" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "unit" TEXT NOT NULL,
  "minQuantity" DECIMAL(14,3),
  "status" "StockItemStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockBalance" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "locationId" TEXT,
  "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "reservedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockReservation" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "locationId" TEXT,
  "mmsWorkOrderId" TEXT NOT NULL,
  "mmsRequiredPartId" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "status" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "locationId" TEXT,
  "toWarehouseId" TEXT,
  "toLocationId" TEXT,
  "movementType" "StockMovementType" NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "relatedMmsWorkOrderId" TEXT,
  "relatedMmsRequiredPartId" TEXT,
  "reservationId" TEXT,
  "comment" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "action" "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "beforeState" JSONB,
  "afterState" JSONB,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_adExternalId_key" ON "User"("adExternalId");
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");
CREATE INDEX "Warehouse_status_idx" ON "Warehouse"("status");
CREATE INDEX "Warehouse_createdAt_idx" ON "Warehouse"("createdAt");

CREATE UNIQUE INDEX "StockLocation_warehouseId_code_key" ON "StockLocation"("warehouseId", "code");
CREATE INDEX "StockLocation_warehouseId_idx" ON "StockLocation"("warehouseId");
CREATE INDEX "StockLocation_createdAt_idx" ON "StockLocation"("createdAt");

CREATE UNIQUE INDEX "StockItem_sku_key" ON "StockItem"("sku");
CREATE INDEX "StockItem_status_idx" ON "StockItem"("status");
CREATE INDEX "StockItem_category_idx" ON "StockItem"("category");
CREATE INDEX "StockItem_createdAt_idx" ON "StockItem"("createdAt");

CREATE UNIQUE INDEX "StockBalance_itemId_warehouseId_locationId_key" ON "StockBalance"("itemId", "warehouseId", "locationId");
CREATE INDEX "StockBalance_itemId_idx" ON "StockBalance"("itemId");
CREATE INDEX "StockBalance_warehouseId_idx" ON "StockBalance"("warehouseId");
CREATE INDEX "StockBalance_locationId_idx" ON "StockBalance"("locationId");
CREATE INDEX "StockBalance_createdAt_idx" ON "StockBalance"("createdAt");

CREATE INDEX "StockReservation_itemId_idx" ON "StockReservation"("itemId");
CREATE INDEX "StockReservation_warehouseId_idx" ON "StockReservation"("warehouseId");
CREATE INDEX "StockReservation_locationId_idx" ON "StockReservation"("locationId");
CREATE INDEX "StockReservation_status_idx" ON "StockReservation"("status");
CREATE INDEX "StockReservation_mmsWorkOrderId_idx" ON "StockReservation"("mmsWorkOrderId");
CREATE INDEX "StockReservation_mmsRequiredPartId_idx" ON "StockReservation"("mmsRequiredPartId");
CREATE INDEX "StockReservation_createdAt_idx" ON "StockReservation"("createdAt");

CREATE INDEX "StockMovement_itemId_idx" ON "StockMovement"("itemId");
CREATE INDEX "StockMovement_warehouseId_idx" ON "StockMovement"("warehouseId");
CREATE INDEX "StockMovement_locationId_idx" ON "StockMovement"("locationId");
CREATE INDEX "StockMovement_movementType_idx" ON "StockMovement"("movementType");
CREATE INDEX "StockMovement_relatedMmsWorkOrderId_idx" ON "StockMovement"("relatedMmsWorkOrderId");
CREATE INDEX "StockMovement_relatedMmsRequiredPartId_idx" ON "StockMovement"("relatedMmsRequiredPartId");
CREATE INDEX "StockMovement_reservationId_idx" ON "StockMovement"("reservationId");
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Foreign keys
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "StockReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
