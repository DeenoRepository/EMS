#!/bin/sh
set -e

BACKUP_DIR="${BACKUP_DIR:-/tmp/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/ems_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "=== [EMS DB Backup] Начало бэкапа PostgreSQL ==="

pg_dump -h "${POSTGRES_HOST:-postgres}" -U "${POSTGRES_USER:-ems_user}" -d "${POSTGRES_DB:-ems_db}" | gzip > "$BACKUP_FILE"

echo "[EMS DB Backup] Дамп успешно создан: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Если сконфигурированы ключи S3, отправляем бэкап в объектное хранилище
if [ -n "$S3_BUCKET" ] && command -v aws >/dev/null 2>&1; then
  echo "[EMS DB Backup] Загрузка бэкапа в S3: s3://${S3_BUCKET}/backups/"
  aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/backups/" --endpoint-url "${S3_ENDPOINT:-https://s3.amazonaws.com}"
fi

# Ротация локальных копий (оставляем файлы за последние 7 дней)
find "$BACKUP_DIR" -type f -name "ems_backup_*.sql.gz" -mtime +7 -delete

echo "=== [EMS DB Backup] Резервное копирование завершено успешно! ==="
