# EMS Monorepo (EPS + MMS + WMS + SRS)

## Структура
- `EPS` — паспортизация оборудования
- `MMS` — техническое обслуживание и ремонт
- `WMS` — управление складом
- `SRS` — аналитика, отчёты, импорт (DEA Web)

Все модули собраны в одной корневой папке `EMS` и запускаются единым `docker-compose.yml`.

## Запуск всего стека
```powershell
cd C:\Users\Deeno\Documents\Projects\EMS
docker compose up -d --build
docker compose ps
```

## Остановка
```powershell
docker compose down
```

## Адреса модулей (напрямую)
- EPS: `http://localhost:3210`
- MMS: `http://localhost:3201`
- WMS: `http://localhost:3202`
- SRS: `http://localhost:3203`

## Gateway (nginx)
- Единая точка входа: `http://localhost:8090`
- UI:
  - `http://localhost:8090/eps`
  - `http://localhost:8090/mms`
  - `http://localhost:8090/wms`
  - `http://localhost:8090/srs`
- API:
  - `http://localhost:8090/api/eps/...`
  - `http://localhost:8090/api/mms/...`
  - `http://localhost:8090/api/wms/...`
  - `http://localhost:8090/api/srs/...`

## Что было очищено
- Исключены артефакты сборки из копий модулей: `.next`, `node_modules`.
- Удалены локальные дублирующие docker-compose/env-docker/nginx-конфиги внутри `MMS` и `WMS`.
- Оставлен единый запуск только через `EMS/docker-compose.yml`.

