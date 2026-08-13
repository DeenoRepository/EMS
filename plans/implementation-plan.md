# 🛠️ План реализации исправлений EMS

> **Дата:** 2026-08-13  
> **Цель:** Устранить все проблемы, выявленные в аудите  
> **Подход:** Поэтапная реализация с приоритизацией по критичности

---

## 📋 Обзор

**Всего проблем:** 30+  
**Фаз реализации:** 5  
**Критических (P0):** 10 — блокируют релиз  
**Высокого приоритета (P1):** 7  
**Среднего приоритета (P2):** 10+  
**Низкого приоритета (P3):** 5+

---

## 🚨 ФАЗА 1: Критические блокеры (P0) — 1-2 недели

### SEC-01: Удалить хардкоженные секреты

**Файлы для изменения:**
- [`src/lib/auth/session.ts`](src/lib/auth/session.ts) — убрать fallback JWT_SECRET
- [`src/lib/plugins/service-token.ts`](src/lib/plugins/service-token.ts) — убрать fallback SERVICE_JWT_SECRET
- [`src/lib/auth/rbac.ts`](src/lib/auth/rbac.ts) — удалить MOCK_USERS из production
- [`prisma/seed.ts`](prisma/seed.ts) — пересоздать bcrypt хеши

**Действия:**
1. Создать [`src/lib/config/env.ts`](src/lib/config/env.ts) с валидацией через Zod
2. Обновить [`src/lib/auth/session.ts`](src/lib/auth/session.ts) — fail-fast при отсутствии JWT_SECRET
3. Обновить [`src/lib/plugins/service-token.ts`](src/lib/plugins/service-token.ts) — fail-fast при отсутствии SERVICE_JWT_SECRET
4. Переместить MOCK_USERS в [`src/lib/auth/mock-users.dev.ts`](src/lib/auth/mock-users.dev.ts) с проверкой NODE_ENV
5. Сгенерировать новые bcrypt хеши для seed-пользователей

**Критерии приемки:**
- Приложение не запускается без JWT_SECRET в production
- MOCK_USERS недоступны в production build
- Все секреты только в env переменных

---

### SEC-02: Закрыть MOCK_USERS бэкдор

**Файл:** [`src/app/api/auth/login/route.ts`](src/app/api/auth/login/route.ts)

**Действия:**
1. Убрать fallback на MOCK_USERS в production
2. Добавить явную проверку `process.env.NODE_ENV === "production"`
3. Логировать попытки использования MOCK_USERS в production

**Критерии приемки:**
- В production невозможно войти через MOCK_USERS
- Все попытки логируются в audit

---

### SEC-04: Добавить авторизацию на SSE

**Файл:** [`src/app/api/shell/events/sse/route.ts`](src/app/api/shell/events/sse/route.ts)

**Действия:**
1. Добавить проверку сессии в начале handler
2. Фильтровать события по правам пользователя
3. Добавить rate limiting для SSE подключений

**Критерии приемки:**
- Неавторизованные пользователи не могут подключиться
- Пользователи получают только события, к которым имеют доступ

---

### SEC-05: Защитить metrics/health endpoints

**Файлы:**
- [`src/app/api/metrics/route.ts`](src/app/api/metrics/route.ts)
- [`src/app/api/health/route.ts`](src/app/api/health/route.ts)

**Действия:**
1. Ограничить доступ к `/api/metrics` по IP (через nginx)
2. Создать `/api/health/detailed` для авторизованных админов
3. Убрать версию приложения из публичного `/api/health`

**Критерии приемки:**
- `/api/metrics` доступен только Prometheus scraper
- Публичный `/api/health` не раскрывает чувствительную информацию

---

### SEC-06: Добавить проверку scope для файлов

**Файлы:**
- [`src/app/api/files/preview/route.ts`](src/app/api/files/preview/route.ts)
- [`src/app/api/files/download/route.ts`](src/app/api/files/download/route.ts)

**Действия:**
1. Создать таблицу `Document` с привязкой к Equipment
2. Изменить API для работы с document ID вместо path
3. Добавить проверку прав доступа к документу
4. Использовать подписанные URL с TTL

**Критерии приемки:**
- Пользователь может скачать только документы, к которым имеет доступ
- Невозможно получить файл по прямому пути

---

### SEC-07: Исправить path traversal

