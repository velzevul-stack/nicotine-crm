# Техническое задание: полная копия проекта Post Stock Pro (Backend)

## 1. Общие сведения

### 1.1 Назначение системы
Telegram Mini App для учёта товаров, продаж, резервов, долгов и формирования постов для малого бизнеса (продавцы вейп/никотиновой продукции и аналогичных товаров).

### 1.3 Использование эмодзи
- **Интерфейс (UI):** эмодзи не используются. Все элементы интерфейса — кнопки, меню, заголовки, списки, формы — только текст без эмодзи.
- **Посты:** эмодзи допускаются и используются. Поля `Category.emoji` и `Brand.emojiPrefix` применяются при генерации текста поста через шаблонизатор. Пользователь может задавать эмодзи в шаблонах форматов постов.

### 1.2 Технологический стек
- **Runtime:** Node.js
- **Framework:** Next.js 16 (App Router)
- **База данных:** PostgreSQL
- **ORM:** TypeORM (EntitySchema)
- **Валидация:** Zod
- **Telegram Bot:** Telegraf
- **Авторизация:** Cookie-based signed sessions (HMAC-SHA256)
- **Сервер:** Custom HTTPS (Node.js `createServer`) с mkcert для Telegram Mini App

---

## 2. Архитектура и инфраструктура

### 2.1 Сервер
- Порт по умолчанию: 3000
- HTTPS обязателен для Telegram Mini App (сертификаты mkcert: `localhost.pem`, `localhost-key.pem`)
- Режим разработки: `node server.js` (HTTPS) или `next dev` (HTTP)
- Production: `next build` + `next start`

### 2.2 Переменные окружения
| Переменная | Назначение |
|------------|------------|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Параметры PostgreSQL |
| `TELEGRAM_BOT_TOKEN` | Токен бота для валидации initData и webhook |
| `TELEGRAM_BOT_USERNAME` | Username бота |
| `TELEGRAM_MINI_APP_URL` | URL Mini App (HTTPS) |
| `TELEGRAM_WEBHOOK_URL` | URL webhook для бота |
| `SESSION_SECRET` | Секрет для подписи сессий (минимум 32 символа) |
| `CRON_SECRET` | Секрет для защиты cron endpoints |
| `NODE_ENV` | development / production |

---

## 3. Модель данных (сущности)

### 3.1 Иерархия товаров
```
Category → Brand → ProductFormat → Flavor → StockItem
```

### 3.2 User (пользователь)
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| telegramId | string | Уникальный ID в Telegram |
| firstName, lastName, username | string \| null | Данные из Telegram |
| role | enum | `admin` \| `seller` \| `client` |
| accessKey | string \| null | Уникальный ключ входа (KEY-xxx) |
| subscriptionStatus | enum | `trial` \| `active` \| `expired` |
| trialEndsAt | Date \| null | Конец триала |
| subscriptionEndsAt | Date \| null | Конец подписки |
| referralCode | string \| null | Уникальный реферальный код |
| referrerId | string \| null | ID пригласившего пользователя |
| isActive | boolean | Активность аккаунта |
| createdAt, updatedAt | Date | |

### 3.3 Shop (магазин)
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| name | string | Название |
| timezone | string | Часовой пояс (по умолчанию Europe/Minsk) |
| ownerId | UUID | FK → User |
| currency | string | Валюта (по умолчанию BYN) |
| address | string \| null | Адрес |
| supportTelegramUsername | string \| null | Username поддержки |
| country, city, region | string \| null | Геолокация |
| defaultPostFormatId | string \| null | ID формата поста по умолчанию |
| createdAt, updatedAt | Date | |

### 3.4 UserShop (связь пользователь–магазин)
| Поле | Тип | Описание |
|------|-----|----------|
| userId | UUID | FK → User |
| shopId | UUID | FK → Shop |
| roleInShop | enum | `owner` \| `seller` |

### 3.5 Category (категория)
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| shopId | UUID | FK → Shop |
| name | string | Название |
| sortOrder | number | Порядок сортировки |
| emoji | string | Эмодзи для постов (по умолчанию 📦). Используется только при генерации поста, не в интерфейсе. |
| customFields | jsonb | Массив CategoryField (id, name, label, type, required, options, sortOrder, target) |
| createdAt, updatedAt | Date | |

