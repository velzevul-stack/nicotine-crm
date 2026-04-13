# Техническое задание: Разделение бизнес-логики на сервисы

## 1. Цель

Снизить сложность API-роутов и сделать бизнес-логику переиспользуемой, тестируемой и безопасной за счет выделения сервисного слоя (Application/Domain Services) с явными контрактами.

---

## 2. Проблема текущей реализации

На текущий момент часть критичной логики сосредоточена в API-роутах:

- `src/app/api/sales/route.ts`
- `src/app/api/sales/[id]/route.ts`
- `src/app/api/inventory/route.ts`
- `src/app/api/reports/route.ts`

Типовые признаки:
- роуты одновременно делают валидацию, авторизацию, бизнес-правила и работу с БД;
- тяжелые транзакции и сайд-эффекты (например, движение остатков) находятся внутри route handlers;
- повторяемые вычисления (наличие товара, суммы, правила резервов, агрегации отчетов) не оформлены как отдельные доменные операции;
- высокая стоимость внесения изменений и риск регрессий.

---

## 3. Целевая архитектура

### 3.1. Слои

1. **API layer (Transport)**
   - только HTTP-аспекты: чтение params/body, вызов auth, вызов сервиса, маппинг ошибок в HTTP.
2. **Application services**
   - оркестрация use-case операций (создать продажу, обновить продажу, построить отчет и т.п.).
3. **Domain services / policies**
   - бизнес-правила: доступность остатков, резервы, расчет сумм, переходы статусов, правила оплаты.
4. **Infrastructure (repositories/gateways)**
   - доступ к БД/внешним сервисам (TypeORM, telegram, платежки и т.д.).

### 3.2. Принципы

- Thin Controllers: в route.ts не более 20-40 строк «смысла», без бизнес-ветвлений.
- Явные DTO/контракты для входа/выхода сервисов.
- Ошибки бизнес-уровня через типизированные доменные исключения.
- Транзакция открывается в сервисе use-case, а не размазана по роуту.
- Вся логика изменений остатков выполняется в одном доменном модуле.

---

## 4. Целевая структура каталогов

```text
src/
  services/
    sales/
      sales.service.ts
      sales.types.ts
      sales.errors.ts
      sales.validators.ts
      sales.repository.ts
      stock-allocation.policy.ts
      pricing.policy.ts
    inventory/
      inventory.service.ts
      inventory.types.ts
      inventory.repository.ts
      inventory.mapper.ts
    reports/
      reports.service.ts
      reports.types.ts
      reports.repository.ts
      reports.aggregator.ts
    common/
      app-error.ts
      result.ts
      transaction.ts
```

Примечание: допускается размещение в `src/lib/services/*`, если это лучше соответствует текущему стилю проекта.

---

## 5. Объем первой волны рефакторинга (MVP)

### 5.1. Sales domain (обязательно)

Роуты:
- `src/app/api/sales/route.ts`
- `src/app/api/sales/[id]/route.ts`

Выделить сервисы use-case:
- `createSale(input, context)`
- `getSaleById(saleId, context)`
- `updateSale(saleId, input, context)`
- `deleteSale(saleId, context)`

Выделить доменные правила:
- `pricing.policy`: расчет `totalAmount`, `discountAmount`, `finalAmount`, split/cash/card/debt;
- `stock-allocation.policy`: проверка доступности, резерв, отмена резерва, списание, возврат;
- `reservation.policy`: правила срока резерва и валидности.

Сайд-эффекты:
- `logStockMovement` вызывается сервисом через отдельный gateway-интерфейс.

### 5.2. Inventory read model (обязательно)

Роут:
- `src/app/api/inventory/route.ts`

Выделить:
- `inventory.service.getInventorySnapshot(filters, context)`
- mapper для формирования `items/categories/brands/productFormats/flavors`.

Требование:
- фильтрация и сборка ответа вынесены из route.ts в сервис/mapper.

### 5.3. Reports read model (обязательно)

Роут:
- `src/app/api/reports/route.ts`

Выделить:
- `reports.service.buildPeriodReport(filters, context)`
- `reports.aggregator` для группировок по датам, картам, типам оплат, резервациям.

---

## 6. Контракты и типы

