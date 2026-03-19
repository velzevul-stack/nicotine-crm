# SQL команды для проверки базы данных

## Подключение к PostgreSQL

### Windows (PowerShell или CMD)
```bash
psql -U postgres -d telegram_seller
```

Если запрашивает пароль, введите пароль пользователя postgres.

### Альтернативный способ (если psql не в PATH)
```bash
# Найдите путь к psql (обычно в Program Files)
cd "C:\Program Files\PostgreSQL\15\bin"
.\psql.exe -U postgres -d telegram_seller
```

## Полезные SQL запросы

### 1. Проверить пользователей и их ключи доступа
```sql
SELECT id, "telegramId", "firstName", "username", "accessKey", "isActive" 
FROM users 
ORDER BY "createdAt" DESC;
```

### 2. Найти пользователя по ключу доступа
```sql
SELECT id, "telegramId", "firstName", "username", "accessKey", "isActive" 
FROM users 
WHERE "accessKey" LIKE '%dev-secret-key%';
```

### 3. Найти пользователя по точному ключу (без учета регистра)
```sql
SELECT id, "telegramId", "firstName", "username", "accessKey", "isActive" 
FROM users 
WHERE LOWER("accessKey") = LOWER('dev-secret-key-123');
```

### 4. Проверить все ключи доступа в системе
```sql
SELECT "accessKey", COUNT(*) as count 
FROM users 
WHERE "accessKey" IS NOT NULL 
GROUP BY "accessKey";
```

### 5. Обновить ключ доступа для пользователя (если нужно)
```sql
-- ВНИМАНИЕ: Замените 'user-id-here' на реальный ID пользователя
UPDATE users 
SET "accessKey" = 'dev-secret-key-123' 
WHERE id = 'user-id-here';
```

### 6. Активировать пользователя (если isActive = false)
```sql
-- ВНИМАНИЕ: Замените 'user-id-here' на реальный ID пользователя
UPDATE users 
SET "isActive" = true 
WHERE id = 'user-id-here';
```

### 7. Проверить связь пользователя с магазином
```sql
SELECT 
  u.id as user_id,
  u."telegramId",
  u."accessKey",
  u."isActive",
  us."shopId",
  us."roleInShop",
  s.name as shop_name
FROM users u
LEFT JOIN user_shops us ON u.id = us."userId"
LEFT JOIN shops s ON us."shopId" = s.id
WHERE u."accessKey" LIKE '%dev-secret-key%';
```

### 8. Создать тестового пользователя с известным ключом
```sql
INSERT INTO users (
  id,
  "telegramId",
  "firstName",
  "username",
  "role",
  "accessKey",
  "subscriptionStatus",
  "trialEndsAt",
  "isActive",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'test-user-' || extract(epoch from now())::text,
  'Test',
  'test_user',
  'seller',
  'dev-secret-key-123',
  'trial',
  NOW() + INTERVAL '7 days',
  true,
  NOW(),
  NOW()
);
```

## Выход из psql
```sql
\q
```

## Другие полезные команды psql

```sql
-- Показать все таблицы
\dt

-- Показать структуру таблицы users
\d users

-- Показать все базы данных
\l

-- Переключиться на другую базу данных
\c database_name
```
