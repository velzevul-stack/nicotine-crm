#!/bin/bash
# Резервное копирование PostgreSQL
# Использование: ./scripts/backup-db.sh
# Рекомендуется добавить в crontab: 0 3 * * * /path/to/scripts/backup-db.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/telegram-seller}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Загрузка .env (если есть)
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M).sql"

echo "Backup: $BACKUP_FILE"
pg_dump -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"

# Удаление старых бэкапов
find "$BACKUP_DIR" -name "backup_*.sql" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

echo "Done."