**Файлы:**
- [`src/lib/storage/provider.ts`](src/lib/storage/provider.ts)
- [`src/lib/storage/secure-provider.ts`](src/lib/storage/secure-provider.ts)

**Действия:**
1. Использовать `realpath` для проверки реального пути
2. Добавить проверку на абсолютные пути
3. Добавить unit-тесты для path traversal атак

**Критерии приемки:**
- Невозможно выйти за пределы storage root
- Покрытие тестами path traversal сценариев

---

### SEC-08: Убрать POST audit endpoint

**Файл:** [`src/app/api/admin/audit/route.ts`](src/app/api/admin/audit/route.ts)

**Действия:**
1. Удалить POST handler
2. Создать отдельную таблицу `SystemAuditLog` (immutable)
3. Добавить HMAC подпись для audit записей

**Критерии приемки:**
- Невозможно подделать audit записи через API
- Audit log защищен от модификации

---

### SEC-09: Усилить cookie security

**Файл:** [`src/lib/auth/session.ts`](src/lib/auth/session.ts)

**Действия:**
1. Изменить `sameSite: "lax"` на `"strict"` для production
2. Добавить CSRF токены для state-changing операций
3. Проверять `Origin` и `Referer` заголовки

**Критерии приемки:**
- Cookie защищены от CSRF атак
- Все state-changing endpoints проверяют CSRF токен

---

### SEC-10: Автоматический secure cookie в prod

**Файл:** [`src/lib/auth/session.ts`](src/lib/auth/session.ts)

**Действия:**
1. Изменить `secure: process.env.COOKIE_SECURE === "true"` на `secure: process.env.NODE_ENV === "production"`

**Критерии приемки:**
- Cookie автоматически secure в production
- Невозможно случайно отключить secure в production

---

## 🔧 ФАЗА 2: Инфраструктура (P1) — 2-3 недели

### SEC-03: Мигрировать in-memory на Redis

**Файлы:**
- [`src/lib/auth/token-blacklist.ts`](src/lib/auth/token-blacklist.ts)
- [`src/lib/auth/rate-limiter.ts`](src/lib/auth/rate-limiter.ts)
- [`src/lib/auth/api-keys.ts`](src/lib/auth/api-keys.ts)
- [`src/lib/webhooks/webhook-service.ts`](src/lib/webhooks/webhook-service.ts)
- [`src/lib/shell/event-bus.ts`](src/lib/shell/event-bus.ts)
- [`src/lib/shell/cron-engine.ts`](src/lib/shell/cron-engine.ts)
- [`src/lib/shell/circuit-breaker.ts`](src/lib/shell/circuit-breaker.ts)

**Действия:**
1. Добавить Redis в docker-compose
2. Создать [`src/lib/db/redis.ts`](src/lib/db/redis.ts) с connection pooling
3. Обновить все in-memory хранилища на Redis
4. Добавить fallback на in-memory для development

**Критерии приемки:**
- Все хранилища работают в multi-instance
- Данные сохраняются между рестартами
- Fallback на in-memory для dev

---

### SEC-11: Интегрировать реальный LDAP

**Файл:** [`src/lib/auth/ldap.ts`](src/lib/auth/ldap.ts)

**Действия:**
1. Добавить `ldapjs` в зависимости
2. Реализовать реальное подключение к LDAP/AD
3. Создать маппинг AD групп → EMS роли
4. Добавить конфигурацию через env переменные

**Критерии приемки:**
- Реальная интеграция с LDAP/AD
- Маппинг групп настраивается через конфигурацию

---

### SEC-12: Валидация env переменных

**Действия:**
1. Создать [`src/lib/config/env.ts`](src/lib/config/env.ts) с Zod схемой
2. Валидировать env при старте приложения
3. Добавить понятные сообщения об ошибках

**Критерии приемки:**
- Приложение не запускается с невалидными env
- Понятные сообщения об ошибках

---

### SEC-13: Настроить HTTPS в nginx

**Файл:** [`nginx.conf`](nginx.conf)

