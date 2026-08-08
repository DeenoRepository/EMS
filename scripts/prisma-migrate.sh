#!/bin/sh
set -e

echo "=== [EMS Migration Runner] Начало применения производственных миграций PostgreSQL ==="

# Проверка наличия DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "ОШИБКА: DATABASE_URL не задана!"
  exit 1
fi

echo "[1/3] Проверка генерации Prisma Client..."
npx prisma generate

echo "[2/3] Выполнение npx prisma migrate deploy..."
npx prisma migrate deploy

echo "[3/3] Накатывание базовых справочников (Seeding) если необходимо..."
if [ "$SEED_ON_MIGRATE" = "true" ]; then
  echo "Запуск DB Seed..."
  npm run db:seed
fi

echo "=== [EMS Migration Runner] Миграции успешно применены! ==="
