# Аудит безопасности и качества EMS

**Дата аудита:** 2026-08-09  
**Версия проекта:** 2.3.6  
**Проверенный commit:** `ac34c157efe4164afe4fa8d09d4a591a31d6b6aa`  
**Ветка:** `master`

## Область аудита

Проведён статический аудит архитектуры, API, аутентификации, RBAC, файлового хранилища, WMS/EPS-логики, контейнеризации и зависимостей. Также запускались ESLint, TypeScript, production build, `npm audit` и проверка Docker Compose.

На момент аудита код проекта не изменялся. Настоящий файл добавлен отдельно как артефакт аудита.

## Сводка

| Уровень | Количество |
|---|---:|
| Критический при небезопасной конфигурации | 2 |
| Высокий | 8 |
| Средний | 6 |
| Низкий / hardening | 3 |

Основные риски:

1. Предсказуемые production-секреты и открытые порты в Docker Compose.
2. Возможность обхода аутентификации через `LDAP_MOCK_SUCCESS`.
3. Отрицательные количества и повторная обработка операций искажают складские остатки.
4. Path traversal и отсутствие лимитов в загрузке документов.
5. S3-ветка фактически не загружает файлы.
6. Несколько изменяющих справочники API доступны любому авторизованному пользователю.
7. Проект не проходит TypeScript, ESLint и production build.
8. Автоматизированные тесты не обнаружены.

---

# Подтверждённые уязвимости

## 1. Критический: предсказуемые секреты и прямой доступ к инфраструктуре

В Compose заданы рабочие значения по умолчанию:

- JWT secret: `docker-compose.yml:16`
- PostgreSQL `ems_user / ems_password`: `docker-compose.yml:15`, `docker-compose.yml:31-36`
- MinIO `minioadmin / minioadmin`: `docker-compose.yml:20-21`, `docker-compose.yml:51-53`

Одновременно наружу публикуются:

- приложение — `3000`: `docker-compose.yml:11-12`
- PostgreSQL — `5432`: `docker-compose.yml:35-36`
- MinIO API и консоль — `9000`, `9001`: `docker-compose.yml:54-56`

### Последствия

Если значения не переопределены и порты доступны по сети:

- возможно прямое подключение к PostgreSQL;
- возможен вход в MinIO;
- зная стандартный `JWT_SECRET`, можно подписать JWT с ролью `ADMIN`;
- обращение к `:3000` обходит rate limiting и часть security headers Nginx.

### Рекомендация

- удалить fallback-секреты вида `${SECRET:-default}`;
- завершать запуск при отсутствии обязательных секретов;
- публиковать наружу только Nginx;
- для приложения, PostgreSQL и MinIO использовать только внутреннюю Docker-сеть;
- выполнить ротацию JWT, БД и MinIO credentials, если конфигурация уже развёртывалась.

## 2. Критический при включении: обход аутентификации через LDAP mock

`LDAP_MOCK_SUCCESS=true` возвращает пользователя с ролями `VIEWER` и `EDITOR`, не проверяя пароль:

- `src/lib/auth/ldap.ts:19-25`
- `src/lib/auth/ldap.ts:37-44`

Login принимает результат и выдаёт полноценную сессию:

- `src/app/api/auth/login/route.ts:19-59`

Проверка `NODE_ENV === "production"` блокирует только `MOCK_USERS`, но не LDAP mock:

- `src/app/api/auth/login/route.ts:128-135`

### Сценарий

При установленных `LDAP_URL`, `LDAP_BASE_DN` и `LDAP_MOCK_SUCCESS=true` любой непустой логин и пароль дают сессию редактора.

### Рекомендация

Полностью исключить LDAP mock из production bundle либо аварийно завершать процесс, если `LDAP_MOCK_SUCCESS=true` вне `development/test`.

## 3. Высокий: отрицательные количества повреждают складские остатки

Несколько WMS API проверяют только наличие или превышение доступного количества, но не требуют положительного целого числа.

Затронуты:

