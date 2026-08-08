# Task Decomposition: Editing TMC Item Position & Details (Редактирование позиции ТМЦ)

## 1. Backend & Business Logic Agent (`backend-api-architect`)
- [x] Create `src/app/api/modules/wms/items/[id]/route.ts`:
  - `PUT` handler to update TMC item details (`name`, `sku`, `category`, `type`, `unit`, `warehouse`, `zone`, `cell`, `quantity`, `minQuantity`, `maxQuantity`, `unitPrice`, `supplier`, `batchNumber`, `serialNumber`, `description`).
  - RBAC verification via `getUserResponsibleWarehouses()`.
  - Log `WmsMovement` adjustment if cell/zone/warehouse or quantity changed.

## 2. Frontend Architect Agent (`nextjs-frontend-architect`)
- [x] Update `src/app/modules/wms/page.tsx`:
  - Add "Редактировать" action button to TMC row actions.
  - Implement `EditItemModal` pre-populated with TMC item details.
  - Submit form to `PUT /api/modules/wms/items/[id]` and update local catalog state.

## 3. Code Review & QA Agent (`qa-code-reviewer`)
- [x] Run `npx tsc --noEmit` and build verification. Verified pass.
