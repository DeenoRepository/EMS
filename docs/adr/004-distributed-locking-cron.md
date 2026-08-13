# ADR-004: Distributed Locking для Cron

> **Статус:** Accepted  
> **Дата:** 2026-08-13  
> **Связано с:** SEC-03

## Контекст

Cron engine использовал `setInterval` для запуска задач по расписанию. В multi-instance окружении каждая реплика запускала свои таймеры, что приводило к:
- Дублированию выполнения задач
- Race conditions при обновлении общих данных
- Неконсистентному состоянию

## Решение

Использовать Redis-based distributed locking через `SET NX EX` для обеспечения mutual exclusion при выполнении cron задач.

### Алгоритм

```
┌─────────────────┐
│  Cron Trigger   │
│  (setInterval)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SET NX EX      │──── Lock acquired? ──── No ──► Skip execution
│  cron:lock:{id} │
└────────┬────────┘
         │ Yes
         ▼
┌─────────────────┐
│  Execute Task   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  DEL lock       │
└─────────────────┘
```

### Реализация

```typescript
private async acquireLock(taskId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true; // Fail-open в dev

  const lockKey = `cron:lock:${taskId}`;
  const lockToken = `${process.pid}_${Date.now()}_${random}`;
  const result = await redis.set(lockKey, lockToken, "EX", 300, "NX");
  return result === "OK";
}
```

### Параметры

- **TTL блокировки**: 300 секунд (5 минут)
- **Fail-open**: если Redis недоступен, задача выполняется
- **Lock token**: уникальный идентификатор для безопасного освобождения

## Альтернативы

### Альтернатива 1: PostgreSQL advisory locks
- Плюсы: не нужен Redis
- Минусы: дополнительная нагрузка на БД
- Почему отклонили: Redis уже используется для других задач

### Альтернатива 2: ZooKeeper / etcd
- Плюсы: проверенное решение
- Минусы: дополнительная инфраструктура
- Почему отклонили: избыточно для текущих потребностей

### Альтернатива 3: Отдельный worker-процесс
- Плюсы: полный контроль
- Минусы: сложность deployment
- Почему отклонили: можно добавить позже при необходимости

## Последствия

### Положительные
- ✅ Только один инстанс выполняет задачу
- ✅ Автоматическое освобождение при зависании (TTL)
- ✅ Fail-open при недоступности Redis

### Отрицательные
- ⚠️ Зависимость от Redis
- ⚠️ Возможны пропуски если задача выполняется дольше TTL

### Нейтральные
- Логирование пропущенных выполнений
- Мониторинг lock contention

## Ссылки

- [Redis Distributed Locks](https://redis.io/docs/manual/patterns/distributed-locks/)
- [Redlock Algorithm](https://redis.io/docs/manual/patterns/distributed-locks/)
- Phase 2 Completion Report
