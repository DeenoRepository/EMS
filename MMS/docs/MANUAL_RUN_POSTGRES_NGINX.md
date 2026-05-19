# Ручной запуск TOiR (PostgreSQL + Nginx)

## 1. Подготовка
1. Скопируйте `.env.example` в `.env`.
2. Укажите `DATABASE_URL` и `EPS_API_BASE_URL`.
3. Установите зависимости и примените Prisma:
   - `npm install`
   - `npm run prisma:generate`
   - `npm run prisma:migrate`
   - `npm run prisma:seed`

## 2. Запуск
- Dev: `npm run dev`
- Prod build: `npm run build && npm run start`

## 3. Nginx reverse proxy (пример)
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

## 4. Проверка
- `GET /api/health`
- `GET /api/integrations/eps/equipment?page=1&pageSize=10`
