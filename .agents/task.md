# Задачи по устранению дефектов аудита модулей EMS

## Фаза 1: Исправление критических дефектов целостности данных (P0)
- [x] Fix Transfer APPROVE: оприходование ТМЦ на склад-получатель при трансфере (`src/app/api/modules/wms/transfers/route.ts`)
- [x] Fix Race condition в WMS movements: атомарная проверка остатков и транзакционная выемка (`src/app/api/modules/wms/movements/route.ts`)
- [x] Fix Write-Off validation: запрет списания свыше свободно доступного остатка (`quantity - reservedQuantity`) (`src/app/api/modules/wms/write-offs/route.ts`)
- [x] Fix Personal Cards Return: создание WmsWriteOff при возврате неисправных СИЗ/ТМЦ (`src/app/api/modules/wms/personal-cards/route.ts`)

## Фаза 2: Исправление персистентности и хранилищ данных (P1)
- [ ] Миграция EPS Approvals с in-memory на модель `ApprovalRequest` в Prisma (`src/app/api/modules/eps/approvals/route.ts`)
- [ ] Миграция Audit Logs с `auditLogMemory` на модель `AuditLog` в Prisma (`src/app/api/admin/audit/route.ts`, `src/lib/telemetry/logger.ts`)
- [ ] Управление MOCK fallback в EPS: логирование ошибок вместо тихой записи в RAM (`src/app/api/modules/eps/equipment/[id]/route.ts`, `src/app/api/modules/eps/documents/route.ts`)

## Фаза 3: Исправление аутентификации и RBAC (P2)
- [x] Fix Edge Runtime error in `src/lib/auth/token-blacklist.ts`: замена неуправляемого `require("crypto")` на safe try-catch с pure JS fallback для Next.js Middleware (assigned to `backend-api-architect`)
- [ ] Добавить `getSession()` проверки на публичные endpoints EPS (`src/app/api/modules/eps/equipment/route.ts`, `src/app/api/modules/eps/documents/route.ts`, `src/app/api/modules/eps/approval-queue/count/route.ts`)

## Фаза 4: Улучшение бизнес-логики и CRUD функций (P3)
- [ ] Добавить валидацию переходов статусов в Requisitions (`src/app/api/modules/wms/requisitions/route.ts`)
- [ ] Добавить создание `EquipmentVersion` и `EquipmentEvent` при создании оборудования (`src/app/api/modules/eps/equipment/route.ts`)

## Фаза 6: Эпик "Конструктор ролей для RBAC в Настройках"
- [x] **`postgres-prisma-engineer`**: Изменение `prisma/schema.prisma` и расширение `prisma/seed.ts`
- [x] **`backend-api-architect`**: Создание реестра `permissions-registry.ts` и эндпоинтов `/api/admin/roles`
- [x] **`nextjs-frontend-architect`**: Консоль в `src/app/admin/rbac/page.tsx` и `RoleConstructorModal`
- [x] **`qa-code-reviewer`**: Прогон миграций, сборка и верификация

## Фаза 7: Переработка страницы Настроек Shell (`/admin/settings`)
- [x] **`backend-api-architect`**: API настроек `/api/admin/settings`
- [x] **`nextjs-frontend-architect`**: Настройки Shell `src/app/admin/settings/page.tsx`
- [x] **`qa-code-reviewer`**: Проверка типов и сборка

## Фаза 9: Единый стилистический дизайн Shell, Настроек и Аудита
- [ ] **`nextjs-frontend-architect`**: Пересмотр дизайна Настроек Shell (`src/app/admin/settings/page.tsx`), Настроек модулей (`src/app/admin/settings/[moduleId]/page.tsx`) и Страницы аудита (`src/app/admin/audit/page.tsx`) в едином стиле корпоративного шелла
- [ ] **`qa-code-reviewer`**: Проверка сборки и типов `npm run typecheck`

## Фаза 10: Архитектурная модернизация WMS под динамические изменения EMS
- [x] **`postgres-prisma-engineer`**: Обновление `prisma/schema.prisma` (реляционная нормализация `WmsItem` с `warehouseId`, `zoneId`, `cellId`, добавление `WmsOutboxEvent`, связь с `Equipment`) и генерация Prisma Client
- [x] **`backend-api-architect`**: Реализация Transactional Outbox обработчика (`src/lib/wms/outbox-processor.ts`), интеграция с `ShellEventBus`, создание эндпоинта `/api/modules/wms/outbox/process`
- [x] **`security-auditor`**: Интеграция `RoleScope.allowedWarehouses` и `WarehouseKeeper` в `src/lib/auth/wms-rbac.ts` для проверки нормализованных полей складов
- [x] **`backend-api-architect`**: Обновление API WMS эндпоинтов (`items`, `movements`, `transfers`, `write-offs`, `requisitions`) для транзакционной работы с `WmsOutboxEvent` и нормализованной топологией складов
- [x] **`nextjs-frontend-architect`**: Обновление хуков `use-wms-catalog.ts`, `use-wms-topology.ts` и компонентов UI WMS для работы с нормализованной топологией складов и ячеек
- [x] **`qa-code-reviewer`**: Проверка типов `npm run typecheck`, запуск тестов идемпотентности WMS и верификация сборки

