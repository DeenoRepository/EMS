-- CreateEnum
CREATE TYPE "ReferenceEntityType" AS ENUM ('EQUIPMENT');

-- CreateTable
CREATE TABLE "ReferenceField" (
    "id" TEXT NOT NULL,
    "entityType" "ReferenceEntityType" NOT NULL DEFAULT 'EQUIPMENT',
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceValue" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceField_entityType_key_key" ON "ReferenceField"("entityType", "key");

-- CreateIndex
CREATE INDEX "ReferenceField_entityType_isActive_sortOrder_idx" ON "ReferenceField"("entityType", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceValue_fieldId_value_key" ON "ReferenceValue"("fieldId", "value");

-- CreateIndex
CREATE INDEX "ReferenceValue_fieldId_isActive_sortOrder_idx" ON "ReferenceValue"("fieldId", "isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "ReferenceValue" ADD CONSTRAINT "ReferenceValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "ReferenceField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
