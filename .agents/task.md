# WMS Module Implementation Tasks

## 1. Database & Schema Alignment (`postgres-prisma-engineer`)
- [x] Verify `prisma/schema.prisma` models: `Warehouse`, `StorageCell`, `WmsItem`, `WmsMovement`, `WmsTransferRequest`.
- [x] Ensure DB indexes and relational cascades are intact.

## 2. Backend API Services (`backend-api-architect`)
- [x] Implement WMS API endpoints under `src/app/api/modules/wms/`:
  - `warehouses/route.ts` (List & create warehouses/cells)
  - `items/route.ts` (List, search, filter, and create WMS items)
  - `movements/route.ts` (Incoming, Outgoing/Equipment write-off, Transfers)

## 3. Frontend Pages & Standard UI Integration (`nextjs-frontend-architect`)
- [x] Update `src/lib/config/modules.ts` and `src/lib/config/nav.ts` to register WMS in sidebar.
- [x] Build WMS module UI pages under `src/app/modules/wms/`:
  - `page.tsx` (Dashboard & Stock overview with UI charts)
  - `items/page.tsx` (Stock items catalog table)
  - `warehouses/page.tsx` (Warehouses & cells management)
  - `movements/page.tsx` (Movement history & EPS equipment write-off form)

## 4. Quality Assurance & Verification (`qa-code-reviewer`)
- [x] Run `npx tsc --noEmit` type checking (PASS: 0 errors).
- [x] Perform `npx next build` production build verification (PASS: 48/48 routes built).

