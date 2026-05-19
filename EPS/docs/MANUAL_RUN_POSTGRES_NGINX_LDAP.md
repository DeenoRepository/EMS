# Ручной запуск DEPS (PostgreSQL + LDAP + Nginx)

Инструкция составлена по текущему коду проекта (`Next.js 16`, `Prisma`, LDAP-провайдер в `lib/auth/provider.ts`).

## 1. Что важно по проекту

- Приложение использует только `PostgreSQL` (см. `prisma/schema.prisma`).
- При `AUTH_PROVIDER=ldap` логин без пароля запрещен (см. `app/api/auth/login/route.ts`).
- Для проверки состояния есть `GET /api/health` (проверяет `database`, `auth`, `storage`).
- В репозитории нет актуальных `docker-compose` файлов для prod-старта, поэтому ниже именно ручной режим.

## 2. Предусловия (Ubuntu 24.04)

Установите:

- `node` 22.x
- `npm`
- `postgresql`
- `nginx`
- (опционально для локального LDAP-стенда) `docker` + `docker compose`

Пример установки:

```bash
sudo apt update
sudo apt install -y ca-certificates curl nginx postgresql postgresql-contrib
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 3. Установка из локального каталога (без git clone)

Предполагается, что исходники сначала копируются в домашний каталог пользователя, например:

- `/home/<username>/eps-app`

Далее проект разворачивается в рабочий каталог `/opt/eps-app`.

Пример:

```bash
sudo mkdir -p /opt/eps-app
sudo rsync -a --delete /home/<username>/eps-app/ /opt/eps-app/
cd /opt/eps-app
npm ci
```

## 4. Настройка PostgreSQL

Создайте пользователя и БД:

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE deps_app LOGIN PASSWORD 'deps_app_password';
CREATE DATABASE deps_passport OWNER deps_app;
GRANT ALL PRIVILEGES ON DATABASE deps_passport TO deps_app;
SQL
```

Проверка подключения:

```bash
psql "postgresql://deps_app:deps_app_password@127.0.0.1:5432/deps_passport" -c "select 1;"
```

## 5. LDAP (вариант A: внешний корпоративный LDAP)

Если LDAP уже существует, подготовьте:

- `LDAP_URL`
- `LDAP_BIND_DN`
- `LDAP_BIND_PASSWORD`
- `LDAP_USER_BASE_DN`
- `LDAP_GROUP_BASE_DN`

Требования из кода:

- поиск пользователя: по `mail` или `uid` или `sAMAccountName`
- чтение групп: `cn`
- роли маппятся по группам:
  - `DEPS_Admins` -> `ADMIN`
  - `DEPS_Approvers` -> `APPROVER`
  - `DEPS_Editors` -> `EDITOR`
  - иначе -> `VIEWER`

## 6. LDAP (вариант B: локальный стенд через Docker)

Если нужен локальный стенд, поднимите OpenLDAP:

```bash
docker run -d --name deps-ldap \
  -p 3890:389 \
  -e LDAP_ORGANISATION="DEPS Enterprise" \
  -e LDAP_DOMAIN="enterprise.local" \
  -e LDAP_ADMIN_PASSWORD="admin" \
  osixia/openldap:1.5.0
```

Подготовьте тестовые записи (пример `seed.ldif`):

```ldif
dn: ou=people,dc=enterprise,dc=local
objectClass: organizationalUnit
ou: people

dn: ou=groups,dc=enterprise,dc=local
objectClass: organizationalUnit
ou: groups

dn: uid=admin,ou=people,dc=enterprise,dc=local
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: top
cn: Admin User
sn: User
uid: admin
mail: admin@enterprise.local
uidNumber: 10001
gidNumber: 10001
homeDirectory: /home/admin
userPassword: admin

dn: cn=DEPS_Admins,ou=groups,dc=enterprise,dc=local
objectClass: groupOfNames
cn: DEPS_Admins
member: uid=admin,ou=people,dc=enterprise,dc=local
```

