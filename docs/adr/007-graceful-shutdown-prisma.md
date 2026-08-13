# ADR-007: Graceful Shutdown для Prisma

> **Статус:** Accepted  
> **Дата:** 2026-08-13  
> **Связано с:** CODE-03

## Контекст

При остановке приложения (Docker stop, Kubernetes pod termination) PrismaClient не закрывал соединения корректно:
- Потеря соединений в пуле PostgreSQL
- Потенциальная потеря незакоммиченных транзакций
- Утечки ресурсов при частых рестартах

## Решение

Добавить обработчики сигналов завершения для корректного закрытия PrismaClient.

### Сигналы

| Сигнал | Источник | Действие |
|--------|----------|----------|
| SIGTERM | Docker stop, Kubernetes | Graceful shutdown |
| SIGINT | Ctrl+C | Graceful shutdown |
| beforeExit | Normal Node.js exit | Disconnect |

### Реализация

```typescript
function registerShutdownHandlers() {
  const shutdown = async (signal: string) => {
    console.log(`[Prisma] Received ${signal}, disconnecting...`);
    try {
      await prisma.$disconnect();
      console.log("[Prisma] Disconnected successfully");
    } catch (err) {
      console.error("[Prisma] Error during disconnect:", err);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("beforeExit", async () => {
    await prisma.$disconnect();
  });
}
```

### Особенности

- Регистрация только в production/development (не в test)
- Идемпотентность (повторные вызовы безопасны)
- Логирование процесса отключения
- Экспорт `disconnectPrisma()` для ручного управления

## Альтернативы

### Альтернатива 1: Docker stop --time
- Плюсы: на уровне инфраструктуры
- Минусы: не решает проблему полностью
- Почему отклонили: нужен явный handler

### Альтернатива 2: Kubernetes lifecycle hooks
- Плюсы: нативная поддержка K8s
- Минусы: специфично для K8s
- Почему отклонили: нужна универсальность

### Альтернатива 3: Игнорировать проблему
- Плюсы: простота
- Минусы: утечки ресурсов
- Почему отклонили: production requirement

## Последствия

### Положительные
- ✅ Корректное закрытие соединений
- ✅ Нет потерянных транзакций
- ✅ Поддержка Docker/Kubernetes
- ✅ Логирование процесса

### Отрицательные
- ⚠️ Небольшая задержка при остановке

### Нейтральные
- Документация для DevOps
- Мониторинг времени shutdown

## Ссылки

- [Node.js Process Events](https://nodejs.org/api/process.html#process_event_signals)
- [Prisma Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- Phase 3 Completion Report