**CategoryField:** `type`: `text` \| `number` \| `select`, `target`: `flavor_name` \| `strength_label` \| `custom`

### 3.6 Brand (бренд)
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| shopId | UUID | FK → Shop |
| categoryId | UUID | FK → Category |
| name | string | Название |
| emojiPrefix | string | Префикс-эмодзи для постов. Используется только при генерации поста, не в интерфейсе. |
| sortOrder | number | Порядок сортировки |
| createdAt, updatedAt | Date | |

### 3.7 ProductFormat (формат товара)
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| shopId | UUID | FK → Shop |
| brandId | UUID | FK → Brand |
| name | string | Название |
| strengthLabel | string | Крепость (например, 20mg) |
| unitPrice | number | Цена за единицу |
| isLiquid | boolean | Жидкость (по умолчанию true) |
| customValues | jsonb | Произвольные поля |
| isActive | boolean | Активность |
| createdAt, updatedAt | Date | |

### 3.8 Flavor (вкус/вариант)
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| shopId | UUID | FK → Shop |
| productFormatId | UUID | FK → ProductFormat |
| name | string | Название (цвет, вкус и т.п.) |
| sku | string \| null | Артикул |
| barcode | string \| null | Штрихкод |
| customValues | jsonb | Произвольные поля |
| isActive | boolean | Активность |
| createdAt, updatedAt | Date | |

### 3.9 StockItem (остаток)
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| shopId | UUID | FK → Shop |
| flavorId | UUID | FK → Flavor |
| quantity | number | Доступное количество |
| reservedQuantity | number | Зарезервированное количество |
| costPrice | number | Себестоимость |
| minThreshold | number \| null | Минимальный порог остатка |
| updatedAt, createdAt | Date | |

**Доступно для продажи:** `quantity - reservedQuantity`

### 3.10 Sale (продажа/резерв)
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| shopId | UUID | FK → Shop |
| sellerId | UUID | FK → User |
| datetime | Date | Время создания |
| saleDate | Date | Дата продажи |
| paymentType | enum | `cash` \| `card` \| `debt` |
| totalAmount | number | Сумма до скидки |
| totalCost | number \| null | Себестоимость |
| discountValue | number | Сумма скидки |
| discountType | enum | `absolute` \| `percent` |
| finalAmount | number | Итоговая сумма |
| comment | string \| null | Комментарий |
| customerName | string \| null | Имя клиента (обязательно при debt) |
| isReservation | boolean | Является ли резервом |
| reservationExpiry | Date \| null | Срок действия резерва |
| reservationCustomerName | string \| null | Имя клиента резерва |
| status | enum | `active` \| `edited` \| `deleted` |
| createdAt, updatedAt | Date | |

### 3.11 SaleItem (позиция продажи)
| Поле | Тип | Описание |
|------|-----|----------|
| saleId | UUID | FK → Sale |
| flavorId | UUID | FK → Flavor |
| productNameSnapshot | string | Снимок названия продукта |
| flavorNameSnapshot | string | Снимок названия вкуса |
| unitPrice | number | Цена за единицу |
| costPriceSnapshot | number | Себестоимость на момент продажи |
| quantity | number | Количество |
| lineTotal | number | Сумма строки |

### 3.12 Debt (долг)
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| shopId | UUID | FK → Shop |
| customerName | string | Имя должника |
| totalDebt | number | Текущий остаток долга |
| createdAt, updatedAt | Date | |

### 3.13 DebtOperation (операция по долгу)
| Поле | Тип | Описание |
|------|-----|----------|
| debtId | UUID | FK → Debt |
| saleId | UUID \| null | FK → Sale (если операция — продажа в долг) |
| amount | number | Сумма (+ при продаже в долг, − при погашении) |
| datetime | Date | Время операции |
| comment | string | Комментарий |

