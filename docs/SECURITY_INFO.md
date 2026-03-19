# Информация о безопасности

## Ключ для тестового сида (`npm run db:seed`)

Задаётся в **`.env`**: переменная **`DEV_SEED_ACCESS_KEY`** (не храните значение в репозитории). Сид создаёт/обновляет пользователя `dev-user-1` с этим ключом.

⚠️ **ВАЖНО:** В production у каждого пользователя свой ключ; реальные ключи не коммитьте.

## Защита API endpoints

Все API endpoints защищены проверкой сессии:

### Защищённые endpoints (требуют авторизации):
- `/api/inventory/*` - проверка сессии
- `/api/sales/*` - проверка сессии
- `/api/debts/*` - проверка сессии
- `/api/reports/*` - проверка сессии
- `/api/post/*` - проверка сессии
- `/api/shop/*` - проверка сессии
- `/api/stats/sync` - проверка сессии
- `/api/user/me` - проверка сессии

### Защищённые admin endpoints (требуют роль admin):
- `/api/admin/*` - проверка сессии + роль admin
- `/api/admin/stats` - проверка сессии + роль admin
- `/api/admin/users` - проверка сессии + роль admin

### Публичные endpoints:
- `/api/auth/telegram` - валидация через Telegram initData
- `/api/auth/key` - валидация accessKey
- `/api/auth/dev` - только в режиме разработки (NODE_ENV=development)

### Отключённые endpoints:
- `/api/demo/seed` - отключён, возвращает 403 (используйте `npm run db:seed`)

## Рекомендации по безопасности

1. **Не показывайте dev secret key на фронтенде** - удалено из всех UI компонентов
2. **Используйте переменные окружения** для секретных ключей
3. **Проверяйте роль пользователя** перед доступом к admin endpoints
4. **Валидируйте входные данные** на всех endpoints
5. **Используйте HTTPS** в production

## Создание администратора

Для создания администратора используйте команду:
```bash
npm run make-admin <telegramId или accessKey>
```

Пример (подставьте свой `accessKey` или `telegramId`):
```bash
npm run make-admin KEY-xxxxxxxx
```
