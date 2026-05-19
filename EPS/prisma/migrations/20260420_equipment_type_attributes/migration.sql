-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN "customAttributes" JSONB;

-- CreateTable
CREATE TABLE "EquipmentTypeAttribute" (
    "id" TEXT NOT NULL,
    "typeValue" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'TEXT',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentTypeAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentTypeAttribute_typeValue_key_key" ON "EquipmentTypeAttribute"("typeValue", "key");

-- CreateIndex
CREATE INDEX "EquipmentTypeAttribute_typeValue_isActive_sortOrder_idx" ON "EquipmentTypeAttribute"("typeValue", "isActive", "sortOrder");
