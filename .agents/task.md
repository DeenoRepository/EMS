# Full Manual Testing Plan (EMS Project)

## Tasks Breakdown & Subagent Assignment

- [x] **Task 1: QA Verification & Build/Type Checks** (`qa-code-reviewer`)
  - [x] Run `npx tsc --noEmit`: 0 TypeScript errors.
  - [x] Next.js dev server status: operational on `http://localhost:3000`.

- [x] **Task 2: API & Backend Endpoint Audit & Verification** (`qa-code-reviewer`)
  - [x] Verified session routing and authentication flow (`/login` -> `/`).
  - [x] Quick mock profile authentication (ADMIN, EDITOR, APPROVER, VIEWER) functional.

- [x] **Task 3: UI & End-to-End Functional Flow Testing** (`qa-code-reviewer`)
  - [x] Main Dashboard (`/`): UI components loaded, module directory table rendered correctly.
  - [x] EPS Module (`/modules/eps`): Equipment table, status badges, filters, search bar fully operational.
  - [x] WMS Module (`/modules/wms`): TMC inventory list, warehouse indicators, stock alerts rendered cleanly.
  - [x] Zero browser console errors detected during live Playwright testing.

- [x] **Task 4: Fix EPS Equipment Detail Version Display (`vNaN` fallback)** (`nextjs-frontend-architect`)
  - [x] Updated `src/app/modules/eps/[id]/page.tsx` line 257 & line 280 to use `item.version ?? 1` fallback.
  - [x] Verified live in browser: button now displays `Редактировать (v2)` and header displays `Версия v1`.

- [x] **Task 5: Settings & Administration Pages Manual QA Audit** (`qa-code-reviewer`)
  - [x] `/admin/settings/eps`: Tab switching (Общие параметры, Конструктор атрибутов, Формирование справочников) tested and working cleanly.
  - [x] `/admin/settings/eps/attributes`: Dynamic attributes table renders all equipment technical characteristics correctly.
  - [x] `/admin/settings/eps/references`: Reference fields dictionary management (Department, Manufacturer) tested.
  - [x] `/admin/rbac`: Role-Based Access Control matrix and permissions controls fully functional.
  - [x] `/admin/audit`: Security audit log page renders without console warnings or layout bugs.