- перемещения: `src/app/api/modules/wms/transfers/route.ts:170-195`
- резервы: `src/app/api/modules/wms/reservations/route.ts:48-99`
- списания: `src/app/api/modules/wms/write-offs/route.ts:54-124`
- приход: `src/app/api/modules/wms/items/route.ts:87-166`
- ручное редактирование: `src/app/api/modules/wms/items/[id]/route.ts:59-116`

Примеры:

- резерв `-5` уменьшает `reservedQuantity`;
- списание `-5` увеличивает физический остаток на 5;
- отрицательный трансфер увеличивает остаток источника и уменьшает остаток получателя;
- отрицательный приход уменьшает остаток.

На уровне Prisma отсутствуют ограничения положительности: `prisma/schema.prisma:417-575`.

### Рекомендация

Ввести общие Zod-схемы с `z.number().int().positive()` и добавить PostgreSQL `CHECK` constraints для остатков и количеств операций.

## 4. Высокий: повторное подтверждение трансфера дублирует движение

При обработке `APPROVE` не проверяется, что заявка всё ещё находится в `PENDING`:

- загрузка заявки: `src/app/api/modules/wms/transfers/route.ts:56-63`
- изменение остатков: `src/app/api/modules/wms/transfers/route.ts:82-164`

Повторный запрос снова уменьшает остаток источника, увеличивает остаток получателя и создаёт новое движение.

### Рекомендация

В одной транзакции выполнять только переход `PENDING → APPROVED | REJECTED`. Условное обновление должно включать текущий статус; повторная операция должна возвращать `409 Conflict`.

## 5. Высокий: повторный возврат личной карточки повторно увеличивает склад

Возврат не проверяет уже установленное `returnedAt`:

- обработчик: `src/app/api/modules/wms/personal-cards/route.ts:154-200`
- увеличение остатка: `src/app/api/modules/wms/personal-cards/route.ts:203-225`
- повторное списание повреждённого имущества: `src/app/api/modules/wms/personal-cards/route.ts:227-252`

Один и тот же возврат можно вызвать через `PUT` и `PATCH`: `src/app/api/modules/wms/personal-cards/route.ts:146-152`.

### Рекомендация

Разрешать возврат только при `returnedAt IS NULL`, применять условное обновление внутри транзакции и добавить idempotency key.

## 6. Высокий: path traversal при загрузке EPS-документов

Клиентский `equipmentId` напрямую включается в путь:

- `src/app/api/modules/eps/documents/upload/route.ts:22-45`

Локальное хранилище использует этот каталог без нормализации и проверки принадлежности корню:

- `src/lib/storage/s3.ts:57-64`

Значение вида `../../../target-directory` может вывести запись за пределы каталога загрузок. Запись файла выполняется до проверки существования оборудования в транзакции БД:

- `src/app/api/modules/eps/documents/upload/route.ts:36-45`
- `src/app/api/modules/eps/documents/upload/route.ts:47-86`

### Рекомендация

- не строить путь из `equipmentId`;
- использовать UUID для object key;
- проверять оборудование и права до чтения файла;
- проверять результат `path.resolve()` относительно storage root;
- удалять объект при откате БД либо использовать staged upload.

## 7. Высокий: загрузка EPS-документов не ограничивает размер и тип

Маршрут полностью читает файл в память и не проверяет размер, MIME, расширение или magic bytes:

- `src/app/api/modules/eps/documents/upload/route.ts:22-37`

### Последствия

- исчерпание памяти процесса;
- хранение произвольного содержимого;
- загрузка опасных документов;
- разные политики безопасности у двух upload API.

### Рекомендация

Свести загрузку к одному storage service с потоковой обработкой, лимитом тела, allowlist MIME, проверкой magic bytes и антивирусным карантином.

## 8. Высокий: S3-хранилище не выполняет фактическую загрузку

При наличии S3-переменных код формирует object key и URL, но не отправляет объект:

- `src/lib/storage/s3.ts:36-54`

В проекте отсутствует S3/MinIO SDK: `package.json:16-29`. Compose по умолчанию включает эту ветку: `docker-compose.yml:18-21`.

