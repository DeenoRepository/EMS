# ADR-005: HTTPS Termination в Nginx

> **Статус:** Accepted  
> **Дата:** 2026-08-13  
> **Связано с:** SEC-13

## Контекст

Приложение работало только по HTTP, что недопустимо для production:
- Данные передаются в открытом виде
- Cookies могут быть перехвачены
- Нет защиты от MITM атак
- Браузеры помечают сайт как небезопасный

## Решение

Настроить SSL/TLS termination на nginx с автоматическим редиректом HTTP → HTTPS.

### Архитектура

```
Internet
    │
    ▼
┌─────────────────┐
│   Nginx :443    │──── TLS termination
│   (SSL/HTTPS)   │──── HSTS, CSP headers
└────────┬────────┘
         │ HTTP (internal)
         ▼
┌─────────────────┐
│   EMS App :3000 │
│   (Next.js)     │
└─────────────────┘
```

### Конфигурация

- **SSL протоколы**: TLS 1.2, TLS 1.3
- **Cipher suites**: только современные (ECDHE)
- **HSTS**: max-age=63072000 (2 года), includeSubDomains, preload
- **OCSP Stapling**: включён
- **SSL Session Cache**: shared, 10MB

### HTTP → HTTPS редирект

```nginx
server {
    listen 80;
    server_name _;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}
```

### Исключения

- ACME challenge для Let's Encrypt
- Health check endpoint (для Docker)

## Альтернативы

### Альтернатива 1: TLS termination в Next.js
- Плюсы: меньше компонентов
- Минусы: нагрузка на приложение, сложнее настройка
- Почему отклонили: nginx стандарт для production

### Альтернатива 2: Cloud Load Balancer
- Плюсы: managed решение
- Минусы: vendor lock-in
- Почему отклонили: on-premise deployment

### Альтернатива 3: Certbot в отдельном контейнере
- Плюсы: автоматическое обновление
- Минусы: сложность
- Почему отклонили: можно добавить позже

## Последствия

### Положительные
- ✅ Шифрование всего трафика
- ✅ Защита от MITM атак
- ✅ HSTS для предотвращения downgrade атак
- ✅ Современные cipher suites

### Отрицательные
- ⚠️ Нужны SSL сертификаты
- ⚠️ Дополнительный компонент (nginx)

### Нейтральные
- ACME challenge для Let's Encrypt
- Документация по обновлению сертификатов

## Ссылки

- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [HSTS Preload](https://hstspreload.org/)
- Phase 2 Completion Report
