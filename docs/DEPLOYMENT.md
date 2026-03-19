# Деплой на VPS

Руководство по развёртыванию Telegram Seller MVP на собственном сервере (VPS).

## Требования

- **Node.js** 18+ (рекомендуется 20 LTS)
- **PostgreSQL** 14+
- **PM2** (процесс-менеджер)
- **Nginx** (reverse proxy, SSL)
- Домен с настроенным DNS

## 1. Подготовка сервера

```bash
# Обновление системы (Ubuntu/Debian)
sudo apt update && sudo apt upgrade -y

# Установка Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Установка PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Установка PM2 глобально
sudo npm install -g pm2

# Установка Nginx
sudo apt install -y nginx
```

## 2. База данных

```bash
# Переключение на пользователя postgres
sudo -u postgres psql

# В psql:
CREATE DATABASE telegram_seller;
CREATE USER telegram_user WITH ENCRYPTED PASSWORD 'ваш_надёжный_пароль';
GRANT ALL PRIVILEGES ON DATABASE telegram_seller TO telegram_user;
\q
```

## 3. Клонирование и настройка проекта

```bash
cd /var/www  # или другая директория
git clone <url-репозитория> telegram-seller
cd telegram-seller
```

### Переменные окружения

```bash
cp .env.example .env
nano .env
```

Заполните:

| Переменная | Описание |
|------------|----------|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | Минимум 32 символа. Генерация: `openssl rand -hex 32` |
| `DB_HOST` | `localhost` (если PostgreSQL на том же сервере) |
| `DB_PORT` | `5432` |
| `DB_USER` | `telegram_user` |
| `DB_PASSWORD` | Пароль из шага 2 |
| `DB_NAME` | `telegram_seller` |
| `TELEGRAM_BOT_TOKEN` | Токен от BotFather |
| `TELEGRAM_BOT_USERNAME` | Username бота |
| `TELEGRAM_MINI_APP_URL` | `https://ваш-домен.com` |
| `TELEGRAM_WEBHOOK_URL` | Только если бот на **webhook** (см. ниже). Иначе можно не задавать. |
| `TELEGRAM_WEBHOOK_SECRET` | Обязателен при использовании webhook (32+ символов). При **long polling** (PM2 `telegram-bot-polling`) не нужен. |
| `CRON_SECRET` | Секрет для cron. Генерация: `openssl rand -hex 32` |

В `.env` не дублируйте одни и те же переменные — сработает непредсказуемое значение.

## 4. Установка и сборка

```bash
npm ci
npm run build
npm run db:migrate
```

Приложение в production **не подгружает** файлы `src/lib/db/migrations/*.ts` при старте (это делает только `npm run db:migrate` через `tsx`). Иначе Node падал бы с `SyntaxError` при `initialize()`.

Если после `git pull` странные ошибки API или «старый» фронт — пересоберите с нуля:

```bash
rm -rf .next && npm run build
```

## 5. Запуск через PM2

```bash
npm run pm2:start
# или
pm2 start ecosystem.config.js
```

Проверка:

```bash
pm2 status
pm2 logs telegram-seller
```

Автозапуск при перезагрузке сервера:

```bash
pm2 startup
pm2 save
```

## 6. Nginx и SSL

### Установка Certbot (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Конфигурация Nginx

1. **DNS** уже указывает на IP сервера (A-записи для `@` и `www`).
2. Отключите дефолтный сайт, чтобы не видеть «Welcome to nginx»:
   ```bash
   sudo rm -f /etc/nginx/sites-enabled/default
   ```
3. **Первый раз (до сертификата):** удобнее поднять **только порт 80** с `proxy_pass` на `127.0.0.1:3000` и **без** редиректа на HTTPS — см. комментарий «Первый выпуск сертификата» в `docs/nginx.conf.example`. После успешного `certbot --nginx` Certbot допишет SSL и редирект с 80.
4. Либо скопируйте полный пример с редиректом и сразу запустите Certbot (если домен уже открывается по HTTP):
   ```bash
   sudo cp docs/nginx.conf.example /etc/nginx/sites-available/telegram-seller
   sudo nano /etc/nginx/sites-available/telegram-seller   # server_name → ваш домен
   sudo ln -sf /etc/nginx/sites-available/telegram-seller /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d ваш-домен.com -d www.ваш-домен.com
   ```

Убедитесь, что в блоке `listen 443 ssl` для вашего домена есть `location / { proxy_pass http://127.0.0.1:3000; ... }`, а не только статика.

## 7. Telegram: webhook или long polling

По умолчанию в `ecosystem.config.js` бот работает в режиме **long polling** (`telegram-bot-polling`). Отдельно регистрировать webhook **не нужно**, переменные `TELEGRAM_WEBHOOK_*` можно не задавать.

Если переключитесь на **webhook**, после запуска приложения зарегистрируйте его (нужен `TELEGRAM_WEBHOOK_SECRET`):

```bash
curl "https://ваш-домен.com/api/telegram/webhook?setWebhook=true&secret=ВАШ_TELEGRAM_WEBHOOK_SECRET"
```

Или через Authorization заголовок:

```bash
curl -H "Authorization: Bearer ВАШ_TELEGRAM_WEBHOOK_SECRET" \
  "https://ваш-домен.com/api/telegram/webhook?setWebhook=true"
```

Webhook будет установлен с secret_token — Telegram будет отправлять его в заголовке X-Telegram-Bot-Api-Secret-Token для проверки.

В BotFather укажите URL Mini App: `https://ваш-домен.com`

## 8. Создание админа

```bash
npm run make-admin
# Следуйте инструкциям (укажите telegramId или email)
```

## 9. Cron (уведомления о триале)

На VPS cron не выполняется автоматически. Добавьте в crontab:

```bash
crontab -e
```

Строка (ежедневно в 10:00):

```
0 10 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://ваш-домен.com/api/cron/trial-end-notification
```

Для передачи `CRON_SECRET` создайте скрипт `scripts/cron-trial.sh`:

```bash
#!/bin/bash
source /var/www/telegram-seller/.env 2>/dev/null || true
curl -s -H "Authorization: Bearer $CRON_SECRET" https://ваш-домен.com/api/cron/trial-end-notification
```

И в crontab: `0 10 * * * /var/www/telegram-seller/scripts/cron-trial.sh`

## 10. Резервное копирование БД

Создайте скрипт `scripts/backup-db.sh`:

```bash
#!/bin/bash
source /var/www/telegram-seller/.env 2>/dev/null || true
BACKUP_DIR="/var/backups/telegram-seller"
mkdir -p "$BACKUP_DIR"
pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M).sql"
# Удаление старых бэкапов (старше 7 дней)
find "$BACKUP_DIR" -name "backup_*.sql" -mtime +7 -delete
```

Добавьте в crontab (ежедневно в 3:00): `0 3 * * * /var/www/telegram-seller/scripts/backup-db.sh`

## 11. Обновление приложения

Используйте скрипт деплоя:

```bash
./scripts/deploy.sh
```

Или вручную:

1. Включите режим обслуживания через `/admin/server` (опционально)
2. `git pull`
3. `npm ci`
4. Создайте backup БД: `pg_dump -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d).sql`
5. `npm run db:migrate`
6. `npm run build`
7. `pm2 restart telegram-seller`

Подробнее см. [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md).

## Режим обслуживания

Для обновления без простоя:

1. В админ-панели `/admin/server` включите режим обслуживания
2. Выполните обновление
3. Выключите режим обслуживания

Переменные окружения: `MAINTENANCE_MODE=true`, `MAINTENANCE_MESSAGE=...` (для быстрого включения без доступа к БД).