Загрузите LDIF:

```bash
ldapadd -x -H ldap://127.0.0.1:3890 \
  -D "cn=admin,dc=enterprise,dc=local" -w admin \
  -f seed.ldif
```

Проверка:

```bash
ldapsearch -x -H ldap://127.0.0.1:3890 \
  -D "cn=admin,dc=enterprise,dc=local" -w admin \
  -b "ou=people,dc=enterprise,dc=local" "(uid=admin)"
```

## 7. Переменные окружения приложения

Создайте `.env` в корне проекта:

```env
APP_NAME=DEPS Equipment Passport
NODE_ENV=production
PORT=3000

DATABASE_URL=postgresql://deps_app:deps_app_password@127.0.0.1:5432/deps_passport?schema=public&sslmode=disable

AUTH_PROVIDER=ldap
NEXT_PUBLIC_AUTH_PROVIDER=ldap

LDAP_URL=ldap://127.0.0.1:3890
LDAP_BIND_DN=cn=admin,dc=enterprise,dc=local
LDAP_BIND_PASSWORD=admin
LDAP_BASE_DN=dc=enterprise,dc=local
LDAP_USER_BASE_DN=ou=people,dc=enterprise,dc=local
LDAP_GROUP_BASE_DN=ou=groups,dc=enterprise,dc=local

STORAGE_DRIVER=local
LOCAL_STORAGE_MODE=UPLOADS
MAX_UPLOAD_BYTES=20971520
ALLOWED_UPLOAD_MIME_TYPES=application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg

ENABLE_DEBUG_AUTH_ROUTES=false
NEXT_PUBLIC_ENABLE_DEBUG_AUTH_ROUTES=false
NEXT_PUBLIC_ENABLE_LDAP_DEBUG=false
```

Примечание: для локального запуска лучше `LOCAL_STORAGE_MODE=UPLOADS`, чтобы `health` не зависел от сетевой шары.

## 8. Миграции, сиды, сборка

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
npm run build
```

Проверка локального старта:

```bash
npm run start
curl -fsS http://127.0.0.1:3000/api/health
```

## 9. Systemd сервис

Создайте `/etc/systemd/system/eps-app.service`:

```ini
[Unit]
Description=DEPS Equipment Passport
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/eps-app
EnvironmentFile=/opt/eps-app/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=30
Environment=NEXT_TELEMETRY_DISABLED=1

[Install]
WantedBy=multi-user.target
```

Активация:

```bash
sudo systemctl daemon-reload
sudo systemctl enable eps-app
sudo systemctl restart eps-app
sudo systemctl status eps-app --no-pager
```

## 10. Nginx reverse proxy

Создайте `/etc/nginx/sites-available/eps-app.conf`:

```nginx
server {
  listen 80;
  listen [::]:80;
  server_name _;

  client_max_body_size 25M;

  location / {
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_pass http://127.0.0.1:3000;
  }
}
```

Подключите конфиг:

```bash
sudo ln -sfn /etc/nginx/sites-available/eps-app.conf /etc/nginx/sites-enabled/eps-app.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

## 11. Финальные проверки

1. Проверить приложение:
   ```bash
   curl -i http://127.0.0.1/api/health
   ```
2. Проверить вход:
   - открыть `http://<host>/login`
   - ввести LDAP-логин и пароль
3. Проверить логи:
   ```bash
  sudo journalctl -u eps-app -n 200 --no-pager
   sudo tail -n 200 /var/log/nginx/error.log
   ```

## 12. Частые проблемы

- `401 Неверный логин или пароль`:
  - пользователь не найден по `mail/uid/sAMAccountName`
  - неверный пароль
  - нет доступа bind-пользователя к нужному `userBase/groupBase`
- `/api/health` отдает `503`:
  - недоступен PostgreSQL или LDAP
  - нет прав записи в путь хранилища
- Prisma ошибки подключения:
  - проверьте `DATABASE_URL` и доступность БД на `127.0.0.1:5432`
