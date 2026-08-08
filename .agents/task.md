# Task Decomposition & Subagent Delegation: WMS Employee Directory Roster

## 1. Database & ORM Agent (`postgres-prisma-engineer`)
- [x] Add `WmsEmployee` model in `prisma/schema.prisma` (`id`, `name`, `employeeNumber`, `position`, `department`, `warehouse`, `isActive`).
- [x] Run `npx prisma generate` to rebuild Prisma Client types.

## 2. Backend & Business Logic Agent (`backend-api-architect`)
- [x] Create API route handler `src/app/api/modules/wms/employees/route.ts`:
  - `GET /api/modules/wms/employees`: Fetch employee directory roster.
  - `POST /api/modules/wms/employees`: Register/update employee in warehouse roster.

## 3. Frontend Architect Agent (`nextjs-frontend-architect`)
- [x] Update `src/app/modules/wms/personal-cards/page.tsx`:
  - Added **«Справочник сотрудников»** modal and roster management.
  - Integrated employee selection dropdown in **«Выдать сотруднику»** modal with auto-filling (ФИО, Табельный номер, Должность, Подразделение).
  - Added checkbox **«Сохранить/Обновить сотрудника в Справочнике склада»**.

## 4. Code Review & QA Agent (`qa-code-reviewer`)
- [x] Run `npx tsc --noEmit` (PASS: 0 errors).
- [x] Run `npm run build` (PASS: All 57/57 static & dynamic routes compiled successfully).