### 3.14 PostFormat (шаблон поста)
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| shopId | UUID \| null | null = глобальный, иначе — магазинный |
| name | string | Название формата |
| template | string | Шаблон с плейсхолдерами |
| config | jsonb | PostFormatConfig |
| createdBy | UUID \| null | FK → User |
| isActive | boolean | Активность |
| createdAt, updatedAt | Date | |

**PostFormatConfig:** `showFlavors`, `showPrices`, `showStock`, `showCategories`, `customSections`

### 3.15 PostFormatSuggestion (предложение формата)
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| userId | UUID | FK → User |
| name | string | Название |
| template | string | Шаблон |
| config | jsonb | Конфиг |
| status | enum | Статус модерации |
| createdAt, updatedAt | Date | |

### 3.16 UserStats (статистика пользователя)
| Поле | Тип | Описание |
|------|-----|----------|
| userId | UUID | FK → User |
| ... | | Агрегированные метрики |

### 3.17 SystemSettings (системные настройки)
| Поле | Тип | Описание |
|------|-----|----------|
| key | string | Ключ настройки |
| value | jsonb | Значение |

---

## 4. Авторизация и сессии

### 4.1 Сессия
- Хранится в cookie `session`
- Формат: `JSON.stringify({ userId, shopId, telegramId }):HMAC-SHA256-signature`
- Подпись: `crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex')`
- Проверка: `crypto.timingSafeEqual` для защиты от timing attacks
- Параметры cookie: `httpOnly`, `secure` (в production), `sameSite: 'lax'`, `maxAge: 7 дней`

### 4.2 Способы входа

#### 4.2.1 Telegram (initData)
- **Endpoint:** `POST /api/auth/telegram`
- **Body:** `{ initData: string }` — данные из `window.Telegram.WebApp.initData`
- **Валидация:** HMAC-SHA256 по алгоритму Telegram WebApp
  - Параметры сортируются, формируется `dataCheckString`
  - `secret = HMAC-SHA256('WebAppData', botToken)`
  - `hash = HMAC-SHA256(secret, dataCheckString)`
  - Сравнение с переданным `hash`
- **Логика:** Создание/обновление User, создание Shop при первом входе, связь UserShop, установка cookie

#### 4.2.2 Access Key
- **Endpoint:** `POST /api/auth/key`
- **Body:** `{ key: string }` — ключ формата `KEY-xxx` (case-insensitive)
- **Логика:** Поиск User по `accessKey`, создание сессии

#### 4.2.3 Dev (только development)
- **Endpoint:** `POST /api/auth/dev`
- **Логика:** Создание тестового пользователя и сессии без проверки

### 4.3 Подписка
- **Триал:** 14 дней с момента регистрации
- **Статусы:** `trial`, `active`, `expired`
- **Проверка доступа:** `canAccess(user)` — админы всегда имеют доступ; остальные — только при `hasActiveSubscription`
- **hasActiveSubscription:** `subscriptionStatus === 'active' && subscriptionEndsAt > now` ИЛИ `subscriptionStatus === 'trial' && trialEndsAt > now`

---

## 5. API Endpoints (подробно)

### 5.1 Авторизация
| Метод | Путь | Описание |
|-------|------|----------|
| POST | /api/auth/telegram | Вход по initData Telegram |
| POST | /api/auth/key | Вход по access key |
| POST | /api/auth/dev | Dev-вход (только NODE_ENV=development) |

### 5.2 Пользователь и магазин
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/user/me | Текущий пользователь |
| GET | /api/shop | Данные магазина |
| PATCH | /api/shop | Обновление магазина |
| PATCH | /api/shop/settings | Обновление настроек магазина |
| POST | /api/profile/clear-data | Очистка данных пользователя |

### 5.3 Склад (Inventory)

#### 5.3.1 GET /api/inventory
**Query-параметры:**
- `search` — поиск по бренду, формату, вкусу, штрихкоду
- `inStockOnly=1` — только товары с quantity > 0
- `noBarcode=1` — только товары без штрихкода
- `showReservedOnly=1` — только с reservedQuantity > 0
- `minPrice`, `maxPrice` — фильтр по цене
- `categoryId`, `brandId` — фильтр по категории/бренду
- `strength` — фильтр по крепости (strengthLabel)
- `color` — фильтр по названию вкуса

