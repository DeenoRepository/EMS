# Task Decomposition: Automatic Nomenclature Item Integration on Receiving (Приход ТМЦ)

## 1. Database & ORM Agent (`postgres-prisma-engineer`)
- [x] Verify `WmsItem` model in `prisma/schema.prisma` (`sku`, `name`, `category`, `unit`, `unitPrice`, `minQuantity`, `warehouse`, `quantity`).

## 2. Backend & Business Logic Agent (`backend-api-architect`)
- [ ] Enhance `src/app/api/modules/wms/items/route.ts`:
  - When `POST` receiving an item, search by `sku` or `id`.
  - If existing nomenclature found: increase stock quantity (`quantity += newQty`) and update cell/price.
  - If new nomenclature: create new `WmsItem` record in master catalog.

## 3. Frontend Architect Agent (`nextjs-frontend-architect`)
- [ ] Update `src/app/modules/wms/movements/page.tsx`:
  - In Receiving modal rows, add a dropdown/autocomplete selector: **«Выберите существующую номенклатуру или введите новую»**.
  - Auto-fill **Наименование**, **Артикул SKU**, **Категорию**, **Единицу измерения**, **Базовую цену** when an existing nomenclature item is selected.
  - Show a clear indicator tag: **«Существующая номенклатура»** or **«Новая номенклатурная единица»**.

## 4. Code Review & QA Agent (`qa-code-reviewer`)
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
