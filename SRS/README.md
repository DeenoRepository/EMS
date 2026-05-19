# SRS (Analytics & Reports)

Модуль аналитики, отчётов и импорта данных в составе EMS:
- Next.js (App Router, TypeScript)
- PostgreSQL + Prisma
- Интеграция с EPS/MMS/WMS через общий nginx gateway

## Быстрый старт

1. Создать `.env` из `.env.example`.
2. Установить зависимости:
   - `npm run prisma:generate`
3. Локальная разработка:
   - `npm run dev`

## Docker (в составе EMS)

1. `cd C:\Users\Deeno\Documents\Projects\Cache\EMS`
2. `docker compose up -d --build`
3. SRS доступно на `http://localhost:3203` или `http://localhost:8090/srs`

## Что уже реализовано

- Каркас UI (sidebar + страницы модулей).
- Prisma схема по основным сущностям из ТЗ.
- API-заготовки:
  - `GET /api/health`
  - `GET /api/analytics/dashboard`
  - `GET /api/analytics/heatmap`
  - `GET/PUT /api/settings/jira`
  - `GET/PUT /api/settings/heatmap`
  - `POST /api/import/xml`
  - `POST /api/import/jira`
  - `POST /api/reports/html`
  - `GET /api/reports/:id`

## Следующий этап

- Реальные пайплайны XML/Jira импорта.
- RBAC и аутентификация.
- Полноценные heatmap/timeline/отчёты.
