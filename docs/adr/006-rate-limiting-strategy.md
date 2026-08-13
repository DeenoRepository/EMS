# ADR-006: Rate Limiting стратегия

> **Статус:** Accepted  
> **Дата:** 2026-08-13  
> **Связано с:** SEC-17

## Контекст

Приложение не имело эффективной защиты от:
- Brute-force атак на login endpoint
- DoS атак на upload endpoint
- Перебора admin endpoints
- Общего abuse API

Существующий rate limit в nginx был слишком общий (30 r/s на все API).

## Решение

Многоуровневая стратегия rate limiting с отдельными лимитами для критичных endpoints.

### Уровни защиты

| Endpoint | Лимит | Burst | Назначение |
|----------|-------|-------|------------|
| `/api/auth/login` | 5 r/m | 5 | Защита от brute-force |
| `/api/files/upload` | 10 r/m | 10 | Защита от DoS |
| `/api/admin/*` | 10 r/s | 20 | Защита admin endpoints |
| `/api/*` (общий) | 30 r/s | 20 | Общая защита API |
| `/api/metrics` | - | - | Только internal IP |

### Реализация

**Уровень 1: Nginx (первая линия защиты)**
```nginx
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

location /api/auth/login {
    limit_req zone=login_limit burst=5 nodelay;
    limit_req_status 429;
    proxy_pass http://ems_app;
}
```

**Уровень 2: Application (вторая линия защиты)**
- Rate limiter в [`src/lib/auth/rate-limiter.ts`](../../src/lib/auth/rate-limiter.ts)
- Redis-based с TTL
- Per-user/per-IP лимиты

### Параметры

- **Login**: 5 попыток за 15 минут (application-level)
- **Upload**: 10 запросов в минуту (nginx-level)
- **Admin**: 10 запросов в секунду (nginx-level)
- **Connection limit**: 50 одновременных с одного IP

## Альтернативы

### Альтернатива 1: Только application-level
- Плюсы: гибкая логика
- Минусы: нагрузка на приложение
- Почему отклонили: nginx эффективнее для простых лимитов

### Альтернатива 2: Cloud WAF
- Плюсы: managed решение
- Минусы: стоимость, vendor lock-in
- Почему отклонили: on-premise deployment

### Альтернатива 3: Без rate limiting
- Плюсы: простота
- Минусы: уязвимость к атакам
- Почему отклонили: security requirement

## Последствия

### Положительные
- ✅ Защита от brute-force (login)
- ✅ Защита от DoS (upload)
- ✅ Защита admin endpoints
- ✅ Многоуровневая защита

### Отрицательные
- ⚠️ Возможны ложные срабатывания
- ⚠️ Нужен мониторинг срабатываний

### Нейтральные
- Логирование заблокированных запросов
- Метрики для анализа

## Ссылки

- [Nginx Rate Limiting](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html)
- [OWASP Rate Limiting](https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks)
- Phase 2 Completion Report
