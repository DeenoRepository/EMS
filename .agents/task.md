# WMS Automatic MOL/Warehouses Autofill & Seed Tasks

## 1. Database & Seed (`postgres-prisma-engineer`)
- [ ] Create `prisma/seed.ts` script populating warehouses, storage cells, initial WMS items, movements, and personal cards.
- [ ] Configure `package.json` with `"prisma": { "seed": "ts-node prisma/seed.ts" }` script.

## 2. Backend & API Services (`backend-api-architect`)
- [ ] Update `/api/modules/wms/warehouses` to return active warehouses and their assigned MOLs.
- [ ] Ensure automatic warehouse/MOL selection based on operation direction (incoming/outgoing/transfers).

## 3. Frontend Architecture (`nextjs-frontend-architect`)
- [ ] Update WMS modal forms (`transfers/page.tsx`, `personal-cards/page.tsx`, `page.tsx`) to auto-populate warehouses and assigned MOLs without manual typing.

## 4. Quality Assurance & Verification (`qa-code-reviewer`)
- [ ] Execute `npx prisma db seed` (or `npx ts-node prisma/seed.ts`) to verify seeding.
- [ ] Run `npx tsc --noEmit` type checking.
- [ ] Run `npx next build` production build verification.