**Ответ:** Дерево категорий → бренды → форматы → вкусы с quantity, reservedQuantity, costPrice, barcode. Timeout подключения к БД: 10 сек.

#### 5.3.2 POST /api/inventory/product
**Body:** Создание продукта (категория, бренд, формат, вкусы, остатки). Валидация через Zod.

#### 5.3.3 PATCH /api/inventory/stock
**Body:** `{ flavorId, quantity?, costPrice? }` — обновление остатка и/или себестоимости.

#### 5.3.4 Категории
- GET/POST/PATCH/DELETE `/api/inventory/categories`

#### 5.3.5 Бренды
- GET/POST/PATCH/DELETE `/api/inventory/brands`
- POST `/api/inventory/brands/reorder` — изменение порядка брендов
- POST `/api/inventory/brands/reorder-category` — изменение порядка брендов в категории

#### 5.3.6 Одиночные сущности
- GET/PATCH/DELETE `/api/inventory/brand/[id]`
- GET/POST/PATCH/DELETE `/api/inventory/format/[id]`
- GET/POST/PATCH/DELETE `/api/inventory/flavor/[id]`

### 5.4 Продажи
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/sales | Список продаж. Query: `from`, `to` (ISO date). Исключаются status=deleted. Лимит 100. |
| POST | /api/sales | Создание продажи/резерва |

#### 5.4.1 POST /api/sales — схема тела
```json
{
  "paymentType": "cash" | "card" | "debt",
  "discountValue": 0,
  "discountType": "absolute" | "percent",
  "comment": null,
  "customerName": null,
  "isReservation": false,
  "reservationExpiry": null,
  "reservationCustomerName": null,
  "saleDate": null,
  "items": [
    {
      "flavorId": "uuid",
      "productNameSnapshot": "string",
      "flavorNameSnapshot": "string",
      "unitPrice": number,
      "quantity": number (int >= 1),
      "lineTotal": number
    }
  ]
}
```

**Бизнес-логика:**
- При `paymentType === 'debt'` обязательно `customerName`
- Скидка не может превышать totalAmount
- Проверка наличия: для резерва — `available >= quantity`; для продажи — то же
- Резерв: `reservedQuantity += quantity` по каждому flavor
- Продажа: `quantity -= quantity` по каждому flavor
- При debt: создание/обновление Debt, DebtOperation с amount = finalAmount

#### 5.4.2 GET/PATCH/DELETE /api/sales/[id]
Получение, редактирование, мягкое удаление (status=deleted) продажи.

### 5.5 Резервы
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/reservations | Активные резервы (status=active, isReservation=true, reservationExpiry > now) |
| GET | /api/reservations/by-flavor/[flavorId] | Резервы по конкретному вкусу |
| POST | /api/reservations/[id]/sell | Конвертация резерва в продажу. Body: `{ paymentType }` |
| GET | /api/reserves | Список активных резервов |
| DELETE | /api/reserves | Отмена резерва. Body: `{ reservationId }` |
| POST | /api/reserves | Возврат истекших резервов в stock (reservationExpiry <= now) |

**Логика конвертации резерва в продажу:**
- `reservedQuantity -= item.quantity`
- `quantity -= item.quantity`
- `isReservation = false`, `paymentType` обновляется

**Логика отмены резерва:**
- `reservedQuantity -= item.quantity`
- `quantity += item.quantity`
- `status = 'deleted'`

### 5.6 Долги
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/debts | Список долгов с операциями (DebtOperation) |
| POST | /api/debts | Погашение долга. Body: `{ debtId, amount, comment? }` |

**Логика погашения:**
- `amount` должен быть ≤ `totalDebt`
- `debt.totalDebt += -amount` (уменьшение долга)
- Создание DebtOperation с amount = -paymentAmount, comment = 'Погашение долга' или переданный

### 5.7 Генерация постов
| Метод | Путь | Описание |
|-------|------|----------|
| POST | /api/post/generate | Генерация текста поста |
| GET/POST | /api/post/formats | Список/создание форматов |
| GET/PATCH/DELETE | /api/post/formats/[id] | CRUD формата |
| POST | /api/post/formats/import | Импорт форматов |
| POST | /api/post/suggest-format | Предложение нового формата |

