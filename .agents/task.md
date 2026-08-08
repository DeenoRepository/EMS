# Full Manual Testing Plan (EMS Project)



## Tasks Breakdown & Subagent Assignment

- [x] **Task 1: QA Verification & Build/Type Checks** (`qa-code-reviewer`)
  - [x] Run `npx tsc --noEmit`: 0 TypeScript errors.

- [x] **Task 8: Fix Security Vulnerabilities (SEC-01 to SEC-09)** (`security-auditor` / `backend-api-architect`)
  - [x] SEC-01: Add RBAC auth checks to `/api/admin/audit`, `/api/admin/warehouses`, `/api/admin/facilities`.
  - [x] SEC-02: Add session & RBAC protection + audit logging to `GET /api/modules/eps/equipment/export`.
  - [x] SEC-03: Sanitize error output in `POST /api/auth/login`.
  - [x] SEC-04: Add env check & fallback handling for `SERVICE_JWT_SECRET`.
  - [x] SEC-05 & SEC-06: Add session & permission checks to `/api/modules/eps/equipment/[id]`.
  - [x] SEC-07: Add session guard to `/api/modules/wms/requisitions/count`.
  - [x] SEC-08: Add session guard to `/api/modules/registry`.
  - [x] SEC-09: Add explicit session guard to `PUT /api/modules/wms/items/[id]`.

- [x] **Task 9: Fix Database & Data Integrity Issues (DATA-01 to DATA-07)** (`postgres-prisma-engineer`)
  - [x] DATA-01: Update Prisma schema for `WmsItem.sku` from `@unique` to `@@unique([sku, warehouse])`.
  - [x] DATA-02: Fix `WmsMovement.itemId` creation in `POST /api/modules/wms/items` to use `createdItem.id`.
  - [x] DATA-04: Deduct/deactivate `reservedQuantity` on `OUTGOING` movements.
  - [x] DATA-06: Add missing fields (`criticality`, `countryOfOrigin`, `isImported`, `isUnique`) to `Equipment` in `schema.prisma`.

- [x] **Task 10: Fix Code Quality & Logic Flaws (CODE-01 to CODE-05)** (`backend-api-architect`)
  - [x] CODE-03: Fix double `request.json()` read stream crash in `/api/modules/eps/equipment/[id]`.
  - [x] CODE-04 & CODE-05: Replace hardcoded `"Кладовщик"` with `session.displayName || session.username`.

- [x] **Task 11: Fix Infrastructure & Configuration Issues (INFRA-04, INFRA-05)** (`backend-api-architect`)
  - [x] INFRA-05: Add `.playwright-mcp` to `.gitignore`.

- [x] **Task 13: Fix Security Audit Vulnerabilities (CRIT-01, CRIT-02, HIGH-01, HIGH-03, HIGH-05)**
  - [x] CRIT-01: Add authentication checks to `/api/files/download` and `/api/files/preview`.
  - [x] CRIT-02: Add session guard to GET handlers in WMS routes (`movements`, `write-offs`).
  - [x] HIGH-01: Remove `provider` disclosure in `POST /api/auth/login`.
  - [x] HIGH-03: Enforce strict `JWT_SECRET` requirement in `session.ts`.
  - [x] HIGH-05: Protect Reference API routes (`/api/reference/fields`, `/api/reference/values`) with session & admin role checks.

