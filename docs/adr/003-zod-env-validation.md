# ADR-003: Валидация env через Zod

> **Статус:** Accepted  
> **Дата:** 2026-08-13  
> **Связано с:** SEC-01, SEC-12

## Контекст

Приложение использовало `process.env` напрямую во многих местах без валидации. Это приводило к:
- Падению в runtime при отсутствии обязательных переменных
- Непредсказуемому поведению при невалидных значениях
- Хардкоженным fallback-значениям для секретов (security risk)
- Сложностям при деплое (непонятно что сломалось)

## Решение

Создать единый модуль [`src/lib/config/env.ts`](../../src/lib/config/env.ts) с валидацией всех env переменных через Zod.

### Схема валидации

```typescript
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  JWT_SECRET: z.string().min(32),
  SERVICE_JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url(),
  // ... остальные переменные
});
```

### Поведение

- **Production**: fail-fast при любой ошибке валидации
- **Development**: предупреждения, fallback на process.env
- **Test**: строгая валидация

### Дополнительные проверки для production

- Запрет дефолтных/тестовых секретов
- Запрет `ENABLE_MOCK_AUTH=true`
- Запрет `LDAP_MOCK_SUCCESS=true`
- Предупреждение при `COOKIE_SECURE=false`

## Альтернативы

### Альтернатива 1: envalid
- Плюсы: специализированная библиотека
- Минусы: дополнительная зависимость
- Почему отклонили: Zod уже используется в проекте

### Альтернатива 2: dotenv + ручная валидация
- Плюсы: без зависимостей
- Минусы: много boilerplate кода
- Почему отклонили: Zod даёт type safety из коробки

### Альтернатива 3: class-validator
- Плюсы: decorator-based
- Минусы: требует experimental decorators
- Почему отклонили: Zod проще и функциональнее

## Последствия

### Положительные
- ✅ Fail-fast при старте с невалидными переменными
- ✅ Type-safe доступ к env через `env.JWT_SECRET`
- ✅ Понятные сообщения об ошибках
- ✅ Единая точка управления конфигурацией

### Отрицательные
- ⚠️ Нужно обновить все места использования `process.env`

### Нейтральные
- Новая зависимость (Zod уже была)
- Документация по env переменным

## Ссылки

- [Zod Documentation](https://zod.dev/)
- [12-Factor App: Config](https://12factor.net/config)
- Phase 1 Completion Report
