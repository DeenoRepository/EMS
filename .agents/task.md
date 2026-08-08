# WMS Pages & Navigation Optimization Tasks

## 1. Frontend Architecture (`nextjs-frontend-architect`)
- [ ] Consolidate `/modules/wms/movements/page.tsx` with `TabNav` component into 3 tabs: Movements History, MOL Transfers, Personal Cards.
- [ ] Update `src/lib/config/nav.ts` and `AppSidebar` to only render 2 WMS entries.
- [ ] Delete obsolete page directories (`items/`, `warehouses/`, `transfers/`, `personal-cards/`).

## 2. Quality Assurance & Verification (`qa-code-reviewer`)
- [ ] Run `npx tsc --noEmit` type checking.
- [ ] Run `npx next build` production build verification.











