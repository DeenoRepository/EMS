# Task Decomposition: WMS Address Storage Topology Page Styling Alignment

## 1. Frontend Architect Agent (`nextjs-frontend-architect`)
- [ ] Inspect `src/app/modules/wms/topology/page.tsx`.
- [ ] Refactor UI to align strictly with standard EMS design system:
  - Add `ShellLayout` wrapper.
  - Use `PageHeader` (title "Адресный учет & Топология складов", description, breadcrumbs, actions).
  - Add `KpiGrid` with stats (Всего складских зон, Ячеек хранения, Заполненность ячеек %, Свободная емкость).
  - Use `FilterToolbar` (Search by cell/zone code, filter by warehouse).
  - Use `DataTable` for structured zones & cells list with status badges (`COMPACT`, `EMPTY`, `FULL`).
  - Standardize modals (`Modal`, `ModalHeader`) for creating new zones and cells.

## 2. Backend & Business Logic Agent (`backend-api-architect`)
- [ ] Verify `src/app/api/modules/wms/bins/route.ts` API endpoints for zones and cells.

## 3. Code Review & QA Agent (`qa-code-reviewer`)
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
