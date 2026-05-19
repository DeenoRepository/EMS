# EMS локальный запуск (EPS + MMS + WMS)

## Что реализовано
- Единый скрипт старта: PostgreSQL (3 БД) + LDAP + запуск всех модулей.
- Таймауты шагов, прогресс, авто-диагностика при зависании.
- Автосид LDAP пользователей/групп.
- Health-check после запуска.
- Preflight-проверка перед запуском.
- Скрипты backup/restore БД.

## Структура
- `EPS`
- `MMS`
- `WMS`
- `scripts`

## Подготовка
```powershell
cd C:\Users\Deeno\Documents\Projects\EMS
copy .env.ems.local.example .env.ems.local
```

## Основные команды
```powershell
npm run preflight   # проверка node/npm + prisma status
npm run up          # полный запуск (infra + install + prisma + app)
npm run up:fast     # быстрый запуск без npm install
npm run health      # проверка /api/health сервисов
npm run down        # остановка сервисов и infra
npm run clean       # очистка артефактов
```

## Адреса
- EPS: http://localhost:3210
- MMS: http://localhost:3201
- WMS: http://localhost:3202
- LDAP: ldap://localhost:3890

## LDAP
Service bind:
- DN: `cn=admin,dc=ems,dc=local`
- Пароль: из `EMS_LDAP_ADMIN_PASSWORD`

Тестовые пользователи (создаются автоматически):
- `admin` / `EMS_LDAP_USER_ADMIN_PASSWORD` (группа `DEPS_Admins`)
- `editor` / `EMS_LDAP_USER_EDITOR_PASSWORD` (группа `DEPS_Editors`)
- `viewer` / `EMS_LDAP_USER_VIEWER_PASSWORD` (группа `DEPS_Viewers`)

## Backup/Restore
```powershell
npm run backup
```
Файлы сохраняются в `backups/`.

Восстановление:
```powershell
npm run restore:wms -- -FilePath C:\path\to\wms-YYYYMMDD-HHmmss.sql
npm run restore:mms -- -FilePath C:\path\to\mms-YYYYMMDD-HHmmss.sql
npm run restore:eps -- -FilePath C:\path\to\eps-YYYYMMDD-HHmmss.sql
```

## Диагностика проблем
1. Если старт завис: `docker compose -f .\scripts\docker-compose.infra.yml ps`
2. Проверить логи контейнеров:
```powershell
docker logs ems-ldap-local --tail=120
docker logs ems-wms-db-local --tail=120
docker logs ems-mms-db-local --tail=120
docker logs ems-eps-db-local --tail=120
```
3. Проверить API:
```powershell
npm run health
```
