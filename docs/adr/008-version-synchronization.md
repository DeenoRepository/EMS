# ADR-008: Синхронизация версий

> **Статус:** Accepted  
> **Дата:** 2026-08-13  
> **Связано с:** DOC-01

## Контекст

Версия приложения была определена в нескольких местах:
- `package.json`: `"version": "2.3.7"`
- `src/lib/version.ts`: `"2.4.0"` (hardcoded)
- `docs/rules/*.md`: `> **Версия:** 2.3.7`

Это приводило к:
- Рассинхронизации версий
- Непонятно какая версия актуальна
- Сложностям при релизах

## Решение

Использовать `package.json` как единый источник версии (single source of truth).

### Реализация

```typescript
// src/lib/version.ts
import pkg from "../../package.json";

export const APP_VERSION: string = pkg.version;
export const APP_NAME: string = pkg.name;
```

### Использование

```typescript
import { APP_VERSION } from "@/lib/version";

// В health endpoint
return { version: APP_VERSION };

// В логах
logEvent({ version: APP_VERSION, ... });

// В UI
<footer>Version: {APP_VERSION}</footer>
```

### Автоматизация

- `next.config.ts` уже использует `pkg.version` для `NEXT_PUBLIC_APP_VERSION`
- CI/CD может проверять консистентность версий

## Альтернативы

### Альтернатива 1: VERSION файл
- Плюсы: отдельный файл для версии
- Минусы: ещё один источник правды
- Почему отклонили: package.json уже содержит версию

### Альтернатива 2: Git tags
- Плюсы: версия из git
- Минусы: требует git в runtime
- Почему отклонили: не всегда доступен

### Альтернатива 3: Env переменная
- Плюсы: гибкость
- Минусы: нужно устанавливать при деплое
- Почему отклонили: package.json уже есть

## Последствия

### Положительные
- ✅ Единый источник версии
- ✅ Автоматическая синхронизация
- ✅ Простота обновления

### Отрицательные
- ⚠️ Нужно пересобирать приложение для обновления версии

### Нейтральные
- Документация по процессу релиза
- CI/CD проверка версий

## Ссылки

- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- Phase 5 Completion Report
