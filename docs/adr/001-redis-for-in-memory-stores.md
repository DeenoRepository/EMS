# ADR-001: Redis для in-memory хранилищ

> **Статус:** Accepted  
> **Дата:** 2026-08-13  
> **Связано с:** SEC-03

## Контекст

Платформа EMS использовала in-memory хранилища (Map, Set, массивы) для критических компонентов:
- Token blacklist для отзыва JWT
- Rate limiter для защиты от brute-force
- API keys registry
- Webhook subscriptions
- Event bus для межмодульных событий
- Cron engine для запланированных задач
- Circuit breaker для состояния модулей

В production с несколькими инстансами (или serverless) эти хранилища не работают корректно:
- Logout не отзывает токен на других инстансах
- Rate limit не защищает от brute-force
- API keys теряются при рестарте
- Cron задачи дублируются между инстансами

## Решение

Мигрировать все in-memory хранилища на Redis с поддержкой fallback на in-memory для development.

### Архитектура

```
┌─────────────────┐     ┌─────────────────┐
│   EMS Instance 1│     │   EMS Instance 2│
│                 │     │                 │
│  ┌───────────┐  │     │  ┌───────────┐  │
│  │ In-Memory │  │     │  │ In-Memory │  │
│  │ Fallback  │  │     │  │ Fallback  │  │
│  └─────┬─────┘  │     │  └─────┬─────┘  │
│        │        │     │        │        │
│  ┌─────▼─────┐  │     │  ┌─────▼─────┐  │
│  │   Redis   │◄─┼─────┼─►│   Redis   │  │
│  │  Client   │  │     │  │  Client   │  │
│  └───────────┘  │     │  └───────────┘  │
└─────────────────┘     └─────────────────┘
```

### Реализация

1. **Token Blacklist** — Redis SET с TTL = время жизни токена
2. **Rate Limiter** — Redis INCR + EXPIRE (sliding window)
3. **API Keys** — Redis HASH + индекс по hash
4. **Webhooks** — Redis HASH + SET индекс
5. **Event Bus** — Redis Pub/Sub канал `ems:events`
6. **Cron Engine** — Redis SET NX EX для distributed locking
7. **Circuit Breaker** — Redis STRING с TTL

### Fallback стратегия

- В production: Redis обязателен, fail-fast при недоступности
- В development: in-memory fallback с предупреждением в логах

## Альтернативы

### Альтернатива 1: PostgreSQL для всего
- Плюсы: единая инфраструктура, ACID транзакции
- Минусы: высокая latency для rate limiting, нагрузка на БД
- Почему отклонили: rate limiting требует sub-millisecond ответов

### Альтернатива 2: Hazelcast / Infinispan
- Плюсы: in-memory grid, богатый API
- Минусы: дополнительная инфраструктура, сложность deployment
- Почему отклонили: Redis проще и уже есть в docker-compose

### Альтернатива 3: Оставить in-memory
- Плюсы: простота
- Минусы: не работает в multi-instance
- Почему отклонили: блокирует production deployment

## Последствия

### Положительные
- ✅ Multi-instance поддержка из коробки
- ✅ Данные сохраняются между рестартами
- ✅ Distributed locking для cron задач
- ✅ Pub/Sub для real-time событий между инстансами

### Отрицательные
- ⚠️ Дополнительная инфраструктура (Redis)
- ⚠️ Сетевая latency для каждой операции
- ⚠️ Нужно мониторить Redis (memory, connections)

### Нейтральные
- Fallback на in-memory для dev/test
- Новые env переменные (REDIS_URL, REDIS_PASSWORD)

## Ссылки

- [Redis Documentation](https://redis.io/docs/)
- [ioredis Client](https://github.com/redis/ioredis)
- Phase 2 Completion Report
