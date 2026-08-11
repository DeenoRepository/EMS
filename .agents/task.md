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
- [ ] Добавить API отмены/снятия резервов в WMS Reservations (`src/app/api/modules/wms/reservations/route.ts`)
- [ ] Добавить создание `EquipmentVersion` и `EquipmentEvent` при создании оборудования (`src/app/api/modules/eps/equipment/route.ts`)

## Фаза 6: Эпик "Конструктор ролей для RBAC в Настройках"
- [x] **`postgres-prisma-engineer`**: Изменение `prisma/schema.prisma` (модели `Role`, `Permission`, `RolePermission`, `RoleScope`) и расширение `prisma/seed.ts`
- [x] **`backend-api-architect`**: Создание реестра `src/lib/auth/permissions-registry.ts`, обновление `rbac.ts`, `authorization-matrix.ts` и эндпоинтов `/api/admin/roles`, `/api/admin/permissions`
- [x] **`nextjs-frontend-architect`**: Реализация двухвкладочной консоли в `src/app/admin/rbac/page.tsx` и компонента `src/components/admin/role-constructor-modal.tsx`
- [x] **`qa-code-reviewer`**: Прогон миграций/сидирования, проверочная сборка `npm run build` и верификация в Docker контейнерах

## Фаза 7: Переработка страницы Настроек Shell и Приложения (`/admin/settings`)
- [x] **`backend-api-architect`**: Создать `src/app/api/admin/settings/route.ts` (GET / POST API настроек Shell: заголовок платформы, часовой пояс, язык, тема, баннеры обслуживания, безопасность сессий, лимиты хранилища S3/локального, реестр модулей EPS/WMS)
- [x] **`nextjs-frontend-architect`**: Полностью переработать `src/app/admin/settings/page.tsx` с нуля (Общие настройки Shell, Оформление/Брендинг, Уведомления, Безопасность, Хранилище, Реестр модулей)
- [x] **`qa-code-reviewer`**: Проверка типов `npm run typecheck` и сборка `npm run build`




## Фаза 5: Верификация и QA
- [x] Проверить сборку `npm run build`
- [x] Проверить работу авторизации в Docker контейнерах (`ems-app`)

