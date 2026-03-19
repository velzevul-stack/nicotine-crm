# Настройка Cron для уведомлений об окончании триала

## Описание

Cron задача автоматически отправляет Loss Aversion уведомления пользователям, у которых заканчивается пробный период (14 дней) в день окончания.

## Защита Endpoint

Endpoint `/api/cron/trial-end-notification` защищен несколькими способами:

1. **Vercel Cron** (автоматически) - запросы от Vercel Cron автоматически авторизованы через заголовок `x-vercel-cron`
2. **CRON_SECRET** - для внешних cron сервисов требуется секретный ключ

## Настройка для Vercel

### 1. Добавьте переменную окружения (опционально)

В Vercel Dashboard → Settings → Environment Variables добавьте:

```
CRON_SECRET=your-super-secret-key-here-min-32-chars
```

**Важно:** Используйте длинный случайный ключ (минимум 32 символа). Можно сгенерировать через:
```bash
openssl rand -hex 32
```

### 2. Файл vercel.json уже настроен

Файл `vercel.json` содержит конфигурацию cron задачи:
- **Расписание:** Каждый день в 10:00 UTC (`0 10 * * *`)
- **Endpoint:** `/api/cron/trial-end-notification`

### 3. Деплой

После деплоя на Vercel, cron задача автоматически активируется.

## Настройка для внешнего Cron сервиса

Если вы используете внешний cron сервис (например, cron-job.org, EasyCron и т.д.):

### Вариант 1: Authorization Header (рекомендуется)

```
URL: https://your-domain.com/api/cron/trial-end-notification
Method: GET или POST
Headers:
  Authorization: Bearer your-cron-secret-from-env
```

### Вариант 2: Query параметр

```
URL: https://your-domain.com/api/cron/trial-end-notification?secret=your-cron-secret-from-env
Method: GET или POST
```

### Расписание

Рекомендуется запускать **один раз в день в 10:00 UTC** (или в удобное для вас время).

Cron выражение: `0 10 * * *`

## Проверка работы

### Ручной тест (требует CRON_SECRET)

```bash
# С Authorization header
curl -H "Authorization: Bearer your-cron-secret" \
  https://your-domain.com/api/cron/trial-end-notification

# Или с query параметром
curl "https://your-domain.com/api/cron/trial-end-notification?secret=your-cron-secret"
```

### Ожидаемый ответ

```json
{
  "success": true,
  "message": "Processed 5 users",
  "timestamp": "2026-03-09T10:00:00.000Z",
  "results": {
    "total": 5,
    "sent": 5,
    "failed": 0,
    "errors": []
  }
}
```

## Безопасность

⚠️ **Важно:**

1. **Никогда не коммитьте CRON_SECRET в git** - используйте только переменные окружения
2. **Используйте длинный случайный ключ** (минимум 32 символа)
3. **Регулярно ротируйте секрет** в production
4. **Мониторьте логи** на предмет попыток несанкционированного доступа

## Мониторинг

Логи cron задачи можно посмотреть в:
- **Vercel:** Dashboard → Your Project → Functions → Logs
- **Внешний сервис:** Логи вашего cron сервиса

Endpoint логирует:
- Количество найденных пользователей
- Успешные отправки
- Ошибки отправки
- Попытки несанкционированного доступа

## Troubleshooting

### Endpoint возвращает 401 Unauthorized

1. Проверьте, что `CRON_SECRET` установлен в переменных окружения
2. Проверьте правильность секрета в запросе
3. Для Vercel Cron - проверьте, что запрос идет с правильным заголовком

### Уведомления не отправляются

1. Проверьте логи на наличие ошибок
2. Убедитесь, что `TELEGRAM_BOT_TOKEN` установлен
3. Проверьте, что у пользователей действительно заканчивается триал сегодня
4. Проверьте формат `telegramId` в базе данных

### Cron не запускается на Vercel

1. Убедитесь, что `vercel.json` находится в корне проекта
2. Проверьте синтаксис cron выражения
3. Убедитесь, что проект задеплоен на Vercel Pro план (Cron доступен только на Pro)