#### 5.7.1 POST /api/post/generate — тело запроса
```json
{
  "selectedFormatIds": ["uuid"],
  "categoryIds": ["uuid"],
  "brandIds": ["uuid"],
  "strengths": ["20mg"],
  "colors": ["красный"],
  "postFormatId": "uuid",
  "template": "string (preview)",
  "config": { "showFlavors", "showPrices", "showStock", "showCategories" }
}
```

**Логика:**
- Загрузка категорий, брендов, форматов, вкусов, остатков, магазина в транзакции
- Фильтрация по categoryIds, brandIds, strengths, colors
- Показ только товаров с stock > 0
- Шаблон: из PostFormat (глобальный или shop-specific) или дефолтный
- Рендер через `renderTemplate(template, postData, config)`

### 5.8 Шаблонизатор постов

Эмодзи используются только при генерации текста поста. Поля `emoji` (категория) и `emojiPrefix` (бренд) подставляются в сгенерированный текст. Шаблоны форматов постов могут содержать произвольные эмодзи.

#### 5.8.1 Синтаксис шаблона
- **Переменные:** `{content}`, `{shop.name}`, `{shop.address}`
- **Условия:** `{if:condition}...{/if}`, `{if:!condition}...{/if}`
- **Циклы:** `{loop:categories}...{/loop}`, `{loop:brands}`, `{loop:formats}`, `{loop:flavors}`

**Условия:**
- `showFlavors`, `showPrices`, `showStock`, `showCategories` — из config
- `hasFlavors` — есть ли вкусы у формата (в контексте loop:formats)
- `hasStock` — есть ли остаток у вкуса (в контексте loop:flavors)

**Структура данных для рендера:**
```
PostData {
  categories: [{ id, name, emoji, brands: [{ id, name, emojiPrefix, formats: [{ id, name, price, strength, flavors: [{ id, name, stock }] }] }] }],
  shop?: { name, address }
}
```

**Config по умолчанию:** showFlavors=true, showPrices=true, showStock=false, showCategories=true

#### 5.8.2 Парсер шаблона (template-parser)
- Разбор тегов `{...}`: переменные, `if:`, `loop:`
- Поддержка вложенности и закрывающих тегов `{/if}`, `{/loop}`

### 5.9 Отчёты
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/reports | Дневные отчёты |

**Query:** `days` (7–365), `from`, `to` (custom range), `reservationsOnly=1`

**Ответ:**
- `dayReports`: массив по дням с полями:
  - date, salesCount, revenue, cost, profit
  - cashAmount, cardAmount, debtAmount, discountTotal
  - reservationsCount, reservationsAmount
  - lastSaleTime, lastSaleDescription
  - sales (массив продаж с items)
- `dateRange`: { from, to }

**Логика:** Резервы не учитываются в revenue/cost/profit; учитываются в reservationsCount/reservationsAmount.

### 5.10 Подписка и рефералы
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/subscription | Статус подписки, реферальная статистика |
| GET | /api/referrals | Данные по рефералам |

### 5.11 Статистика
| Метод | Путь | Описание |
|-------|------|----------|
| POST | /api/stats/sync | Синхронизация статистики пользователя |

### 5.12 Админ
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/admin/users | Список пользователей (admin only) |
| GET | /api/admin/users/[id]/referrals | Рефералы пользователя |
| GET | /api/admin/stats | Админ-статистика |
| GET | /api/admin/formats | Форматы постов |
| GET | /api/admin/suggestions | Предложения форматов |
| GET | /api/admin/server/info | Информация о сервере |
| GET/POST | /api/admin/maintenance | Режим обслуживания |

**Админ:** роль `admin`, хардкод username `wendigo2347` для broadcast.

### 5.13 Telegram
| Метод | Путь | Описание |
|-------|------|----------|
| POST | /api/telegram/webhook | Webhook для Telegraf |

### 5.14 Cron
| Метод | Путь | Описание |
|-------|------|----------|
| GET/POST | /api/cron/trial-end-notification | Уведомления об окончании триала (защита CRON_SECRET) |