**Действия:**
1. Добавить SSL конфигурацию
2. Настроить редирект HTTP → HTTPS
3. Добавить HSTS заголовки
4. Настроить SSL сертификаты (Let's Encrypt)

**Критерии приемки:**
- HTTPS работает по умолчанию
- HTTP автоматически редиректится на HTTPS

---

### SEC-14: Healthcheck для приложения

**Файл:** [`docker-compose.yml`](docker-compose.yml)

**Действия:**
1. Добавить healthcheck для app сервиса
2. Настроить зависимости между сервисами

**Критерии приемки:**
- Docker знает о состоянии приложения
- Зависимости запускаются в правильном порядке

---

### SEC-15: Backup стратегия PostgreSQL

**Действия:**
1. Создать [`docker/postgres-backup/`](docker/postgres-backup/) сервис
2. Настроить cron для pg_dump
3. Добавить retention policy
4. Документировать процедуру восстановления

**Критерии приемки:**
- Автоматические backup каждый день
- Retention: 7 daily, 4 weekly, 12 monthly
- Документирована процедура восстановления

---

### SEC-16: CORS конфигурация

**Файл:** [`next.config.ts`](next.config.ts)

**Действия:**
1. Добавить CORS конфигурацию
2. Настроить allowed origins через env
3. Добавить CORS headers для API endpoints

**Критерии приемки:**
- CORS настраивается через env
- Безопасная политика по умолчанию

---

### SEC-17: Rate limiting для критичных endpoints

**Файл:** [`nginx.conf`](nginx.conf)

**Действия:**
1. Добавить отдельные limit_req zones для критичных endpoints
2. Настроить burst и rate параметры
3. Добавить мониторинг срабатываний

**Критерии приемки:**
- Login endpoint защищен от brute-force
- Upload endpoint защищен от DoS
- Admin endpoints защищены от перебора

---

## 💎 ФАЗА 3: Качество кода (P2) — 3-4 недели

### CODE-01: Убрать as unknown as

**Файлы:**
- [`src/app/api/modules/eps/equipment/route.ts`](src/app/api/modules/eps/equipment/route.ts)
- [`src/app/api/modules/eps/equipment/[id]/route.ts`](src/app/api/modules/eps/equipment/[id]/route.ts)

**Действия:**
1. Обновить Prisma schema для правильных типов
2. Использовать правильные типы без приведения

**Критерии приемки:**
- Нет использования `as unknown as`
- Типы корректны

---

### CODE-02: Заменить any на типы

**Файлы:**
- [`src/lib/storage/secure-provider.ts`](src/lib/storage/secure-provider.ts)
- [`src/lib/storage/s3.ts`](src/lib/storage/s3.ts)

**Действия:**
1. Определить конкретные типы
2. Использовать `unknown` с проверками где необходимо

**Критерии приемки:**
- Нет использования `any`
- Все типы явные

---

### CODE-03: Graceful shutdown для Prisma

**Файл:** [`src/lib/db/prisma.ts`](src/lib/db/prisma.ts)

**Действия:**
1. Добавить обработчики `beforeExit` и `SIGTERM`
2. Корректно закрывать соединения

**Критерии приемки:**
- Prisma корректно закрывается при остановке
- Нет потерянных соединений

---

### CODE-04: Connection pooling

**Файл:** [`src/lib/db/prisma.ts`](src/lib/db/prisma.ts)

**Действия:**
1. Добавить параметры пула в DATABASE_URL
2. Настроить connection_limit и pool_timeout

**Критерии приемки:**
- Connection pooling настроен
- Нет исчерпания соединений

---

### PERF-01: Оптимизировать getUserWarehouseAccess

**Файл:** [`src/lib/auth/wms-rbac.ts`](src/lib/auth/wms-rbac.ts)

**Действия:**
1. Использовать `Promise.all` для параллельных запросов
2. Добавить кеширование результатов

**Критерии приемки:**
- Запросы выполняются параллельно
- Кеширование снижает нагрузку на БД

---

### PERF-02: Кеширование справочников

**Файлы:**
- [`src/lib/auth/permissions-registry.ts`](src/lib/auth/permissions-registry.ts)
- [`src/lib/config/modules.ts`](src/lib/config/modules.ts)

**Действия:**
1. Добавить in-memory кеш с TTL
2. Инвалидация при изменениях

**Критерии приемки:**
- Справочники кешируются
- Кеш инвалидируется при изменениях

---

### PERF-03: Добавить индексы

**Файл:** [`prisma/schema.prisma`](prisma/schema.prisma)

**Действия:**
1. Проанализировать частые запросы
2. Добавить составные индексы
3. Создать миграцию

**Критерии приемки:**
- Все частые запросы используют индексы
- Производительность улучшена

---

## 🧪 ФАЗА 4: Тестирование — 3-4 недели

### TEST-01: Увеличить покрытие до 70%+

**Действия:**
1. Добавить unit-тесты для всех критичных модулей
2. Добавить integration тесты для API
3. Добавить E2E тесты (Playwright)
4. Настроить coverage reporting

**Целевые модули для тестирования:**
- Auth (session, guards, RBAC)
- Storage (provider, secure-provider, validation)
- API endpoints (equipment, items, movements)
- Outbox processor
- Event bus
- State machines

**Критерии приемки:**
- Покрытие ≥ 70%
- Все критичные пути покрыты тестами
- CI/CD запускает тесты автоматически

---

### CI/CD Pipeline

**Действия:**
1. Создать [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
2. Настроить автоматический запуск тестов
3. Добавить линтеры и typecheck
4. Настроить автоматический деплой

**Критерии приемки:**
- Тесты запускаются на каждый PR
- Линтеры и typecheck проходят
- Автоматический деплой в staging

---

## 📚 ФАЗА 5: Документация и мониторинг — 1-2 недели

### DOC-01: Синхронизировать версии

**Действия:**
1. Использовать единый источник версии (package.json)
2. Обновить все упоминания версии в документации

**Критерии приемки:**
- Версия везде одинаковая
- Автоматическая синхронизация

---

### DOC-02: OpenAPI спецификация

**Действия:**
1. Создать [`docs/api/openapi.yaml`](docs/api/openapi.yaml)
2. Описать все API endpoints
3. Добавить Swagger UI

**Критерии приемки:**
- Все endpoints описаны в OpenAPI
- Swagger UI доступен

---

### DOC-03: ADR записи

**Действия:**
1. Создать [`docs/adr/`](docs/adr/) директорию
2. Написать ADR для ключевых решений
3. Документировать архитектурные изменения

**Критерии приемки:**
- ADR для всех ключевых решений
- Шаблон для новых ADR

---

### MONITOR-01: Alerting

**Действия:**
1. Настроить Prometheus Alertmanager
2. Создать правила для критичных событий
3. Интегрировать с PagerDuty/Slack

**Критерии приемки:**
- Alerts на критичные события
- Интеграция с уведомлениями

---

### MONITOR-02: Distributed tracing

**Действия:**
1. Добавить OpenTelemetry
2. Интегрировать с Jaeger/Tempo
3. Трейсинг запросов между модулями

**Критерии приемки:**
- Distributed tracing работает
- Видна цепочка вызовов между модулями

---

## 📊 Метрики успеха

### После Фазы 1:
- ✅ Все P0 уязвимости устранены
- ✅ Приложение готово к limited production rollout
- ✅ Базовые security checks проходят

### После Фазы 2:
- ✅ Инфраструктура готова к production
- ✅ Multi-instance работает корректно
- ✅ HTTPS настроен

### После Фазы 3:
- ✅ Качество кода соответствует стандартам
- ✅ Производительность оптимизирована
- ✅ Нет технического долга

### После Фазы 4:
- ✅ Покрытие тестами ≥ 70%
- ✅ CI/CD автоматизирован
- ✅ Регрессии обнаруживаются автоматически

### После Фазы 5:
- ✅ Документация актуальна
- ✅ Мониторинг настроен
- ✅ Команда может эффективно работать с проектом

---

## 🎯 Рекомендуемый порядок реализации

1. **Неделя 1-2:** Фаза 1 (все P0)
2. **Неделя 3-5:** Фаза 2 (инфраструктура)
3. **Неделя 6-9:** Фаза 3 (качество кода)
4. **Неделя 10-13:** Фаза 4 (тестирование)
5. **Неделя 14-15:** Фаза 5 (документация)

**Общее время:** ~15 недель (3.5 месяца)

---

## 🚀 Следующие шаги

1. Переключиться в Code mode для реализации Фазы 1
2. Начать с SEC-01 (удаление хардкоженных секретов)
3. Последовательно реализовать все P0 исправления
4. После завершения Фазы 1 — переход к Фазе 2

**Готовность к работе:** ✅ План создан, можно приступать к реализации
