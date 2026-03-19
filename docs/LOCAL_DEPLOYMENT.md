# Полная инструкция локального развёртывания приложения и бота

Этот документ содержит подробные пошаговые инструкции для локального развёртывания Telegram Seller MVP приложения и Telegram бота на вашем компьютере.

## Содержание

1. [Требования](#1-требования)
2. [Установка зависимостей системы](#2-установка-зависимостей-системы)
3. [Клонирование и настройка проекта](#3-клонирование-и-настройка-проекта)
4. [Настройка переменных окружения](#4-настройка-переменных-окружения)
5. [Создание Telegram бота](#5-создание-telegram-бота)
6. [Инициализация базы данных](#6-инициализация-базы-данных)
7. [Запуск приложения локально](#7-запуск-приложения-локально)
8. [Настройка Telegram webhook для локальной разработки](#8-настройка-telegram-webhook-для-локальной-разработки)
9. [Тестирование](#9-тестирование)
10. [Устранение неполадок](#10-устранение-неполадок)

---

## 1. Требования

Перед началом установки убедитесь, что у вас установлены следующие компоненты:

- **Node.js** версии 18 или выше
- **PostgreSQL** версии 12 или выше
- **Git** для клонирования репозитория
- **Telegram аккаунт** для создания бота через @BotFather
- **npm** или **yarn** (обычно устанавливается вместе с Node.js)

### Проверка установленных версий

Откройте терминал (PowerShell на Windows, Terminal на macOS/Linux) и выполните:

```bash
node --version
npm --version
psql --version
git --version
```

Если какая-то из команд не найдена, перейдите к следующему разделу для установки.

---

## 2. Установка зависимостей системы

### 2.1. Установка Node.js

**Windows:**

1. Перейдите на [https://nodejs.org/](https://nodejs.org/)
2. Скачайте LTS версию (рекомендуется)
3. Запустите установщик и следуйте инструкциям
4. Убедитесь, что опция "Add to PATH" отмечена

**macOS:**

```bash
# Используя Homebrew
brew install node

# Или скачайте установщик с nodejs.org
```

**Linux (Ubuntu/Debian):**

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Проверка установки:**

```bash
node --version  # Должно показать v18.x.x или выше
npm --version   # Должно показать 9.x.x или выше
```

### 2.2. Установка PostgreSQL

**Windows:**

1. Перейдите на [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
2. Скачайте установщик PostgreSQL
3. Запустите установщик:
  - Выберите компоненты: PostgreSQL Server, pgAdmin (опционально), Command Line Tools
  - Запомните пароль для пользователя `postgres` (он понадобится позже)
  - Порт по умолчанию: 5432
  - Убедитесь, что служба PostgreSQL запускается автоматически

**macOS:**

```bash
# Используя Homebrew
brew install postgresql@14
brew services start postgresql@14
```

**Linux (Ubuntu/Debian):**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Проверка установки:**

```bash
psql --version
```

**Проверка работы PostgreSQL:**

```bash
# Windows (введите пароль при запросе)
psql -U postgres

# macOS/Linux (может потребоваться sudo)
sudo -u postgres psql
```

Если подключение успешно, вы увидите приглашение `postgres=#`. Введите `\q` для выхода.

---

## 3. Клонирование и настройка проекта

### 3.1. Клонирование репозитория

Откройте терминал в директории, где вы хотите разместить проект:

```bash
# Если у вас есть URL репозитория
git clone <URL_РЕПОЗИТОРИЯ> telegram-seller-mvp
cd telegram-seller-mvp

# Или если проект уже скачан, перейдите в его директорию
cd post-stock-pro-main
```

### 3.2. Установка npm зависимостей

```bash
npm install
```

Эта команда установит все необходимые зависимости проекта. Процесс может занять несколько минут.

**Если возникают ошибки:**

- Убедитесь, что используете Node.js версии 18+
- Попробуйте удалить `node_modules` и `package-lock.json`, затем выполните `npm install` снова
- На Windows может потребоваться запуск PowerShell от имени администратора

### 3.3. Создание базы данных PostgreSQL

**Windows:**

```bash
# Откройте PowerShell или командную строку
psql -U postgres

# В консоли PostgreSQL выполните:
CREATE DATABASE telegram_seller;

# Выход
\q
```

**macOS/Linux:**

```bash
# Подключитесь к PostgreSQL
sudo -u postgres psql

# Создайте базу данных
CREATE DATABASE telegram_seller;

# Выход
\q
```

**Или одной командой:**

```bash
# Windows
psql -U postgres -c "CREATE DATABASE telegram_seller;"

# macOS/Linux
sudo -u postgres psql -c "CREATE DATABASE telegram_seller;"
```

**Проверка создания базы данных:**

```bash
psql -U postgres -l | grep telegram_seller
```

---

## 4. Настройка переменных окружения

### 4.1. Создание файла .env

В корне проекта создайте файл `.env` (если его нет):

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
# Или если файла .env.example нет:
New-Item .env
```

**Windows CMD:**

```cmd
copy .env.example .env
```

**macOS/Linux:**

```bash
cp .env.example .env
# Или если файла .env.example нет:
touch .env
```

### 4.2. Заполнение переменных окружения

Откройте файл `.env` в текстовом редакторе и заполните следующие переменные:

```env
# База данных PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=ваш_пароль_postgres
DB_NAME=telegram_seller

# Режим разработки
NODE_ENV=development

# Порт для приложения (8443 поддерживается Telegram для webhook)
PORT=8443

# Telegram Bot Token (получите у @BotFather в Telegram)
# Для локального тестирования можно оставить пустым, но тогда не будет работать авторизация через Telegram
TELEGRAM_BOT_TOKEN=ваш_токен_бота

# Секретный ключ для подписи сессий (минимум 32 символа)
# Сгенерируйте случайную строку, например:
# Windows PowerShell: -join ((65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
# macOS/Linux: openssl rand -base64 32
SESSION_SECRET=ваш_секретный_ключ_минимум_32_символа

# URL для Telegram webhook (будет настроен через ngrok)
# Пример: https://xxxx-xx-xx-xx-xx.ngrok-free.app/api/telegram/webhook
TELEGRAM_WEBHOOK_URL=
```

**Важные замечания:**

1. **DB_PASSWORD** - замените на реальный пароль от PostgreSQL (который вы указали при установке)
2. **TELEGRAM_BOT_TOKEN** - получите у @BotFather (см. раздел 5)
3. **SESSION_SECRET** - сгенерируйте случайную строку минимум из 32 символов:
   ```bash
    # Windows PowerShell
    -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})

    # macOS/Linux
    openssl rand -base64 32
   ```
4. **PORT** - порт 8443 поддерживается Telegram для webhook, будет использоваться через ngrok
5. **TELEGRAM_WEBHOOK_URL** - будет настроен после запуска ngrok (см. раздел 8.5)

**Пример заполненного .env файла:**

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=MySecurePassword123
DB_NAME=telegram_seller
NODE_ENV=development
PORT=8443
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
SESSION_SECRET=aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1fG3hI5jK7lM9nO1pQ3
TELEGRAM_WEBHOOK_URL=
```

---

## 5. Создание Telegram бота

### 5.1. Получение токена бота

1. Откройте Telegram и найдите бота [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Следуйте инструкциям:
  - Введите имя бота (например: "My Seller Bot")
  - Введите username бота (должен заканчиваться на `bot`, например: `my_seller_bot`)
4. BotFather выдаст вам токен вида: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
5. Скопируйте токен и добавьте в файл `.env`:
  ```env
   TELEGRAM_BOT_TOKEN=ваш_токен_от_BotFather
  ```

### 5.2. Настройка Mini App (опционально)

Для полноценной работы приложения как Telegram Mini App:

1. Откройте [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newapp`
3. Выберите вашего бота из списка
4. Заполните информацию:
  - **Название приложения:** Telegram Seller
  - **Описание:** Приложение для продавцов
  - **Фото:** Загрузите иконку (опционально)
  - **URL:** Пока оставьте пустым (настроим после создания SSL сертификатов)
  - **Short name:** seller-app

**Примечание:** URL для Mini App настроим после создания SSL сертификатов (см. раздел 8).

---

## 6. Инициализация базы данных

### 6.1. Автоматическое создание таблиц

В режиме разработки (`NODE_ENV=development`) TypeORM автоматически создаст все таблицы при первом запуске приложения.

**Запустите приложение:**

```bash
npm run dev
```

При первом запросе к приложению TypeORM выполнит `synchronize` и создаст все необходимые таблицы в базе данных.

**Проверка создания таблиц:**

```bash
psql -U postgres -d telegram_seller -c "\dt"
```

Вы должны увидеть список таблиц: `users`, `shops`, `categories`, `brands`, `products`, и т.д.

### 6.2. Заполнение тестовыми данными (опционально)

Для тестирования приложения с данными выполните:

```bash
npm run db:seed
```

Эта команда создаст:

- Тестового пользователя
- Магазин
- Категории товаров
- Бренды
- Продукты и вкусы
- Остатки на складе
- Примеры продаж и долгов

**Результат:** В консоли вы увидите сообщения о создании данных.

**Восстановление данных после очистки:**

```bash
npm run db:seed
```

**Очистка всех данных (осторожно!):**

```bash
npm run db:clear
```

⚠️ **ВНИМАНИЕ:** Команда `db:clear` удаляет ВСЕ данные из базы данных!

---

## 7. Запуск приложения локально

### 7.1. Запуск в режиме разработки

**Важно:** Для работы с Telegram Mini App и webhook необходим HTTPS. Сначала создайте SSL сертификаты (см. раздел 8), затем запустите:

```bash
npm run dev
```

Приложение будет доступно по адресу: **[https://127.0.0.1:8443](https://127.0.0.1:8443)**

**Если SSL сертификаты ещё не созданы**, приложение не запустится и покажет инструкции по их созданию.

**Альтернатива:** Для запуска без HTTPS (только веб-интерфейс):

```bash
npm run dev:http
```

Приложение будет доступно по адресу: **[http://localhost:3000](http://localhost:3000)**

**Что происходит при запуске:**

- Next.js компилирует приложение
- TypeORM подключается к базе данных
- При первом запросе создаются таблицы (если их нет)
- Приложение готово к работе

### 7.2. Проверка работы приложения

1. Откройте браузер и перейдите на `https://127.0.0.1:8443` (или `http://localhost:3000` если используете `dev:http`)
2. Если используете HTTPS, браузер может показать предупреждение — это нормально для первого запуска после установки сертификатов
3. Вы должны увидеть страницу входа или автоматический dev-вход
4. Для входа без Telegram откройте `https://127.0.0.1:8443/login` (или `http://localhost:3000/login`)
5. Нажмите кнопку "Войти" или "Dev Login"
6. Должен произойти автоматический вход, и вы будете перенаправлены на дашборд

**Ожидаемый результат:**

- Создаётся тестовый пользователь с `telegramId: 'dev-user-1'`
- Создаётся сессия в cookie
- Пользователь видит дашборд приложения

### 7.3. Остановка приложения

Для остановки приложения нажмите `Ctrl+C` в терминале.

---

## 8. Настройка локальных SSL сертификатов для HTTPS

Для работы Telegram Mini App и webhook локально необходим HTTPS. Настроим локальные SSL сертификаты для `https://127.0.0.1:8443`.

### 8.1. Установка mkcert

**mkcert** — инструмент для создания локально доверенных SSL сертификатов.

**Windows:**

1. Перейдите на [https://github.com/FiloSottile/mkcert/releases](https://github.com/FiloSottile/mkcert/releases)
2. Скачайте `mkcert-v*-windows-amd64.exe`
3. Переименуйте в `mkcert.exe`
4. Добавьте в PATH или используйте полный путь

**macOS:**

```bash
brew install mkcert
```

**Linux (Ubuntu/Debian):**

```bash
# Установите certutil (для Firefox)
sudo apt install libnss3-tools

# Скачайте mkcert
wget -O mkcert https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v*-linux-amd64
chmod +x mkcert
sudo mv mkcert /usr/local/bin/
```

**Проверка установки:**

```bash

```

### 8.2. Установка локального CA (Certificate Authority)

Выполните команду один раз на вашем компьютере:

```bash
mkcert -install
```

Эта команда создаст локальный Certificate Authority и добавит его в доверенные корневые сертификаты вашей системы.

**Что происходит:**

- Создаётся локальный CA сертификат
- Он добавляется в список доверенных сертификатов системы
- Браузеры будут доверять сертификатам, созданным через mkcert

### 8.3. Создание SSL сертификатов для localhost

В корне проекта выполните:

```bash
mkcert localhost 127.0.0.1 ::1
```

Эта команда создаст два файла:

- `localhost+2.pem` — сертификат
- `localhost+2-key.pem` — приватный ключ

**Переименуйте файлы** для удобства:

**Windows PowerShell:**

```powershell
Rename-Item localhost+2.pem localhost.pem
Rename-Item localhost+2-key.pem localhost-key.pem
```

**Windows CMD:**

```cmd
ren localhost+2.pem localhost.pem
ren localhost+2-key.pem localhost-key.pem
```

**macOS/Linux:**

```bash
mv localhost+2.pem localhost.pem
mv localhost+2-key.pem localhost-key.pem
```

**Важно:** Убедитесь, что файлы `localhost.pem` и `localhost-key.pem` находятся в корне проекта (там же, где `package.json`).

### 8.4. Запуск приложения с HTTPS

Теперь запустите приложение:

```bash
npm run dev
```

Приложение будет доступно по адресу: **[https://127.0.0.1:8443](https://127.0.0.1:8443)**

**Что происходит:**

- Next.js запускается через кастомный HTTPS сервер (`server.js`)
- Сервер использует созданные SSL сертификаты
- Браузер доверяет сертификату (зелёный замочек)

**Проверка:**

1. Откройте браузер и перейдите на `https://127.0.0.1:8443`
2. Вы должны увидеть зелёный замочек (без предупреждений о небезопасном соединении)
3. Если видите предупреждение — убедитесь, что выполнили `mkcert -install`

### 8.5. Настройка Telegram webhook через ngrok

⚠️ **ВАЖНО:** Telegram не позволяет устанавливать webhook на локальный IP адрес `127.0.0.1`. Для локальной разработки необходимо использовать туннель (ngrok), который проксирует на порт 8443.

#### 8.5.1. Установка ngrok

**Windows:**

1. Перейдите на [https://ngrok.com/download](https://ngrok.com/download)
2. Скачайте ngrok для Windows
3. Распакуйте `ngrok.exe` в удобную папку (например, `C:\ngrok\`)
4. Добавьте путь в PATH или используйте полный путь

**macOS:**

```bash
brew install ngrok/ngrok/ngrok
```

**Linux:**

```bash
# Скачайте и распакуйте
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/
```

**Проверка установки:**

```bash
ngrok version
```

#### 8.5.2. Регистрация в ngrok (опционально, но рекомендуется)

1. Зарегистрируйтесь на [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)
2. Получите authtoken из [https://dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Выполните:

```bash
ngrok config add-authtoken ВАШ_AUTHTOKEN
```

Это позволит использовать стабильные домены и больше функций.

#### 8.5.3. Запуск ngrok туннеля

В **отдельном терминале** запустите ngrok на порт 8443:

```bash
ngrok http 8443
```

Вы увидите что-то вроде:

```
Forwarding  https://xxxx-xx-xx-xx-xx.ngrok-free.app -> http://localhost:8443
```

Скопируйте HTTPS URL (например: `https://xxxx-xx-xx-xx-xx.ngrok-free.app`)

#### 8.5.4. Настройка webhook

**Способ 1: Через браузер**

Откройте в браузере (замените `YOUR_NGROK_URL` на ваш ngrok URL):

```
https://YOUR_NGROK_URL/api/telegram/webhook?setWebhook=true
```

**Способ 2: Через curl**

```bash
curl "https://YOUR_NGROK_URL/api/telegram/webhook?setWebhook=true"
```

**Ожидаемый результат:**

```json
{"ok": true, "message": "Webhook set to https://YOUR_NGROK_URL/api/telegram/webhook"}
```

#### 8.5.5. Обновление .env файла

Добавьте webhook URL в `.env` (замените `YOUR_NGROK_URL` на ваш ngrok URL):

```env
TELEGRAM_WEBHOOK_URL=https://YOUR_NGROK_URL/api/telegram/webhook
```

**Важно:** 
- ngrok URL меняется при каждом запуске (если используете бесплатный план)
- После каждого перезапуска ngrok нужно обновить webhook URL
- Для стабильного URL зарегистрируйтесь в ngrok и используйте статический домен
- **ngrok должен быть запущен всё время**, пока вы тестируете бота

### 8.6. Настройка Mini App URL

Если вы создали Mini App в BotFather:

1. Откройте [@BotFather](https://t.me/BotFather)
2. Отправьте `/myapps`
3. Выберите ваше приложение
4. Выберите "Edit" → "URL"
5. Введите локальный HTTPS URL: `https://127.0.0.1:8443`

**Важно:** Telegram Mini App будет работать только если:

- Сертификат доверенный (выполнили `mkcert -install`)
- Используете `https://127.0.0.1:8443` (не `localhost`)
- Приложение запущено через `npm run dev` (HTTPS сервер)

### 8.7. Альтернатива: запуск без HTTPS

Если вам не нужен HTTPS для разработки (например, только веб-интерфейс без Telegram), используйте:

```bash
npm run dev:http
```

Это запустит стандартный Next.js dev сервер на `http://localhost:3000` без HTTPS.

---

## 9. Тестирование

### 9.1. Проверка работы приложения

1. **Веб-приложение:**
  - Откройте `https://127.0.0.1:8443` (или `http://localhost:3000` если используете `dev:http`)
  - Войдите через `/login`
  - Проверьте работу основных функций:
    - Дашборд
    - Склад
    - Продажи
    - Долги
    - Отчёты
    - Генерация постов
2. **Telegram бот:**
  - Найдите вашего бота в Telegram по username
  - Отправьте команду `/start`
  - Бот должен ответить приветствием
  - Попробуйте команды:
    - `/key` - получить ключ доступа
    - `/me` - информация о профиле
    - `/subscribe` - покупка подписки (если настроено)
3. **Webhook:**
  - Отправьте любую команду боту
  - Проверьте логи в терминале, где запущен `npm run dev`
  - Должны быть сообщения об обработке запросов

### 9.2. Проверка базы данных

```bash
# Подключение к БД
psql -U postgres -d telegram_seller

# Просмотр таблиц
\dt

# Просмотр пользователей
SELECT id, "telegramId", "firstName", role FROM users;

# Выход
\q
```

### 9.3. Чек-лист проверки

- Приложение запускается без ошибок
- База данных подключена и таблицы созданы
- Можно войти через `/login`
- Дашборд отображается корректно
- Telegram бот отвечает на команды
- Webhook работает (команды обрабатываются)
- Можно создать тестовые данные через `npm run db:seed`

---

## 10. Устранение неполадок

### 10.1. Ошибки подключения к базе данных

**Проблема:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Решения:**

1. Убедитесь, что PostgreSQL запущен:
   ```bash
    # Windows: проверьте службы
    # macOS/Linux
    sudo systemctl status postgresql
    sudo systemctl start postgresql
   ```
2. Проверьте параметры подключения в `.env`:
   - `DB_HOST=localhost`
   - `DB_PORT=5432`
   - `DB_USER=postgres`
   - `DB_PASSWORD` - правильный пароль
3. Проверьте, что база данных существует:
   ```bash
    psql -U postgres -l | grep telegram_seller
   ```

### 10.2. Ошибки при установке зависимостей

**Проблема:** `npm ERR!` при `npm install`

**Решения:**

1. Очистите кэш npm:
   ```bash
    npm cache clean --force
   ```
2. Удалите `node_modules` и `package-lock.json`, затем переустановите:
   ```bash
    rm -rf node_modules package-lock.json  # macOS/Linux
    rmdir /s node_modules & del package-lock.json  # Windows
    npm install
   ```
3. Убедитесь, что используете Node.js 18+:
   ```bash
    node --version
   ```

### 10.3. Ошибки TypeORM при создании таблиц

**Проблема:** `QueryFailedError` или ошибки синхронизации

**Решения:**

1. Убедитесь, что база данных пустая или удалите существующие таблицы:
   ```bash
    psql -U postgres -d telegram_seller -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   ```
2. Перезапустите приложение - таблицы создадутся автоматически
3. Проверьте права доступа пользователя БД:
   ```sql
    GRANT ALL PRIVILEGES ON DATABASE telegram_seller TO postgres;
   ```

### 10.4. Telegram бот не отвечает

**Проблема:** Команды боту не обрабатываются

**Решения:**

1. **Проверьте, что webhook настроен:**
   ```bash
   curl "https://api.telegram.org/botВАШ_ТОКЕН/getWebhookInfo"
   ```
   Должен быть установлен URL через ngrok (не `127.0.0.1`)

2. **Убедитесь, что ngrok запущен:**
   - В отдельном терминале должен быть запущен `ngrok http 8443`
   - URL должен быть доступен из интернета (проверьте в браузере)

3. **Проверьте, что приложение запущено:**
   - Запустите `npm run dev` в одном терминале
   - Запустите `ngrok http 8443` в другом терминале

4. **Проверьте логи приложения на наличие ошибок**

5. **Переустановите webhook через ngrok URL:**
   ```bash
   curl "https://YOUR_NGROK_URL/api/telegram/webhook?setWebhook=true"
   ```

6. **Если получаете ошибку "IP address 127.0.0.1 is reserved":**
   - Это означает, что вы пытаетесь установить webhook на локальный адрес
   - Используйте ngrok туннель (см. раздел 8.5)
   - ngrok создаст публичный URL, который Telegram сможет использовать

7. **Если ngrok URL изменился:**
   - При каждом перезапуске ngrok URL меняется (на бесплатном плане)
   - Обновите webhook с новым URL
   - Или используйте статический домен в ngrok (требует регистрации)

### 10.5. Ошибки при запуске `npm run dev`

**Проблема:** Приложение не запускается

**Решения:**

1. Проверьте, что порт 8443 свободен:
   ```bash
    # Windows
    netstat -ano | findstr :8443

    # macOS/Linux
    lsof -i :8443
   ```
2. Убейте процесс, занимающий порт, или измените порт в `.env`:
   ```env
    PORT=8444
   ```
   (Не забудьте обновить команду ngrok тоже: `ngrok http 8444`)
3. Проверьте логи на наличие конкретных ошибок

### 10.6. Проблемы с переменными окружения

**Проблема:** Переменные не загружаются

**Решения:**

1. Убедитесь, что файл `.env` находится в корне проекта
2. Проверьте синтаксис `.env` файла (нет лишних пробелов, кавычек)
3. Перезапустите приложение после изменения `.env`

### 10.7. Проблемы с SSL сертификатами

**Проблема:** Приложение не запускается, ошибка "SSL сертификаты не найдены"

**Решения:**

1. Убедитесь, что выполнили установку mkcert:
   ```bash
    mkcert -install
   ```
2. Проверьте, что создали сертификаты:
   ```bash
    mkcert localhost 127.0.0.1 ::1
   ```
3. Убедитесь, что файлы переименованы правильно:
   - `localhost.pem` (не `localhost+2.pem`)
   - `localhost-key.pem` (не `localhost+2-key.pem`)
4. Проверьте, что файлы находятся в корне проекта (там же, где `package.json`)

**Проблема:** Браузер показывает предупреждение о небезопасном соединении

**Решения:**

1. Убедитесь, что выполнили `mkcert -install` (это добавляет CA в доверенные)
2. Перезапустите браузер после установки CA
3. Очистите кэш браузера
4. Убедитесь, что используете `https://127.0.0.1:8443` (не `localhost`)

**Проблема:** Telegram Mini App не открывается

**Решения:**

1. Убедитесь, что используете `https://127.0.0.1:8443` (не `localhost` или `http://`)
2. Проверьте, что сертификат доверенный (выполнили `mkcert -install`)
3. Убедитесь, что приложение запущено через `npm run dev` (HTTPS сервер)
4. Проверьте логи приложения на наличие ошибок

### 10.8. Полезные команды для диагностики

```bash
# Проверка подключения к БД
psql -U postgres -d telegram_seller -c "SELECT version();"

# Просмотр логов PostgreSQL (macOS/Linux)
sudo tail -f /var/log/postgresql/postgresql-*.log

# Проверка статуса Node.js процессов
ps aux | grep node  # macOS/Linux
tasklist | findstr node  # Windows

# Очистка кэша Next.js
rm -rf .next  # macOS/Linux
rmdir /s .next  # Windows
```

---

## Дополнительная информация

### Полезные команды проекта

```bash
# Разработка
npm run dev              # Запуск в режиме разработки с HTTPS (требует SSL сертификаты)
npm run dev:http         # Запуск в режиме разработки без HTTPS (только HTTP)

# База данных
npm run db:seed          # Заполнение тестовыми данными
npm run db:clear         # Очистка всех данных (осторожно!)
npm run db:migrate       # Запуск миграций
npm run make-admin       # Назначить пользователя админом

# Сборка
npm run build            # Сборка для production
npm run start            # Запуск production версии
```

### Следующие шаги

После успешного локального развёртывания:

1. Изучите функционал приложения
2. Протестируйте все функции
3. Ознакомьтесь с [TESTING_GUIDE.md](./TESTING_GUIDE.md) для подробного тестирования
4. Когда будете готовы к production, следуйте инструкциям в [SERVER_DEPLOYMENT.md](./SERVER_DEPLOYMENT.md)

### Получение помощи

Если возникли проблемы:

1. Проверьте раздел "Устранение неполадок" выше
2. Изучите логи приложения и базы данных
3. Проверьте документацию:
   - [README.md](./README.md)
   - [TESTING_GUIDE.md](./TESTING_GUIDE.md)

---

**Удачного развёртывания! 🚀**