### 6.1. Контекст вызова сервиса

Единый `ServiceContext`:
- `userId: string`
- `shopId: string`
- `requestId?: string`
- `now?: Date` (для тестируемости времени)

### 6.2. Ошибки

Ввести базовую иерархию:
- `AppError(code, message, details?)`
- `ValidationError`
- `ForbiddenError`
- `NotFoundError`
- `ConflictError`
- `InsufficientStockError`

В API-слое сделать единый mapper `AppError -> HTTP status`.

### 6.3. Валидация

- Zod-схемы валидации входа остаются, но размещаются рядом с сервисом (`*.validators.ts`) или в модуле API-входа.
- После парсинга API передает в сервис уже типизированный DTO.

---

## 7. Требования к транзакциям и консистентности

1. Любая операция изменения продажи выполняется внутри одной транзакции.
2. Блокировки (`pessimistic_write`) по остаткам инкапсулировать на уровне repository/policy.
3. Запретить прямую модификацию `StockItem` из route.ts.
4. Все переходы состояний (`reservation -> sale`, `sale -> deleted`, редактирование позиций) должны быть покрыты сервисными тест-кейсами.

---

## 8. Изменения в API-роутах

Для каждого целевого route.ts:

1. Оставить:
   - auth/getSession;
   - чтение request params/body;
   - вызов соответствующего service метода;
   - возврат JSON.
2. Убрать из route.ts:
   - расчет сумм;
   - управление остатками;
   - агрегации отчетов;
   - сложные ветвления по payment/reservation.

---

## 9. Нефункциональные требования

1. Поведение API не должно измениться для клиента (контракты response совместимы).
2. Время ответа не хуже текущего более чем на 10% на горячих endpoint.
3. Логи ошибок должны сохранять информативность (код ошибки + контекст).
4. Код сервисов покрыт unit-тестами не ниже 70% по веткам в ключевых модулях `sales`/`inventory`/`reports`.

---

## 10. План внедрения

### Этап 1. Базовая инфраструктура сервисного слоя
- Создать каталоги `services/*`.
- Добавить базовые ошибки и mapper ошибок.
- Ввести `ServiceContext`.

### Этап 2. Рефакторинг Sales
- Вынести pricing/stock/reservation правила в policy-модули.
- Создать `sales.service`.
- Подключить `POST/PATCH/DELETE/GET` sales роуты к сервису.

### Этап 3. Рефакторинг Inventory (read)
- Вынести построение inventory snapshot и фильтрацию.
- Упростить `inventory/route.ts`.

### Этап 4. Рефакторинг Reports (read)
- Вынести period/window логику и агрегацию.
- Упростить `reports/route.ts`.

### Этап 5. Тесты и регрессия
- Unit-тесты policy и service.
- Smoke-интеграции на ключевые API сценарии.

---

## 11. Критерии приемки

1. В `sales`, `inventory`, `reports` route.ts отсутствует бизнес-логика уровня домена.
2. Сервисный слой покрывает все ключевые сценарии:
   - создание/редактирование/удаление продажи;
   - резерв и снятие резерва;
   - проверка остатков;
   - формирование отчетов по диапазону дат.
3. Ошибки сервиса типизированы и корректно маппятся в HTTP.
4. Поведение API и формат ответов для фронтенда не регресснули.
5. Пройдены тесты и ручная проверка критичных пользовательских сценариев.

---

## 12. Риски и меры

- **Риск**: незаметное изменение текущей логики остатков при рефакторинге.
  - **Мера**: golden-tests на сценарии продаж/резервов + сравнение до/после.
- **Риск**: дублирование логики между старыми route и новыми сервисами на переходном этапе.
  - **Мера**: миграция endpoint-by-endpoint, быстрое удаление устаревших веток.
- **Риск**: рост времени ответа из-за избыточных абстракций.
  - **Мера**: профилирование hot-path endpoint после каждого этапа.

---

## 13. Definition of Done

- Реализован сервисный слой для Sales/Inventory/Reports.
- API-роуты сведены к transport-обертке.
- Бизнес-правила изолированы в сервисах/policy-модулях.
- Добавлены тесты и документация по структуре сервисов.
- Команда может расширять правила без правок в route.ts.