### Последствия

API возвращает успех и сохраняет ссылку в БД, хотя файла в MinIO нет, что приводит к скрытой потере документов.

### Рекомендация

Реализовать реальный `PutObject` через официальный S3 SDK и фиксировать `DocumentVersion` только после подтверждённой загрузки.

## 9. Высокий: недостаточная авторизация изменяющих справочники API

Следующие операции не имеют role-level проверки:

- создание reference option: `src/app/api/reference/options/route.ts:41-55`
- удаление поля: `src/app/api/reference/fields/[id]/route.ts:4-13`
- удаление значения: `src/app/api/reference/values/[id]/route.ts:4-13`
- создание equipment type attribute: `src/app/api/equipment-type-attributes/route.ts:30-45`

Глобальный middleware требует сессию, но любой авторизованный `VIEWER` может вызвать эти операции.

Для сравнения, соседние API требуют `ADMIN` или `EDITOR`:

- `src/app/api/reference/fields/route.ts:53-57`
- `src/app/api/reference/values/route.ts:6-10`

### Рекомендация

Добавить единый server-side authorization guard. Для удаления системных справочников требовать `ADMIN`.

## 10. Высокий: роли и состояние пользователя не обновляются после выдачи JWT

JWT содержит роли и действует восемь часов:

- `src/lib/auth/session.ts:14-20`

При проверке выполняется только криптографическая проверка и type cast:

- `src/lib/auth/session.ts:23-30`

`isActive` и текущие роли из БД не проверяются. RBAC доверяет ролям из JWT:

- `src/lib/auth/rbac.ts:56-59`
- `src/middleware.ts:23-37`

### Последствия

После блокировки пользователя или удаления роли уже выпущенная сессия остаётся действительной до восьми часов.

### Рекомендация

Добавить `sessionVersion`/`tokenVersion`, проверять `isActive`, сократить TTL access token и применять серверную refresh-session.

## 11. Средний–высокий: logout не отзывает токен во всех процессах

Blacklist хранится в локальном `Map`:

- `src/lib/auth/token-blacklist.ts:7`
- `src/lib/auth/token-blacklist.ts:26-41`

Logout записывает токен только в память текущего процесса:

- `src/app/api/auth/logout/route.ts:8-24`

### Последствия

Скопированный токен остаётся действительным на другой реплике или после перезапуска процесса.

### Рекомендация

Хранить revocation/session state в Redis или БД, используя hash `jti`, а не полный JWT.

## 12. Средний: неверное действие согласования автоматически становится отказом

После ветки `CREATE` любое другое действие рассматривается как решение:

- `src/app/api/modules/eps/approvals/route.ts:83-136`

Только `APPROVED` и `APPROVE` дают approval, всё остальное становится `REJECTED`: `src/app/api/modules/eps/approvals/route.ts:136`.

Текущий статус заявки не проверяется перед повторным решением: `src/app/api/modules/eps/approvals/route.ts:138-155`.

### Рекомендация

Разрешать только строгий enum `CREATE | APPROVE | REJECT` и валидировать переходы состояния.

## 13. Средний: раскрытие внутренних ошибок согласования

API возвращает клиенту `error.message` и `String(error)`:

- `src/app/api/modules/eps/approvals/route.ts:186-193`

Это может раскрыть структуру Prisma, имена таблиц, constraints и внутренние детали.

### Рекомендация

Возвращать стабильный внешний код ошибки и `requestId`; подробности оставлять только в серверных логах.

## 14. Средний: rate limiting существует только в Nginx

Nginx ограничивает login:

- `nginx.conf:1-3`
- `nginx.conf:22-31`

Но приложение опубликовано напрямую на `3000`: `docker-compose.yml:11-12`. В самом login route отсутствуют limiter, progressive delay и account lockout.

### Рекомендация

Добавить application-level rate limiting с общим Redis backend и убрать внешний bind порта 3000.

## 15. Средний: CSV formula injection при экспорте

Значения экранируются только для CSV-кавычек:

