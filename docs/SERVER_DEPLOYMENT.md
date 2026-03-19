# Инструкция по развёртыванию на сервере (Production)

Этот документ содержит подробные инструкции для развёртывания Telegram Seller MVP приложения на production сервере.

## Содержание

1. [Требования к серверу](#1-требования-к-серверу)
2. [Подготовка сервера](#2-подготовка-сервера)
3. [Настройка PostgreSQL](#3-настройка-postgresql)
4. [Развёртывание приложения](#4-развёртывание-приложения)
5. [Настройка базы данных для production](#5-настройка-базы-данных-для-production)
6. [Сборка приложения](#6-сборка-приложения)
7. [Настройка Process Manager (PM2)](#7-настройка-process-manager-pm2)
8. [Настройка Nginx](#8-настройка-nginx)
9. [Настройка SSL сертификатов](#9-настройка-ssl-сертификатов)
10. [Настройка Telegram webhook](#10-настройка-telegram-webhook)
11. [Настройка мониторинга и логирования](#11-настройка-мониторинга-и-логирования)
12. [Безопасность](#12-безопасность)
13. [Резервное копирование](#13-резервное-копирование)
14. [Обновление приложения](#14-обновление-приложения)
15. [Устранение неполадок](#15-устранение-неполадок)

---

## 1. Требования к серверу

### Минимальные характеристики

- **CPU:** 2 ядра
- **RAM:** 2 GB
- **Диск:** 20 GB свободного места
- **ОС:** Ubuntu 20.04 LTS или выше (рекомендуется), Debian 11+, CentOS 8+

### Необходимые порты

- **80** (HTTP) - для Nginx
- **443** (HTTPS) - для Nginx с SSL
- **22** (SSH) - для удалённого доступа
- **5432** (PostgreSQL) - только для локального доступа (заблокирован firewall)

### Доменное имя

У вас должно быть зарегистрированное доменное имя, например: `example.com` или `seller.example.com`

---

## 2. Подготовка сервера

### 2.1. Подключение к серверу

Подключитесь к серверу по SSH:

```bash
ssh root@ваш_сервер_ip
# или
ssh username@ваш_сервер_ip
```

### 2.2. Обновление системы

```bash
# Ubuntu/Debian
sudo apt update
sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### 2.3. Установка Node.js

**Рекомендуется использовать Node.js 18 LTS:**

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Проверка установки
node --version  # Должно быть v18.x.x или выше
npm --version
```

### 2.4. Установка PostgreSQL

```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib -y

# CentOS/RHEL
sudo yum install postgresql-server postgresql-contrib -y
sudo postgresql-setup --initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Проверка
sudo systemctl status postgresql
```

### 2.5. Установка Nginx

```bash
# Ubuntu/Debian
sudo apt install nginx -y

# CentOS/RHEL
sudo yum install nginx -y

# Запуск и автозапуск
sudo systemctl enable nginx
sudo systemctl start nginx

# Проверка
sudo systemctl status nginx
```

### 2.6. Настройка Firewall

```bash
# Ubuntu (UFW)
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

**Важно:** Убедитесь, что порт PostgreSQL (5432) закрыт для внешнего доступа:

```bash
# Проверка открытых портов
sudo netstat -tlnp | grep 5432
# Должен быть только localhost:5432, не 0.0.0.0:5432
```

---

## 3. Настройка PostgreSQL

### 3.1. Создание базы данных и пользователя

```bash
# Переключитесь на пользователя postgres
sudo -u postgres psql

# В консоли PostgreSQL выполните:
CREATE DATABASE telegram_seller;
CREATE USER telegram_user WITH PASSWORD 'ваш_надёжный_пароль';
GRANT ALL PRIVILEGES ON DATABASE telegram_seller TO telegram_user;
ALTER DATABASE telegram_seller OWNER TO telegram_user;

# Выход
\q
```

### 3.2. Настройка безопасности PostgreSQL

Отредактируйте файл конфигурации PostgreSQL:

```bash
# Найдите файл pg_hba.conf
sudo find /etc -name pg_hba.conf

# Обычно находится в:
# Ubuntu/Debian: /etc/postgresql/*/main/pg_hba.conf
# CentOS/RHEL: /var/lib/pgsql/data/pg_hba.conf

sudo nano /etc/postgresql/*/main/pg_hba.conf
```

Убедитесь, что для локальных подключений используется `md5`:

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     peer
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
```

Перезапустите PostgreSQL:

```bash
sudo systemctl restart postgresql
```

### 3.3. Проверка подключения

```bash
psql -U telegram_user -d telegram_seller -h localhost
# Введите пароль при запросе
# Если подключение успешно, введите \q для выхода
```

---

## 4. Развёртывание приложения

### 4.1. Создание пользователя для приложения

```bash
# Создайте пользователя для приложения
sudo adduser --system --group --home /var/www/telegram-seller telegram-app

# Или если пользователь уже существует
sudo useradd -r -s /bin/bash -d /var/www/telegram-seller telegram-app
```

### 4.2. Клонирование репозитория

```bash
# Переключитесь на пользователя приложения
sudo su - telegram-app

# Клонируйте репозиторий
cd /var/www/telegram-seller
git clone <URL_РЕПОЗИТОРИЯ> app
cd app

# Или если код уже есть, скопируйте его в эту директорию
```

### 4.3. Установка зависимостей

```bash
# Убедитесь, что вы в директории проекта
cd /var/www/telegram-seller/app

# Установите зависимости
npm install --production

# Или для установки всех зависимостей (включая dev)
npm install
```

### 4.4. Создание production .env файла

```bash
# Создайте .env файл
nano .env
```

Заполните следующий контент:

```env
# База данных PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=telegram_user
DB_PASSWORD=ваш_надёжный_пароль
DB_NAME=telegram_seller

# Режим production
NODE_ENV=production

# Telegram Bot Token
TELEGRAM_BOT_TOKEN=ваш_токен_от_BotFather

# Секретный ключ для подписи сессий (минимум 32 символа)
# Сгенерируйте надёжный ключ:
# openssl rand -base64 32
SESSION_SECRET=ваш_очень_надёжный_секретный_ключ_минимум_32_символа

# URL для Telegram webhook (полный HTTPS URL)
TELEGRAM_WEBHOOK_URL=https://ваш_домен.com/api/telegram/webhook

# Порт приложения (по умолчанию 3000)
PORT=3000

# Дополнительные настройки (опционально)
TELEGRAM_BOT_USERNAME=ваш_бот_username
```

**Важно:**
- `SESSION_SECRET` должен быть уникальным и надёжным (минимум 32 символа)
- `TELEGRAM_WEBHOOK_URL` должен быть полным HTTPS URL вашего домена
- Никогда не коммитьте `.env` файл в репозиторий!

### 4.5. Установка прав доступа

```bash
# Вернитесь в root/sudo режим
exit

# Установите права на директорию
sudo chown -R telegram-app:telegram-app /var/www/telegram-seller
sudo chmod -R 755 /var/www/telegram-seller

# Защитите .env файл
sudo chmod 600 /var/www/telegram-seller/app/.env
```

---

## 5. Настройка базы данных для production

### 5.1. Отключение synchronize

В production режиме `synchronize` автоматически отключён (см. `src/lib/db/data-source.ts`):

```typescript
synchronize: process.env.NODE_ENV === 'development',
```

Это означает, что в production нужно использовать миграции.

### 5.2. Создание миграций (если нужно)

Если у вас есть изменения в схеме БД, создайте миграцию:

```bash
cd /var/www/telegram-seller/app
npm run db:generate -- -n MigrationName
```

### 5.3. Запуск миграций

```bash
# Запустите миграции
npm run db:migrate
```

**Примечание:** Если это первый запуск и таблиц нет, можно временно включить synchronize для создания структуры, но это не рекомендуется для production.

### 5.4. Проверка структуры БД

```bash
psql -U telegram_user -d telegram_seller -h localhost -c "\dt"
```

Вы должны увидеть все таблицы: `users`, `shops`, `categories`, `brands`, и т.д.

---

## 6. Сборка приложения

### 6.1. Сборка Next.js приложения

```bash
cd /var/www/telegram-seller/app

# Сборка для production
npm run build
```

Процесс сборки может занять несколько минут. После завершения вы увидите сообщение об успешной сборке.

### 6.2. Проверка сборки

```bash
# Проверьте, что директория .next создана
ls -la .next

# Проверьте размер сборки
du -sh .next
```

### 6.3. Тестовый запуск

```bash
# Запустите приложение для проверки
npm run start
```

Откройте браузер и перейдите на `http://ваш_сервер_ip:3000`. Если всё работает, остановите приложение (`Ctrl+C`).

---

## 7. Настройка Process Manager (PM2)

### 7.1. Установка PM2

```bash
sudo npm install -g pm2
```

### 7.2. Создание ecosystem файла

Создайте файл `ecosystem.config.js` в корне проекта:

```bash
cd /var/www/telegram-seller/app
nano ecosystem.config.js
```

Содержимое файла:

```javascript
module.exports = {
  apps: [{
    name: 'telegram-seller',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/var/www/telegram-seller/app',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/www/telegram-seller/logs/error.log',
    out_file: '/var/www/telegram-seller/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G',
    watch: false
  }]
};
```

### 7.3. Создание директории для логов

```bash
sudo mkdir -p /var/www/telegram-seller/logs
sudo chown telegram-app:telegram-app /var/www/telegram-seller/logs
```

### 7.4. Запуск приложения через PM2

```bash
# Переключитесь на пользователя приложения
sudo su - telegram-app
cd /var/www/telegram-seller/app

# Запустите приложение
pm2 start ecosystem.config.js

# Сохраните конфигурацию PM2 для автозапуска
pm2 save
```

### 7.5. Настройка автозапуска PM2

```bash
# Создайте startup скрипт
pm2 startup

# Выполните команду, которую выведет PM2 (обычно что-то вроде):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u telegram-app --hp /var/www/telegram-seller
```

### 7.6. Полезные команды PM2

```bash
# Просмотр статуса
pm2 status

# Просмотр логов
pm2 logs telegram-seller

# Перезапуск
pm2 restart telegram-seller

# Остановка
pm2 stop telegram-seller

# Мониторинг
pm2 monit
```

---

## 8. Настройка Nginx

### 8.1. Создание конфигурации Nginx

Создайте файл конфигурации:

```bash
sudo nano /etc/nginx/sites-available/telegram-seller
```

Содержимое (замените `your_domain.com` на ваш домен):

```nginx
server {
    listen 80;
    server_name your_domain.com www.your_domain.com;

    # Логи
    access_log /var/log/nginx/telegram-seller-access.log;
    error_log /var/log/nginx/telegram-seller-error.log;

    # Максимальный размер загружаемых файлов
    client_max_body_size 10M;

    # Проксирование на Node.js приложение
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Блокировка доступа к .env и другим чувствительным файлам
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

### 8.2. Активация конфигурации

```bash
# Создайте символическую ссылку
sudo ln -s /etc/nginx/sites-available/telegram-seller /etc/nginx/sites-enabled/

# Удалите дефолтную конфигурацию (опционально)
sudo rm /etc/nginx/sites-enabled/default

# Проверьте конфигурацию
sudo nginx -t

# Перезапустите Nginx
sudo systemctl restart nginx
```

### 8.3. Проверка работы

Откройте браузер и перейдите на `http://your_domain.com`. Вы должны увидеть ваше приложение.

---

## 9. Настройка SSL сертификатов

### 9.1. Установка Certbot

```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx -y

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx -y
```

### 9.2. Получение SSL сертификата

```bash
sudo certbot --nginx -d your_domain.com -d www.your_domain.com
```

Следуйте инструкциям:
- Введите email для уведомлений
- Согласитесь с условиями
- Выберите, перенаправлять ли HTTP на HTTPS (рекомендуется: Yes)

### 9.3. Автоматическое обновление сертификатов

Certbot автоматически настроит cron задачу для обновления сертификатов. Проверьте:

```bash
sudo certbot renew --dry-run
```

### 9.4. Обновление конфигурации Nginx

После установки SSL Certbot автоматически обновит конфигурацию Nginx. Проверьте:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Теперь ваше приложение доступно по HTTPS: `https://your_domain.com`

---

## 10. Настройка Telegram webhook

### 10.1. Установка webhook

Откройте в браузере или выполните через curl:

```bash
curl "https://your_domain.com/api/telegram/webhook?setWebhook=true"
```

**Ожидаемый результат:**
```json
{"ok": true, "message": "Webhook set to https://your_domain.com/api/telegram/webhook"}
```

### 10.2. Проверка webhook

```bash
curl "https://api.telegram.org/botВАШ_ТОКЕН/getWebhookInfo"
```

Вы должны увидеть информацию о настроенном webhook.

### 10.3. Тестирование бота

1. Найдите вашего бота в Telegram
2. Отправьте команду `/start`
3. Бот должен ответить
4. Проверьте логи PM2:
   ```bash
   pm2 logs telegram-seller
   ```

### 10.4. Настройка Mini App

Если вы используете Telegram Mini App:

1. Откройте [@BotFather](https://t.me/BotFather)
2. Отправьте `/myapps`
3. Выберите ваше приложение
4. Выберите "Edit" → "URL"
5. Введите: `https://your_domain.com`

---

## 11. Настройка мониторинга и логирования

### 11.1. Настройка логов PM2

Логи уже настроены в `ecosystem.config.js`. Просмотр:

```bash
# Все логи
pm2 logs telegram-seller

# Только ошибки
pm2 logs telegram-seller --err

# Только вывод
pm2 logs telegram-seller --out

# Последние 100 строк
pm2 logs telegram-seller --lines 100
```

### 11.2. Ротация логов PM2

Установите pm2-logrotate:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### 11.3. Настройка логов Nginx

Логи Nginx находятся в:
- Access: `/var/log/nginx/telegram-seller-access.log`
- Error: `/var/log/nginx/telegram-seller-error.log`

Просмотр в реальном времени:
```bash
sudo tail -f /var/log/nginx/telegram-seller-access.log
sudo tail -f /var/log/nginx/telegram-seller-error.log
```

### 11.4. Мониторинг ресурсов

```bash
# Мониторинг через PM2
pm2 monit

# Системные ресурсы
htop  # или top

# Использование диска
df -h

# Использование памяти
free -h
```

---

## 12. Безопасность

### 12.1. Настройка Firewall

Убедитесь, что открыты только необходимые порты:

```bash
# Ubuntu (UFW)
sudo ufw status verbose

# Должны быть открыты только:
# - 22/tcp (SSH)
# - 80/tcp (HTTP)
# - 443/tcp (HTTPS)
```

### 12.2. Защита .env файла

```bash
# Убедитесь, что .env защищён
sudo chmod 600 /var/www/telegram-seller/app/.env
sudo chown telegram-app:telegram-app /var/www/telegram-seller/app/.env

# Проверьте, что .env не в .gitignore
cat .gitignore | grep .env
```

### 12.3. Регулярные обновления

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y  # Ubuntu/Debian
sudo yum update -y  # CentOS/RHEL

# Обновление npm пакетов
cd /var/www/telegram-seller/app
npm audit
npm audit fix
```

### 12.4. Ограничение доступа к PostgreSQL

Убедитесь, что PostgreSQL доступен только локально:

```bash
# Проверьте конфигурацию
sudo grep -E "^listen_addresses" /etc/postgresql/*/main/postgresql.conf
# Должно быть: listen_addresses = 'localhost'
```

### 12.5. Настройка SSH ключей

Отключите вход по паролю и используйте только SSH ключи:

```bash
sudo nano /etc/ssh/sshd_config

# Установите:
PasswordAuthentication no
PubkeyAuthentication yes

sudo systemctl restart sshd
```

---

## 13. Резервное копирование

### 13.1. Резервное копирование базы данных

Создайте скрипт для резервного копирования:

```bash
sudo nano /usr/local/bin/backup-db.sh
```

Содержимое:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/telegram-seller"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="telegram_seller"
DB_USER="telegram_user"

mkdir -p $BACKUP_DIR

# Создание резервной копии
pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Удаление старых резервных копий (старше 7 дней)
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Backup created: $BACKUP_DIR/db_backup_$DATE.sql.gz"
```

Сделайте скрипт исполняемым:

```bash
sudo chmod +x /usr/local/bin/backup-db.sh
```

### 13.2. Автоматическое резервное копирование

Добавьте в cron:

```bash
sudo crontab -e

# Добавьте строку для ежедневного резервного копирования в 2:00 ночи
0 2 * * * /usr/local/bin/backup-db.sh >> /var/log/backup.log 2>&1
```

### 13.3. Восстановление из резервной копии

```bash
# Распакуйте резервную копию
gunzip < /var/backups/telegram-seller/db_backup_YYYYMMDD_HHMMSS.sql.gz | psql -U telegram_user -d telegram_seller -h localhost
```

### 13.4. Резервное копирование файлов приложения

```bash
# Создайте скрипт
sudo nano /usr/local/bin/backup-app.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/telegram-seller"
APP_DIR="/var/www/telegram-seller/app"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Резервная копия .env и других важных файлов
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz -C $APP_DIR .env ecosystem.config.js

# Удаление старых резервных копий (старше 30 дней)
find $BACKUP_DIR -name "app_backup_*.tar.gz" -mtime +30 -delete

echo "App backup created: $BACKUP_DIR/app_backup_$DATE.tar.gz"
```

```bash
sudo chmod +x /usr/local/bin/backup-app.sh
```

---

## 14. Обновление приложения

### 14.1. Режим обслуживания

Перед обновлением приложения рекомендуется включить режим обслуживания, чтобы предотвратить новые запросы от пользователей.

**Включение режима обслуживания:**

1. Войдите в админ-панель: `https://your_domain.com/admin/server`
2. Включите переключатель "Режим обслуживания"
3. При необходимости укажите сообщение для пользователей
4. Дождитесь завершения текущих запросов (1-2 минуты)

**Выключение режима обслуживания:**

1. После успешного обновления вернитесь на страницу `/admin/server`
2. Выключите переключатель "Режим обслуживания"

**Альтернативный способ (через API):**

```bash
# Включить режим обслуживания
curl -X POST https://your_domain.com/api/admin/maintenance \
  -H "Cookie: your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "message": "Система обновляется"}'

# Выключить режим обслуживания
curl -X POST https://your_domain.com/api/admin/maintenance \
  -H "Cookie: your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### 14.2. Процесс обновления

```bash
# Переключитесь на пользователя приложения
sudo su - telegram-app
cd /var/www/telegram-seller/app

# Остановите приложение
pm2 stop telegram-seller

# Создайте резервную копию текущей версии (опционально)
cp -r . ../app_backup_$(date +%Y%m%d)

# Получите последние изменения из репозитория
git pull origin main  # или ваша ветка

# Установите новые зависимости
npm install --production

# Запустите миграции (если есть)
npm run db:migrate

# Пересоберите приложение
npm run build

# Перезапустите приложение
pm2 restart telegram-seller

# Проверьте статус
pm2 status
pm2 logs telegram-seller --lines 50
```

### 14.3. Откат к предыдущей версии

Если что-то пошло не так:

```bash
cd /var/www/telegram-seller
pm2 stop telegram-seller
rm -rf app
mv app_backup_YYYYMMDD app
cd app
pm2 restart telegram-seller
```

### 14.4. Проверка работоспособности после обновления

1. Проверьте логи: `pm2 logs telegram-seller`
2. Откройте приложение в браузере
3. Протестируйте основные функции
4. Проверьте работу Telegram бота

---

## 15. Устранение неполадок

### 15.1. Приложение не запускается

**Проверьте:**
```bash
# Статус PM2
pm2 status

# Логи
pm2 logs telegram-seller --lines 100

# Проверьте .env файл
sudo cat /var/www/telegram-seller/app/.env

# Проверьте подключение к БД
psql -U telegram_user -d telegram_seller -h localhost
```

### 15.2. Ошибки подключения к базе данных

**Проверьте:**
1. PostgreSQL запущен: `sudo systemctl status postgresql`
2. Параметры подключения в `.env`
3. Пользователь БД существует и имеет права
4. База данных существует

### 15.3. Nginx возвращает 502 Bad Gateway

**Проверьте:**
1. Приложение запущено: `pm2 status`
2. Приложение слушает порт 3000: `sudo netstat -tlnp | grep 3000`
3. Конфигурация Nginx правильная: `sudo nginx -t`
4. Логи Nginx: `sudo tail -f /var/log/nginx/telegram-seller-error.log`

### 15.4. Telegram webhook не работает

**Проверьте:**
1. Webhook настроен: `curl "https://api.telegram.org/botВАШ_ТОКЕН/getWebhookInfo"`
2. URL правильный и доступен извне
3. SSL сертификат валидный
4. Логи приложения на наличие ошибок

### 15.5. Высокое использование памяти

**Решения:**
1. Увеличьте `max_memory_restart` в `ecosystem.config.js`
2. Проверьте утечки памяти в коде
3. Перезапустите приложение: `pm2 restart telegram-seller`

### 15.6. Полезные команды для диагностики

```bash
# Статус всех сервисов
sudo systemctl status nginx
sudo systemctl status postgresql
pm2 status

# Использование ресурсов
htop
df -h
free -h

# Сетевые подключения
sudo netstat -tlnp
sudo ss -tlnp

# Логи системы
sudo journalctl -xe
sudo tail -f /var/log/syslog
```

---

## Чек-лист развёртывания

Используйте этот чек-лист для проверки развёртывания:

- [ ] Сервер подготовлен и обновлён
- [ ] Node.js 18+ установлен
- [ ] PostgreSQL установлен и настроен
- [ ] Nginx установлен и настроен
- [ ] Firewall настроен правильно
- [ ] База данных создана
- [ ] Приложение клонировано и зависимости установлены
- [ ] .env файл создан и заполнен
- [ ] База данных инициализирована (миграции запущены)
- [ ] Приложение собрано (`npm run build`)
- [ ] PM2 настроен и приложение запущено
- [ ] Nginx настроен как reverse proxy
- [ ] SSL сертификат установлен
- [ ] Telegram webhook настроен
- [ ] Резервное копирование настроено
- [ ] Мониторинг и логирование настроены
- [ ] Безопасность проверена
- [ ] Приложение доступно по HTTPS
- [ ] Telegram бот работает

---

## Дополнительные ресурсы

- [Документация Next.js](https://nextjs.org/docs)
- [Документация PM2](https://pm2.keymetrics.io/docs/)
- [Документация Nginx](https://nginx.org/en/docs/)
- [Документация PostgreSQL](https://www.postgresql.org/docs/)
- [Документация Certbot](https://certbot.eff.org/docs/)

---

**Успешного развёртывания! 🚀**
