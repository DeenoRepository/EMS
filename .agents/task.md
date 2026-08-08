# Admin Settings & WMS Warehouse Management Tasks

## 1. Frontend Architecture (`nextjs-frontend-architect`)
- [ ] Add "Управление Складами & Назначение МОЛ" section to Shell Global Settings (`src/app/admin/settings/page.tsx`).
- [ ] Allow Administrators to create warehouses, assign MOL (responsible users), and configure storage cells.
- [ ] Remove administrative warehouse creation controls from `/modules/wms/warehouses` for non-admin operational view.

## 2. Backend & Business Logic (`backend-api-architect`)
- [ ] Verify RBAC protection on POST `/api/modules/wms/warehouses` (ADMIN role required to create warehouses and assign MOL).

## 3. QA & Verification (`qa-code-reviewer`)
- [ ] Run `npx tsc --noEmit` type checking.
- [ ] Run `npx next build` production build verification.



