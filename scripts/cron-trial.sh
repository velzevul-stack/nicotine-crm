#!/bin/bash
# Вызов cron endpoint для уведомлений об окончании триала
# Использование: ./scripts/cron-trial.sh
# Добавьте в crontab: 0 10 * * * /path/to/scripts/cron-trial.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
APP_URL="${TELEGRAM_MINI_APP_URL:-https://localhost:3000}"

# Загрузка .env
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

if [ -z "$CRON_SECRET" ]; then
  echo "CRON_SECRET not set" >&2
  exit 1
fi

curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/trial-end-notification"
