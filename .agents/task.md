# Task Decomposition: Remove "Выдать сотруднику" from Movements Dropdown Menu

## 1. Frontend Architect Agent (`nextjs-frontend-architect`)
- [ ] Edit `src/app/modules/wms/movements/page.tsx`:
  - Remove the "Выдать сотруднику" option from the `+ Оформить складскую операцию ▾` dropdown menu (since issuance is handled in `/modules/wms/personal-cards`).

## 2. Code Review & QA Agent (`qa-code-reviewer`)
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
