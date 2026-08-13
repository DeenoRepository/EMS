# Architecture Decision Records (ADR)

Этот каталог содержит записи архитектурных решений (ADR) для проекта EMS.

## Что такое ADR?

ADR (Architecture Decision Record) — это документ, который фиксирует важное архитектурное решение, его контекст и последствия. Каждый ADR описывает:
- **Контекст** — какую проблему решаем
- **Решение** — что решили сделать
- **Альтернативы** — какие варианты рассматривали
- **Последствия** — положительные и отрицательные эффекты

## Шаблон

Используйте файл [`template.md`](template.md) для создания нового ADR.

## Список ADR

| # | Название | Статус | Дата |
|---|----------|--------|------|
| [001](001-redis-for-in-memory-stores.md) | Redis для in-memory хранилищ | Accepted | 2026-08-13 |
| [002](002-ldapjs-integration.md) | Интеграция LDAP через ldapjs | Accepted | 2026-08-13 |
| [003](003-zod-env-validation.md) | Валидация env через Zod | Accepted | 2026-08-13 |
| [004](004-distributed-locking-cron.md) | Distributed locking для cron | Accepted | 2026-08-13 |
| [005](005-https-nginx-termination.md) | HTTPS termination в nginx | Accepted | 2026-08-13 |
| [006](006-rate-limiting-strategy.md) | Rate limiting стратегия | Accepted | 2026-08-13 |
| [007](007-graceful-shutdown-prisma.md) | Graceful shutdown для Prisma | Accepted | 2026-08-13 |
| [008](008-version-synchronization.md) | Синхронизация версий | Accepted | 2026-08-13 |

## Статусы

- **Proposed** — предложено, обсуждается
- **Accepted** — принято и реализовано
- **Deprecated** — устарело, не рекомендуется
- **Superseded** — заменено другим ADR
