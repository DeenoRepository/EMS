# ADR-002: Интеграция LDAP через ldapjs

> **Статус:** Accepted  
> **Дата:** 2026-08-13  
> **Связано с:** SEC-11

## Контекст

Платформа EMS должна поддерживать аутентификацию через корпоративный Active Directory / LDAP. Ранее использовался mock-режим, который возвращал фиксированные роли для всех пользователей — это недопустимо для production.

Требования:
- Реальная аутентификация через LDAP/AD
- Маппинг AD групп на EMS роли
- Безопасное хранение credentials
- Graceful degradation если LDAP недоступен

## Решение

Использовать библиотеку `ldapjs` для интеграции с LDAP/AD серверами.

### Алгоритм аутентификации

```
1. Service Bind (опционально)
   └─► Подключение к LDAP с сервисным аккаунтом
       для поиска пользователя

2. User Search
   └─► Поиск DN пользователя по username
       с использованием LDAP_USER_SEARCH_FILTER

3. User Bind
   └─► Подключение от имени пользователя
       для проверки пароля

4. Group Search
   └─► Поиск групп пользователя
       с использованием LDAP_GROUP_SEARCH_FILTER

5. Role Mapping
   └─► Маппинг AD групп → EMS роли
       через LDAP_GROUP_ROLE_MAPPING
```

### Конфигурация

```bash
LDAP_URL=ldap://ldap.company.local:389
LDAP_BASE_DN=dc=company,dc=local
LDAP_BIND_DN=cn=ems-service,ou=service,dc=company,dc=local
LDAP_BIND_PASSWORD=<service-password>
LDAP_USER_SEARCH_FILTER=(sAMAccountName={{username}})
LDAP_GROUP_SEARCH_BASE=ou=groups,dc=company,dc=local
LDAP_GROUP_SEARCH_FILTER=(member={{userDn}})
LDAP_GROUP_ROLE_MAPPING="cn=admins,ou=groups,dc=company,dc=local:ADMIN;cn=editors,ou=groups,dc=company,dc=local:EDITOR"
```

### Безопасность

- Mock-режим только в development/test
- Динамический импорт ldapjs (не блокирует запуск)
- Timeout 5 секунд на подключение
- Подробное логирование всех операций
- Пароль не логируется

## Альтернативы

### Альтернатива 1: passport-ldapauth
- Плюсы: интеграция с Passport.js
- Минусы: дополнительная зависимость, менее гибкий
- Почему отклонили: нужен полный контроль над процессом

### Альтернатива 2: ldapts (TypeScript)
- Плюсы: нативная TypeScript поддержка
- Минусы: менее зрелая библиотека
- Почему отклонили: ldapjs проверен в production

### Альтернатива 3: SAML / OAuth
- Плюсы: современный подход
- Минусы: требует инфраструктуры IdP
- Почему отклонили: у заказчика только LDAP/AD

## Последствия

### Положительные
- ✅ Реальная интеграция с корпоративным AD
- ✅ Гибкий маппинг групп на роли
- ✅ Безопасное хранение credentials в env
- ✅ Graceful degradation

### Отрицательные
- ⚠️ Зависимость от доступности LDAP сервера
- ⚠️ Нужна сервисная учётка для поиска

### Нейтральные
- Новые env переменные
- Документация для администраторов AD

## Ссылки

- [ldapjs Documentation](https://ldapjs.org/)
- [LDAP RFC 4511](https://tools.ietf.org/html/rfc4511)
- Phase 2 Completion Report
