# WMS Pages & Navigation Optimization Tasks

## 1. Frontend Architecture (`nextjs-frontend-architect`)
- [x] Consolidate `/modules/wms/movements/page.tsx` with `TabNav` component into 3 tabs: Movements History, MOL Transfers, Personal Cards.
- [x] Update `src/lib/config/nav.ts` and `AppSidebar` to only render 2 WMS entries.
- [x] Delete obsolete page directories (`items/`, `warehouses/`, `transfers/`, `personal-cards/`).

## 2. Quality Assurance & Verification (`qa-code-reviewer`)
- [x] Run `npx tsc --noEmit` type checking (PASS: 0 errors).
- [x] Run `npx next build` production build verification (PASS: 48/48 routes built).