## Фаза 11: Улучшение всех модальных окон модуля WMS (Полный охват компонентов и страниц)
- [x] **`nextjs-frontend-architect`**: Внедрение утилит валидации, Dirty Check и каскадной топологии в `src/components/wms/modals/wms-modal-utils.ts`
- [x] **`nextjs-frontend-architect`**: Модернизация `CreateItemModal` (`src/components/wms/modals/create-item-modal.tsx`) — табированный UI (Tabs), каскадный выбор зон/ячеек, Dirty Check, Toast
- [x] **`nextjs-frontend-architect`**: Модернизация `EditItemModal` (`src/components/wms/modals/edit-item-modal.tsx`) — табированный UI (Tabs), авто-синхронизация данных, Dirty Check
- [x] **`nextjs-frontend-architect`**: Модернизация `RequisitionModal` (`src/components/wms/modals/requisition-modal.tsx`) — Stepper мастер (Склады $\rightarrow$ ТМЦ $\rightarrow$ Итог), остатки, Dirty Check
- [x] **`nextjs-frontend-architect`**: Модернизация `TransferModal` (`src/components/wms/modals/transfer-modal.tsx`) — Stepper мастер (Откуда/Куда $\rightarrow$ Позиции $\rightarrow$ Итог), контроль остатка ячеек, заглушка сканера
- [x] **`nextjs-frontend-architect`**: Модернизация `WriteOffModal` (`src/components/wms/modals/write-off-modal.tsx`) — Stepper/подтверждение списания, контроль остатка, заглушка сканера
- [x] **`nextjs-frontend-architect`**: Модернизация `PersonalCardModal` (`src/components/wms/modals/personal-card-modal.tsx`) — карточка выдачи, проверка норм и остатков
- [x] **`nextjs-frontend-architect`**: Создание `ItemCardDetailsModal` (`src/components/wms/modals/item-card-details-modal.tsx`) — табированный просмотр складской карточки ТМЦ
- [x] **`nextjs-frontend-architect`**: Создание `AddCellModal` (`src/components/wms/modals/add-cell-modal.tsx`) — добавление ячеек топологии с выбором склада и зоны
- [x] **`nextjs-frontend-architect`**: Создание `ReturnPersonalItemModal` & `EmployeeDirectoryModal` (`src/components/wms/modals/personal-card-actions-modal.tsx`) — возврат СИЗ, реестр МОЛ и добавление сотрудника
- [x] **`nextjs-frontend-architect`**: Модернизация `BarcodeLabelModal` (`src/components/wms/barcode-label-modal.tsx`) — формат печатных этикеток (58x40, 40x30), пресеты, QR/BarCode
- [x] **`nextjs-frontend-architect`**: Связывание модернизированных компонентов со всеми страницами (`src/app/modules/wms/page.tsx`, `topology/page.tsx`, `requisitions/page.tsx`, `personal-cards/page.tsx`)
- [x] **`qa-code-reviewer`**: Проверка типов `npm run typecheck`, сборка и финальная верификация

## Фаза 12: Очистка неиспользуемых файлов и артефактов проекта
- [x] **`backend-api-architect`**: Удаление `.playwright-mcp/`, `ems-production-audit.html`, `CLAUDE.md`, `prisma/seed-eps.ts`, `prisma/verify-seed.ts` и очистка `package.json`

## Фаза 13: Модернизация корпоративного Shell (RBAC Scope Guard, EventBus SSE, UI Slots Host, Circuit Breaker)
- [x] **`backend-api-architect`**: Обновление `src/lib/shell/event-bus.ts` (поддержка SSE/вебхуков) и эндпоинта `/api/shell/events/sse/route.ts`
- [x] **`security-auditor`**: Валидация RBAC Scope Guard утилит в `src/lib/auth/rbac.ts` и `src/lib/auth/wms-rbac.ts`
- [x] **`nextjs-frontend-architect`**: Создание UI Slot Host компонентов `src/components/layout/ui-slot-host.tsx` и `src/components/layout/module-status-badge.tsx`
- [x] **`nextjs-frontend-architect`**: Модернизация `src/components/layout/shell-context.tsx`, `app-sidebar.tsx` и `top-bar.tsx`
- [x] **`qa-code-reviewer`**: Проверка типов и верификация внедрения новых компонентов Shell
