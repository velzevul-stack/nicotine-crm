# Telegram Seller MVP

Mini-приложение в Telegram для продавцов: учёт остатков, формирование постов, продажи, долги и отчётность.

**Стек:** Next.js 14 (App Router) + TypeORM + PostgreSQL + shadcn/ui

## Быстрый старт

### 1. PostgreSQL

Создайте базу данных:

```bash
psql -U postgres -c "CREATE DATABASE telegram_seller;"
```

### 2. Переменные окружения

Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

Заполните:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — параметры PostgreSQL
- `TELEGRAM_BOT_TOKEN` — для валидации initData (в dev можно не указывать)
- `SESSION_SECRET` — секретный ключ для подписи сессий (минимум 32 символа, обязательно для production)

### 3. Установка и запуск

```bash
npm install
npm run dev
```

Приложение будет на http://localhost:3000 (или https://localhost:3000 при `npm run dev` с server.js).

**Примечание:** `npm run dev` использует server.js с HTTPS (mkcert) — только для локальной разработки с Telegram Mini App. Для production см. раздел ниже.

В режиме разработки при первом запросе выполнится `synchronize` (создание таблиц).  
Для входа без Telegram откройте `/login` — будет выполнен dev‑вход (создаётся тестовый пользователь и сессия).

### 4. Наполнение тестовыми данными

```bash
npm run db:seed
```

Создаётся магазин, категории, бренды, продукты и остатки.

### 5. Тестирование пустого состояния (для нового пользователя)

Для проверки, как приложение выглядит у нового пользователя без данных:

```bash
npm run db:clear
```

⚠️ **ВНИМАНИЕ:** Эта команда удаляет ВСЕ данные из базы данных!

После очистки:
1. Запустите приложение: `npm run dev`
2. Откройте `/login` для входа (создастся новый пользователь)
3. Протестируйте пустое состояние приложения

Для восстановления тестовых данных: `npm run db:seed`

Подробнее см. [TESTING_EMPTY_STATE.md](./docs/TESTING_EMPTY_STATE.md)

## Структура проекта

```
src/
├── app/                    # Next.js App Router
│   ├── (seller)/           # Защищённые страницы с нижней навигацией
│   │   ├── page.tsx        # Дашборд
│   │   ├── inventory/      # Склад
│   │   ├── post/           # Пост в чат
│   │   ├── sales/          # Продажи
│   │   ├── debts/          # Долги
│   │   ├── reports/        # Отчёты
│   │   └── profile/        # Профиль и настройки
│   ├── admin/              # Админ-панель
│   │   ├── page.tsx        # Статистика
│   │   ├── users/          # Управление пользователями
│   │   ├── support/        # Чат поддержки
│   │   ├── formats/        # Форматы постов
│   │   └── suggestions/    # Предложения форматов
│   ├── api/                # API-маршруты
│   │   ├── auth/           # Авторизация (Telegram + dev)
│   │   ├── inventory/      # Склад, остатки
│   │   ├── sales/          # Продажи
│   │   ├── debts/          # Долги
│   │   ├── reports/        # Агрегация по дням
│   │   ├── post/           # Генерация поста
│   │   ├── support/        # Чат поддержки
│   │   ├── admin/          # Админ API
│   │   └── telegram/       # Webhook для Telegram бота
│   └── login/              # Страница входа
├── components/             # UI-компоненты
├── lib/
│   ├── db/                 # TypeORM: DataSource, entities
│   ├── auth.ts             # Сессия
│   ├── auth-utils.ts       # Проверка подписки и доступа
│   └── api-client.ts       # HTTP-клиент
└── scripts/
    └── seed.ts             # Сид БД
```

## API

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/auth/telegram` | Вход по initData Telegram |
| POST | `/api/auth/dev` | Dev‑вход (только development) |
| GET | `/api/inventory` | Склад: дерево категорий/брендов/форматов/вкусов |
| PATCH | `/api/inventory/stock` | Обновить остаток по flavorId |
| POST | `/api/sales` | Создать продажу |
| GET | `/api/sales` | Список продаж |
| GET | `/api/debts` | Список должников |
| POST | `/api/debts` | Принять оплату по долгу |
| GET | `/api/reports` | Отчёты по дням |
| POST | `/api/post/generate` | Сгенерировать текст поста |

## Авторизация

- **Telegram:** отправьте `initData` из `window.Telegram.WebApp.initData` на `POST /api/auth/telegram`. Сервер проверяет подпись по `TELEGRAM_BOT_TOKEN` и создаёт/находит User + Shop.
- **Dev:** без initData при `NODE_ENV=development` вызывается `/api/auth/dev`, создаётся тестовый пользователь и сессия в cookie.

## Production (VPS)

Для развёртывания на собственном сервере см. **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** — полное руководство по:

- Установке Node.js, PostgreSQL, PM2, Nginx
- Настройке переменных окружения
- Запуску через PM2
- Настройке SSL (Let's Encrypt) и reverse proxy
- Регистрации Telegram webhook
- Cron для уведомлений о триале
- Резервному копированию БД
