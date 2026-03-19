# Полная инструкция по запуску на сервере

Документ описывает развёртывание всех компонентов проекта на сервере:

1. **post-stock-pro** — Next.js приложение (веб + Telegram Mini App + webhook бота)
2. **vibe-marketing-cli** — Python консольное приложение (поиск групп, сбор базы, приглашения)
3. **Telegram-бот** — webhook (production) или polling (разработка)

---

## Содержание

- [1. Обзор компонентов](#1-обзор-компонентов)
- [2. post-stock-pro (Next.js)](#2-post-stock-pro-nextjs)
- [3. vibe-marketing-cli (Python)](#3-vibe-marketing-cli-python)
- [4. Telegram-бот](#4-telegram-бот)
- [5. PM2: все процессы вместе](#5-pm2-все-процессы-вместе)
- [6. Чек-лист](#6-чек-лист)

---

## 1. Обзор компонентов

| Компонент | Технологии | Назначение |
|-----------|------------|------------|
| post-stock-pro | Next.js, TypeORM, PostgreSQL | Веб-приложение, Mini App, API, webhook бота |
| vibe-marketing-cli | Python, Telethon, SQLite | Поиск групп, сбор базы продавцов, приглашения в канал |
| Telegram-бот | Telegraf | Webhook через Next.js (production) или polling (разработка) |

**Важно:** В production бот работает через webhook (встроен в Next.js). Polling (`npm run bot:polling`) — только для локальной разработки, когда webhook недоступен.

---

## 2. post-stock-pro (Next.js)

Подробная инструкция: [SERVER_DEPLOYMENT.md](./SERVER_DEPLOYMENT.md).

### Кратко

```bash
# Клонирование и установка
cd /var/www
git clone <URL_РЕПОЗИТОРИЯ> post-stock-pro
cd post-stock-pro
npm install --production

# Настройка .env
cp .env.example .env
nano .env  # DB_*, TELEGRAM_BOT_TOKEN, SESSION_SECRET, TELEGRAM_WEBHOOK_URL

# Миграции и сборка
npm run db:migrate
npm run build

# Запуск (через PM2 — см. раздел 5)
npm run start
```

---

## 3. vibe-marketing-cli (Python)

Консольное приложение для вайб-маркетинга: поиск групп, сбор базы, приглашения в канал. Работает с прокси и многопоточно.

### 3.1. Требования

- Python 3.10+
- pip

### 3.2. Установка

```bash
cd /var/www/post-stock-pro/vibe-marketing-cli
pip install -r requirements.txt
```

### 3.3. Настройка

```bash
# Скопировать примеры конфигов
cp config/settings.json.example config/settings.json
cp config/accounts.json.example config/accounts.json

# Создать groups.txt (если нужен ручной список групп)
touch config/groups.txt
```

**config/settings.json:**
- `telegram_index_api_key` — ключ RapidAPI для Telegram Index (опционально)
- `proxies` — источник прокси: `files` (proxies.txt), `list` (массив в JSON) или `both`

**config/accounts.json:**
- `api_id`, `api_hash` — с [my.telegram.org](https://my.telegram.org)
- `phone` — номер в формате +375291234567
- `proxy` — прокси для аккаунта (опционально)

**config/proxies.txt** (если `source: "files"`):
- Один прокси на строку: `socks5://user:pass@host:1080` или `http://user:pass@host:8080`

Подробнее: [vibe-marketing-cli/config/CONFIG.md](../vibe-marketing-cli/config/CONFIG.md)

### 3.4. Запуск

**Интерактивный режим (меню):**
```bash
cd /var/www/post-stock-pro/vibe-marketing-cli
python main.py
```

**Через PM2 (фоновый режим):**
PM2 не подходит для интерактивного меню. Для автоматических задач используйте cron или systemd с отдельными скриптами.

**Через systemd (опционально, для неинтерактивных задач):**
```bash
sudo nano /etc/systemd/system/vibe-marketing.service
```

```ini
[Unit]
Description=Vibe Marketing CLI
After=network.target

[Service]
Type=simple
User=telegram-app
WorkingDirectory=/var/www/post-stock-pro/vibe-marketing-cli
ExecStart=/usr/bin/python3 main.py
Restart=on-failure
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

Для интерактивного использования лучше запускать вручную в screen/tmux:
```bash
screen -S vibe
cd /var/www/post-stock-pro/vibe-marketing-cli
python main.py
# Ctrl+A, D — отключиться; screen -r vibe — вернуться
```

### 3.5. Многопоточность и прокси

- **Поиск групп** — запросы к Telegram Index API идут параллельно через пул прокси
- **Сбор базы** — группы парсятся параллельно (`asyncio.gather` + `Semaphore`)
- **Назначить прокси аккаунтам** — пункт 7 в меню, перераспределяет прокси из пула по аккаунтам

---

## 4. Telegram-бот

### 4.1. Production: webhook

В production бот работает через webhook, встроенный в Next.js. Никакого отдельного процесса не требуется.

1. Убедитесь, что в `.env` указано:
   ```
   TELEGRAM_WEBHOOK_URL=https://ваш_домен.com/api/telegram/webhook
   ```

2. Установите webhook:
   ```bash
   curl "https://ваш_домен.com/api/telegram/webhook?setWebhook=true"
   ```

3. Проверка:
   ```bash
   curl "https://api.telegram.org/botВАШ_ТОКЕН/getWebhookInfo"
   ```

### 4.2. Разработка: polling

Когда webhook недоступен (локальная разработка без туннеля):

```bash
cd /var/www/post-stock-pro
npm run bot:polling
```

Polling-бот поддерживает те же функции, что и webhook, включая:
- Генерация постов
- **Excel** — кнопка «📊 Excel» в меню поста, отправка таблицы в чат
- Профиль, подписка, рефералы и т.д.

**Важно:** Не запускайте webhook и polling одновременно — Telegram доставит обновления только одному.

---

## 5. PM2: все процессы вместе

### 5.1. Рекомендуемая конфигурация

Создайте `ecosystem.config.js` в корне post-stock-pro:

```javascript
module.exports = {
  apps: [
    {
      name: 'post-stock-pro',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/var/www/post-stock-pro',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/www/post-stock-pro/logs/app-error.log',
      out_file: '/var/www/post-stock-pro/logs/app-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G',
      watch: false
    }
    // vibe-marketing-cli — НЕ через PM2 (интерактивное меню)
    // Бот — встроен в post-stock-pro через webhook
  ]
};
```

### 5.2. Polling-бот как отдельный процесс (только для dev)

Если нужен polling на сервере (например, для тестов без webhook):

```javascript
{
  name: 'telegram-bot-polling',
  script: 'node_modules/tsx/dist/cli.mjs',
  args: 'src/scripts/telegram-bot-polling.ts',
  cwd: '/var/www/post-stock-pro',
  instances: 1,
  autorestart: true,
  env: { NODE_ENV: 'production' },
  error_file: '/var/www/post-stock-pro/logs/bot-error.log',
  out_file: '/var/www/post-stock-pro/logs/bot-out.log'
}
```

**Перед запуском polling:** удалите webhook:
```bash
curl "https://api.telegram.org/botВАШ_ТОКЕН/deleteWebhook"
```

### 5.3. Запуск

```bash
mkdir -p /var/www/post-stock-pro/logs
cd /var/www/post-stock-pro
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 6. Чек-лист

### post-stock-pro
- [ ] Node.js 18+ установлен
- [ ] PostgreSQL настроен, миграции выполнены
- [ ] `.env` создан (DB_*, TELEGRAM_BOT_TOKEN, SESSION_SECRET, TELEGRAM_WEBHOOK_URL)
- [ ] `npm run build` успешен
- [ ] PM2 запускает приложение
- [ ] Nginx проксирует на порт 3000
- [ ] SSL настроен (HTTPS)

### Telegram-бот (webhook)
- [ ] Webhook установлен (`/api/telegram/webhook?setWebhook=true`)
- [ ] Бот отвечает на /start

### vibe-marketing-cli
- [ ] Python 3.10+, зависимости установлены
- [ ] `config/settings.json` и `config/accounts.json` настроены
- [ ] Прокси настроены (если нужны)
- [ ] Запуск в screen/tmux для интерактивного использования

### Polling (только dev)
- [ ] Webhook удалён перед запуском polling
- [ ] `npm run bot:polling` работает

---

## Ссылки

- [SERVER_DEPLOYMENT.md](./SERVER_DEPLOYMENT.md) — детальная инструкция по post-stock-pro
- [vibe-marketing-cli/README.md](../vibe-marketing-cli/README.md) — описание консольного приложения
- [vibe-marketing-cli/config/CONFIG.md](../vibe-marketing-cli/config/CONFIG.md) — настройка прокси и аккаунтов
