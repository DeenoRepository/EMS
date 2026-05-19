# WMS Module

Отдельный модуль склада (`/WMS`) на Next.js + PostgreSQL.
Интеграции с MMS/EPS выполняются только через REST API.

## Что реализовано
- Склады: CRUD (`/api/wms/warehouses`)
- Номенклатура: CRUD + поиск (`/api/wms/items`, `/api/wms/items/search`)
- Остатки: список, по позиции, availability (`/api/wms/balances`, `/api/wms/items/:itemId/*`)
- Движения: приход/выдача/перемещение/корректировка (`/api/wms/movements/*`)
- Резервы под MMS: create/get/cancel/issue/by-work-order (`/api/wms/reservations/*`)
- Аналитика: summary, low-stock, usage-by-item, movements
- Клиент интеграции MMS: `lib/integrations/mms-api-client.ts`

## Бизнес-правила
- Нельзя списать больше доступного остатка.
- Нельзя зарезервировать больше доступного остатка.
- Выдача по резерву уменьшает `quantity` и `reserved_quantity`, резерв переводится в `issued`.
- При недоступности MMS после успешной складской транзакции API возвращает `mms_sync_warning`.

## UI маршруты
- `/wms`
- `/wms/warehouses`
- `/wms/warehouses/new`
- `/wms/warehouses/[id]`
- `/wms/items`
- `/wms/items/new`
- `/wms/items/[id]`
- `/wms/balances`
- `/wms/movements`
- `/wms/reservations`
- `/wms/analytics`

## ENV
См. `.env.example`.
Ключевые переменные:
- `DATABASE_URL`
- `MMS_API_BASE_URL`
- `EPS_API_BASE_URL`
- `NEXT_PUBLIC_APP_NAME=WMS`
- `MMS_TIMEOUT_MS=5000`
- `MMS_RETRIES=2`
- `MMS_RETRY_DELAY_MS=300`

## Запуск в Docker (только WMS)
```powershell
cd C:\Users\Deeno\Documents\Projects\MMS\WMS
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml ps
```

Адреса:
- WMS: `http://localhost:3002`
- WMS API: `http://localhost:3002/api/wms`
- Postgres WMS: `localhost:5436`

Остановка:
```powershell
docker compose -f docker-compose.dev.yml down
```

## Запуск в Docker (EPS + WMS для проверки интеграции)
```powershell
cd C:\Users\Deeno\Documents\Projects\MMS\WMS
docker compose -f docker-compose.full.yml up -d --build
docker compose -f docker-compose.full.yml ps
```

Адреса:
- EPS: `http://localhost:3110`
- EPS API: `http://localhost:3110/api`
- WMS: `http://localhost:3002`
- WMS API: `http://localhost:3002/api/wms`

Остановка:
```powershell
docker compose -f docker-compose.full.yml down
```

## Проверочный сценарий API
1. Создать склад `POST /api/wms/warehouses`
2. Создать позицию `POST /api/wms/items`
3. Выполнить приход `POST /api/wms/movements/receipt`
4. Проверить availability `GET /api/wms/items/:itemId/availability`
5. Создать резерв `POST /api/wms/reservations`
6. Выполнить выдачу по резерву `POST /api/wms/reservations/:id/issue`
7. Проверить журнал движений `GET /api/wms/movements`

## Reliability and release docs
- Freeze policy: `docs/WMS_FREEZE_POLICY.md`
- E2E checklist: `docs/WMS_E2E_CHECKLIST.md`
- Runbook: `docs/WMS_RUNBOOK.md`

Monitoring endpoint:
- `GET /api/wms/integrations/mms/sync-status`

