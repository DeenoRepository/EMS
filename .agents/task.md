# Task Decomposition: Professional Multi-Item Modals for WMS Operations (Prikhod, Transfer, Write-off)

## 1. Database & ORM Agent (`postgres-prisma-engineer`)
- [x] Verify `prisma/schema.prisma` models `WmsItem`, `WmsMovement`, `WmsWriteOff`, `WmsTransferRequest`.

## 2. Backend & Business Logic Agent (`backend-api-architect`)
- [ ] Update `src/app/api/modules/wms/movements/route.ts`:
  - Support batch atomic transactions (`POST`) accepting an array of movement items for Receiving, Transfers, and Write-offs.
  - Automatically update `WmsItem` stock quantities and insert `WmsMovement` rows in 1 Prisma transaction.

## 3. Frontend Architect Agent (`nextjs-frontend-architect`)
- [ ] Update `src/app/modules/wms/movements/page.tsx`:
  - Refactor **«Оформить Приход»** modal into an interactive multi-item table (+ Добавить позицию, SKU autocomplete, Qty, Storage Cell, Batch/Serial).
  - Refactor **«Переместить ТМЦ»** modal into an interactive multi-item table (From Warehouse, Target Warehouse/MOL, Item list with quantities).
  - Refactor **«Списать ТМЦ»** modal into an interactive multi-item table (Item selection, Qty, Target Equipment / Scrap reason).
  - Professional commercial styling with clean UI elements and total quantity counters.

## 4. Code Review & QA Agent (`qa-code-reviewer`)
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
