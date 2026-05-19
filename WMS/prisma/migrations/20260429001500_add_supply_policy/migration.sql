CREATE TYPE "SupplyPolicy" AS ENUM ('CENTRAL_ISSUE', 'DISTRIBUTED_CONSUMABLE');

ALTER TABLE "StockItem"
  ADD COLUMN "supplyPolicy" "SupplyPolicy" NOT NULL DEFAULT 'DISTRIBUTED_CONSUMABLE';

CREATE INDEX "StockItem_supplyPolicy_idx" ON "StockItem"("supplyPolicy");
