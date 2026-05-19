-- Add explicit warehouse type flag (primary/auxiliary)
CREATE TYPE "WarehouseType" AS ENUM ('PRIMARY', 'AUXILIARY');

ALTER TABLE "Warehouse"
  ADD COLUMN "type" "WarehouseType" NOT NULL DEFAULT 'AUXILIARY';

CREATE INDEX "Warehouse_type_idx" ON "Warehouse"("type");