### 5.15 Demo
| Метод | Путь | Описание |
|-------|------|----------|
| POST | /api/demo/seed | Наполнение демо-данными |

---

## 6. Telegram Bot (Telegraf)

### 6.1 Команды
- `/start` — приветствие, создание пользователя, реферальный код из start_param, выбор роли (seller/client)
- Обработка текстовых кнопок (без эмодзи в интерфейсе): «Открыть приложение», «Пост», «Мой ключ», «Профиль», «Форматы», «Подписка», «Рефералы», «Помощь»

### 6.2 Функционал бота
- **Открыть приложение** — ссылка на Mini App
- **Пост** — интерактивная генерация поста: выбор формата, категорий, брендов, крепостей, цветов; пагинация форматов; отправка сгенерированного текста
- **Мой ключ** — вывод accessKey
- **Профиль** — информация о пользователе, подписке
- **Форматы** — просмотр, создание форматов постов (name → template → config)
- **Подписка** — статус подписки, триал
- **Рефералы** — реферальный код, статистика
- **Помощь** — справка

### 6.3 Админ-функции
- **Broadcast** — массовая рассылка сообщений/фото (username `wendigo2347`)

### 6.4 Состояния (in-memory)
- `roleSelectionState` — выбор роли при /start
- `formatCreationState` — пошаговое создание формата
- `postGenerationState` — состояние генерации поста (форматы, фильтры, пагинация)
- `broadcastState` — состояние рассылки

### 6.5 Reply Keyboard
- Клавиатура с кнопками (без эмодзи): Открыть приложение, Пост, Мой ключ, Профиль, Форматы, Подписка, Рефералы, Помощь

---

## 7. Миграции и скрипты

### 7.1 TypeORM
- `db:generate` — генерация миграции
- `db:migrate` — применение миграций
- DataSource: `src/lib/db/data-source.ts`

### 7.2 Скрипты
- `db:seed` — сид тестовых данных
- `db:clear` — очистка БД
- `db:fix-brands` — исправление sortOrder брендов
- `db:fix-stats` — исправление таблицы user_stats
- `make-admin` — назначение админа
- `check-key` — проверка access key
- `bot:polling` — запуск бота в режиме polling (для разработки)

---

## 8. Валидация (Zod)

- Все входящие тела запросов валидируются через Zod
- При ошибке: `400` с `{ message, errors: flattened }`
- Примеры схем: `itemSchema`, `createSchema` для продаж; `paymentSchema` для долгов; `cancelReservationSchema` для отмены резервов

---

## 9. Безопасность

- Подписанные сессии (HMAC-SHA256)
- Валидация Telegram initData
- Проверка `shopId` во всех операциях (изоляция данных магазина)
- CRON_SECRET для cron endpoints
- SESSION_SECRET обязателен в production

---

## 10. Обработка ошибок

- 401 — Unauthorized (нет сессии)
- 403 — Forbidden (нет доступа по подписке)
- 404 — Not found
- 400 — Invalid body (Zod), бизнес-ошибки (недостаточно товара, скидка больше суммы и т.п.)
- 500 — Internal server error

---

## 11. Транзакции

- Критичные операции выполняются в `ds.transaction()`: создание продажи, конвертация резерва, отмена резерва, возврат истекших резервов, погашение долга
- Использование транзакций для предотвращения параллельных запросов на одном соединении (TypeORM)

---

## 12. Утилиты

- `generateAccessKey()` — генерация ключа формата KEY-xxx
- `generateReferralCode()` — генерация реферального кода
- `checkUserSubscription(userId)` — проверка подписки
- `canAccess(user)` — проверка доступа к функционалу

---

## 13. Целевая аудитория и локализация

- Русскоязычные продавцы
- Валюта по умолчанию: BYN
- Часовой пояс по умолчанию: Europe/Minsk
- Сообщения об ошибках на русском языке

---

*Документ описывает backend-функционал проекта Post Stock Pro (Telegram Seller MVP) для создания полной копии с тем же технологическим стеком. Фронтенд не описан.*