- `src/app/api/modules/eps/equipment/export/route.ts:96-104`

Значения, начинающиеся с `=`, `+`, `-` или `@`, не нейтрализуются и могут интерпретироваться табличным процессором как формулы.

### Рекомендация

Добавлять `'` для formula-like значений либо использовать библиотеку с защитой от CSV injection.

## 16. Средний: отсутствие транзакционной защиты от конкурентных изменений остатков

Остаток читается, вычисляется в Node.js, а затем записывается:

- трансферы: `src/app/api/modules/wms/transfers/route.ts:82-164`
- резервы: `src/app/api/modules/wms/reservations/route.ts:58-101`
- списания: `src/app/api/modules/wms/write-offs/route.ts:64-125`

Группировка операций в транзакции не предотвращает lost update между конкурентными запросами.

### Рекомендация

Использовать условные атомарные updates, `increment/decrement`, проверки количества в `WHERE` и serializable transaction либо row locking.

---

# Ошибки качества и сборки

## TypeScript

`npx tsc --noEmit` завершился с ошибками.

Основные проблемы:

1. Seed использует `sku` как unique key, хотя схема содержит compound unique `(sku, warehouse)`:
   - `prisma/seed.ts:516`
   - `prisma/seed.ts:539`
   - `prisma/seed.ts:562`
   - `prisma/seed.ts:585`
   - `prisma/seed.ts:607`
   - `prisma/seed.ts:629`
   - `prisma/seed.ts:651`
2. Несоответствие props `BarcodeLabelModal`:
   - вызов: `src/app/modules/wms/page.tsx:562-573`
   - контракт: `src/components/wms/barcode-label-modal.tsx:7-25`
3. Некорректно выведенный union в `SearchableSelect`:
   - `src/components/ui/searchable-select.tsx:52-64`
   - ошибочные обращения: `src/components/ui/searchable-select.tsx:92`, `src/components/ui/searchable-select.tsx:185-195`
4. Недостижимая production-проверка в dev-only ветке login: `src/app/api/auth/login/route.ts:163`.

## ESLint

Результат:

- **66 errors**
- **96 warnings**
- **55 файлов** с проблемами

| Правило | Количество |
|---|---:|
| `@typescript-eslint/no-unused-vars` | 83 |
| `@typescript-eslint/no-explicit-any` | 41 |
| `react-hooks/set-state-in-effect` | 21 |
| `react-hooks/exhaustive-deps` | 10 |
| `@next/next/no-img-element` | 3 |

## Production build

`npm run build` сначала завершился ошибкой `EPERM` при замене Prisma engine DLL, вероятно из-за удержания файла другим Windows-процессом.

Повторный `npx next build` успешно скомпилировал приложение, затем остановился на TypeScript-ошибках, начиная с `prisma/seed.ts:516`. Production build не проходит.

## Зависимости

`npm audit` обнаружил четыре high-severity цепочки:

- `next`
- вложенный `postcss`
- `sharp`
- `nanoid`

Установленные проблемные версии:

- `next@16.2.12`
- вложенный `postcss@8.4.31`
- `nanoid@3.3.16`
- `sharp@0.34.5`

Предложенное исправление для цепочки Next — обновление до `16.3.0` с последующим повторным аудитом.

## Тесты

Тестовые файлы и test script в `package.json` не обнаружены. Регрессионная защита критичной складской логики отсутствует.

## Docker Compose

`docker compose config --quiet` прошёл, но сообщил, что поле `version` устарело и игнорируется.

---

# Архитектурные риски

Наиболее сложные участки:

- `src/components/layout/shell-context.tsx` — cognitive complexity 63;
- `src/app/modules/wms/page.tsx` — cyclomatic 35, cognitive 49;
- `src/app/api/modules/wms/movements/route.ts` — cognitive 41;
- `src/app/modules/eps/approval-queue/page.tsx` — cyclomatic 28, cognitive 40;
- `src/app/admin/settings/eps/page.tsx` — cognitive 49.

Большая сложность WMS API повышает вероятность ошибок при проверке остатков и переходов состояния.

