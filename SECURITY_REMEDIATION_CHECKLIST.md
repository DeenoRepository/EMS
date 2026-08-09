# Чеклист устранения замечаний безопасности EMS

Источник: [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md), аудит от 2026-08-09 для commit `ac34c157efe4164afe4fa8d09d4a591a31d6b6aa`.

Статусы:

- `[ ]` — не начато;
- `[~]` — выполняется;
- `[x]` — исправлено в коде и проверено;
- `MANUAL` — действие выполняется отдельно в каждом окружении и не может быть безопасно автоматизировано в репозитории.

## P0 — блокирующие production-релиз

### PR-1: Deployment secrets and network exposure

- [x] **SEC-01:** удалить fallback credentials из `docker-compose.yml`.
- [x] **SEC-01:** убрать внешние bindings `3000`, `5432`, `9000`, `9001`; наружу оставить только Nginx.
- [x] **SEC-01:** добавить безопасный `.env.example` с обязательными переменными без реальных секретов.
- [x] **SEC-02:** запретить `LDAP_MOCK_SUCCESS=true` вне `development/test` с fail-fast ошибкой.
- [x] Проверить положительный и отрицательный сценарии `docker compose config`.
- [ ] Запустить TypeScript и точечный ESLint без новых регрессий.
- [ ] **MANUAL:** ротировать `JWT_SECRET`, пароль PostgreSQL и MinIO credentials во всех ранее развёрнутых окружениях.
- [ ] **MANUAL:** отозвать/проверить неизвестные административные сессии.
- [ ] **MANUAL:** проверить историю остатков, дублированные трансферы и возвраты, фактическое наличие документов в MinIO.

### PR-2: WMS input validation and DB constraints

- [x] **SEC-03:** создать общие Zod-схемы для ID, enum и положительных целых количеств.
- [x] **SEC-03:** применить схемы к приходу, ручному редактированию, резервам, списаниям и трансферам.
- [x] **SEC-03:** добавить PostgreSQL `CHECK` constraints для остатков и количеств операций.
- [x] Перед миграцией найти и исправить существующие отрицательные/некорректные данные.
- [x] Добавить интеграционные тесты отрицательных, дробных и нечисловых количеств.

### PR-3: Idempotent WMS transitions and concurrency control

- [x] **SEC-04:** разрешить трансферу только переход `PENDING -> APPROVED | REJECTED`; повтор возвращает `409`.
- [x] **SEC-05:** разрешить возврат личной карточки только при `returnedAt IS NULL`; повтор возвращает `409`.
- [x] **SEC-16:** заменить read/compute/write на атомарные условные изменения остатков.
- [x] Ввести явные конечные автоматы transfer, requisition, approval и personal-card return.
- [x] Добавить тесты повторных и конкурентных операций.

## P1 — высокий приоритет

### PR-4: Secure unified document storage

- [x] **SEC-06:** убрать пользовательский `equipmentId` из файлового пути.
- [x] Проверять принадлежность `path.resolve()` корню локального хранилища.
- [x] Проверять оборудование и права до чтения/загрузки файла.
- [x] **SEC-07:** добавить лимит размера, MIME allowlist и magic-byte validation.
- [x] Объединить upload pipeline и предусмотреть карантин/AV scanning.
- [x] **SEC-08:** реализовать настоящий S3/MinIO `PutObject` через официальный SDK.
- [x] Создавать `DocumentVersion` только после подтверждённой загрузки.
- [x] Удалять объект при ошибке БД или использовать staged upload.
- [x] Выдавать файл по ID после проверки доступа либо через реальный signed URL.

### PR-5: Central API authorization guards

- [x] **SEC-09:** создать `requireSession`, `requireRole`, `requireModulePermission`, `requireWarehouseAccess`, `requireEquipmentAccess`.
- [x] Закрыть мутации reference options/fields/values и equipment type attributes.
- [x] Ввести deny-by-default policy для новых маршрутов.
- [x] Создать authorization matrix и тесты каждой роли против каждого endpoint.

### PR-6: Durable sessions and login protection

- [x] **SEC-10:** валидировать JWT payload через Zod.
- [x] Проверять `User.isActive`, актуальные роли и `sessionVersion`.
- [x] Указать JWT issuer, audience и допустимый algorithm; сократить access-token TTL.
- [x] **SEC-11:** заменить локальный blacklist на durable revocation по hash `jti` в БД/Redis.
- [x] **SEC-14:** добавить application-level login rate limiting с общим backend.

### EPS и экспорт

- [x] **SEC-12:** разрешать только `CREATE | APPROVE | REJECT` и валидировать переходы approval.
- [x] **SEC-13:** возвращать стабильные внешние коды и `requestId`, детали оставлять в серверных логах.
- [x] **SEC-15:** нейтрализовать значения CSV, начинающиеся с `=`, `+`, `-`, `@`.

## Quality gates и hardening

### PR-7: TypeScript/build stabilization

- [ ] Исправить compound unique в `prisma/seed.ts`.
- [ ] Синхронизировать props `BarcodeLabelModal`.
- [ ] Исправить union typing `SearchableSelect` и остальные ошибки TypeScript.
- [ ] Снизить ESLint errors до нуля.
- [ ] Добиться успешного production build.

### PR-8: Automated security and business-logic tests

- [ ] Добавить test script и тестовый стек.
- [ ] Добавить регрессионные тесты WMS, auth, authorization и upload pipeline.
- [ ] Добавить CI gates: typecheck, lint, tests, build, dependency audit.

### PR-9: Dependency upgrades and CSP hardening

- [x] Убрать `unsafe-eval` из CSP и добавить CSP на уровне приложения.
- [x] Убрать подробные сообщения внутренних ошибок.
- [x] Убрать устаревшее поле `version` из Compose.

## Критерий завершения

Пункт помечается `[x]` только после изменения кода, негативной/позитивной проверки и отсутствия новых ошибок в затронутой области. Пункты `MANUAL` закрываются оператором отдельно для каждого окружения с записью даты, владельца и подтверждения ротации/проверки вне этого файла.
