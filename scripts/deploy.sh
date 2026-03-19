#!/bin/bash
# Скрипт деплоя на VPS
# Использование: ./scripts/deploy.sh

set -e

echo "=== Deploy Telegram Seller ==="

# 1. Обновление кода
echo ">>> git pull"
git pull

# 2. Установка зависимостей
echo ">>> npm ci"
npm ci

# 3. Сборка
echo ">>> npm run build"
NODE_ENV=production npm run build

# 4. Миграции БД (рекомендуется сделать backup перед этим)
echo ">>> Миграции БД"
echo "ВНИМАНИЕ: Перед миграциями рекомендуется создать backup: pg_dump -U \$DB_USER \$DB_NAME > backup_\$(date +%Y%m%d_%H%M).sql"
read -p "Выполнить миграции? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  npm run db:migrate
else
  echo "Миграции пропущены."
fi

# 5. Перезапуск PM2
echo ">>> pm2 restart telegram-seller telegram-bot-polling"
pm2 restart telegram-seller telegram-bot-polling || pm2 start ecosystem.config.js

echo "=== Deploy завершён ==="
