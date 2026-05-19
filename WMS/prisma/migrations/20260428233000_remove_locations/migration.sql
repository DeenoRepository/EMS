-- Remove locations from WMS domain model

-- Drop FKs from movement/reservation/balance to StockLocation if they exist
ALTER TABLE "StockMovement" DROP CONSTRAINT IF EXISTS "StockMovement_locationId_fkey";
ALTER TABLE "StockMovement" DROP CONSTRAINT IF EXISTS "StockMovement_toLocationId_fkey";
ALTER TABLE "StockReservation" DROP CONSTRAINT IF EXISTS "StockReservation_locationId_fkey";
ALTER TABLE "StockBalance" DROP CONSTRAINT IF EXISTS "StockBalance_locationId_fkey";

-- Drop indexes that include location columns
DROP INDEX IF EXISTS "StockMovement_locationId_idx";
DROP INDEX IF EXISTS "StockReservation_locationId_idx";
DROP INDEX IF EXISTS "StockBalance_locationId_idx";
DROP INDEX IF EXISTS "StockBalance_itemId_warehouseId_locationId_key";

-- Drop location columns
ALTER TABLE "StockMovement" DROP COLUMN IF EXISTS "locationId";
ALTER TABLE "StockMovement" DROP COLUMN IF EXISTS "toLocationId";
ALTER TABLE "StockReservation" DROP COLUMN IF EXISTS "locationId";
ALTER TABLE "StockBalance" DROP COLUMN IF EXISTS "locationId";

-- Re-create unique constraint for balances without location dimension
CREATE UNIQUE INDEX IF NOT EXISTS "StockBalance_itemId_warehouseId_key" ON "StockBalance"("itemId", "warehouseId");

-- Drop StockLocation table and related indexes/constraints
DROP INDEX IF EXISTS "StockLocation_warehouseId_code_key";
DROP INDEX IF EXISTS "StockLocation_warehouseId_idx";
DROP INDEX IF EXISTS "StockLocation_createdAt_idx";
DROP TABLE IF EXISTS "StockLocation";