---

# План исправлений

## Этап 0 — немедленные меры до следующего развёртывания

1. Удалить fallback credentials из `docker-compose.yml`.
2. Закрыть внешние порты `3000`, `5432`, `9000`, `9001`.
3. Выполнить ротацию `JWT_SECRET`, PostgreSQL password и MinIO credentials.
4. Запретить `LDAP_MOCK_SUCCESS` вне test/dev.
5. Проверить неизвестные администраторские сессии, историю изменения остатков, дублированные трансферы/возвраты и наличие документов в MinIO.

## Этап 1 — исправление целостности WMS

1. Создать общие Zod-схемы для количеств, enum и ID.
2. Запретить отрицательные, дробные и нечисловые количества.
3. Сделать трансферы и возвраты идемпотентными.
4. Ввести конечные автоматы переходов для transfer, requisition, approval и personal-card return.
5. Перевести изменения остатков на атомарные условные updates.
6. Добавить DB constraints.
7. Написать интеграционные тесты на отрицательные количества, повторные действия и конкурентные операции.

## Этап 2 — безопасность файлов

1. Объединить два upload pipeline.
2. Проверять права на оборудование до загрузки.
3. Удалить использование пользовательского ID как части файлового пути.
4. Добавить лимит размера, MIME allowlist, magic-byte validation и карантин/AV scanning.
5. Реализовать фактическую загрузку в S3.
6. Добавить cleanup при ошибке БД.
7. Выдавать только подписанные URL либо скачивать по `documentVersionId` с проверкой доступа.

## Этап 3 — единая авторизация API

1. Создать wrappers `requireSession`, `requireRole`, `requireModulePermission`, `requireWarehouseAccess`, `requireEquipmentAccess`.
2. Применить их ко всем мутациям.
3. Закрыть обнаруженные reference/attribute endpoints.
4. Добавить deny-by-default policy для новых маршрутов.
5. Создать authorization matrix и тестировать каждую роль против каждого endpoint.

## Этап 4 — управление сессиями

1. Заменить in-memory blacklist на Redis/БД.
2. Хранить и отзывать `jti`.
3. Добавить `sessionVersion`.
4. Проверять `isActive`.
5. Валидировать JWT payload через Zod.
6. Указать issuer, audience и допустимый algorithm.
7. Добавить application-level rate limiting.
8. Сократить срок жизни access token.

## Этап 5 — восстановление сборки

1. Исправить compound unique в `prisma/seed.ts`.
2. Синхронизировать props `BarcodeLabelModal`.
3. Исправить тип нормализованного списка `SearchableSelect`.
4. Устранить остальные TypeScript errors.
5. Снизить ESLint errors до нуля.
6. Запретить merge при провале `tsc`, ESLint, тестов, production build и dependency audit.

## Этап 6 — зависимости и hardening

1. Обновить Next как минимум до исправленной версии `16.3.0`.
2. Пересобрать lockfile и повторить `npm audit`.
3. Проверить совместимость обновлённых `postcss`, `sharp`, `nanoid`.
4. Убрать `unsafe-eval` из CSP: `nginx.conf:16`.
5. Добавить CSP на уровне приложения.
6. Закрыть подробные сообщения ошибок.
7. Добавить защиту CSV от formula injection.
8. Убрать устаревшее поле `version` из Compose.
9. Перейти с deprecated `middleware` convention на `proxy` в соответствии с Next 16.

---

# Рекомендуемый порядок PR

1. **PR-1: Deployment secrets and network exposure**
2. **PR-2: WMS input validation and DB constraints**
3. **PR-3: Idempotent WMS transitions and concurrency control**
4. **PR-4: Secure unified document storage**
5. **PR-5: Central API authorization guards**
6. **PR-6: Durable sessions and login protection**
7. **PR-7: TypeScript/build stabilization**
8. **PR-8: Automated security and business-logic tests**
9. **PR-9: Dependency upgrades and CSP hardening**

Первые три PR следует считать блокирующими production-релиз.
