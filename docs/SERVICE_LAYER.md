# Сервисный слой (кратко)

Цель: бизнес-логика в `src/services/*`, HTTP-роуты — только auth, чтение запроса, вызов сервиса, ответ.

## Каталоги

| Область | Файлы |
|--------|--------|
| Продажи | `services/sales/sales.service.ts`, `sales.repository.ts`, `sales.validators.ts`, `*.policy.ts` |
| Инвентарь | `inventory.service`, `inventory.repository`, `inventory.mapper`, `inventory.shared`, сервисы/валидаторы: `product`, `flavor`, `stock`, `stock-batch`, `movements`, `categories`, `brand`, `brand-photo`, `format` |
| Резервы | `services/reserves/reserves.service.ts`, `reserves.validators.ts`, `reservation-sell.validators.ts` |
| Резервации (продажи / API) | `services/reservations/sale-reservations.service.ts` |
| Магазин | `services/shop/shop.service.ts`, `shop.validators.ts`, `shop-settings.validators.ts` |
| Карты оплаты | `services/cards/cards.service.ts`, `cards.validators.ts` |
| Долги | `services/debts/debts.service.ts`, `debts.validators.ts` |
| Подписка (виджет) | `services/subscription/subscription.service.ts` |
| Рефералы (страница) | `services/referrals/referrals-page.service.ts` |
| Клиентские ошибки | `services/client-errors/client-errors.service.ts`, `client-errors.validators.ts` |
| Статистика | `services/stats/user-stats-sync.service.ts`, `user-stats-sync.validators.ts` |
| Платежи (NowPayments) | `services/payments/nowpayments-subscription-invoice.service.ts`, `nowpayments-ipn.service.ts` |
| Профиль | `services/profile/clear-shop-data.service.ts` |
| Отчёты | `services/reports/reports.service.ts`, `reports.repository.ts`, `reports.aggregator.ts`, `reports.constants.ts` |
| Общее | `services/common/app-error.ts`, `domain-errors.ts`, `transaction.ts`, `result.ts`, `service-context.ts`, `stock-movement.gateway.ts` |

## Ошибки и HTTP

- Доменные ошибки наследуют `AppError` (`domain-errors.ts`).
- Роуты мапят исключение в ответ через `serviceErrorResponse` (`src/lib/api/service-error-response.ts`).

## Движения остатков

- API и сценарии приложения вызывают `logStockMovement` / `resolveProductUiName` из `services/common/stock-movement.gateway.ts` (реализация остаётся в `lib/stock-movement-log.ts`).
- Код в `src/lib/*`, который не должен тянуть `services`, по-прежнему может импортировать `lib/stock-movement-log` напрямую (например, `lib/inventory/stock-patch.ts`).

## Транзакции и pg

- Не запускать несколько `query()` параллельно (`Promise.all`) внутри одного `EntityManager` / колбэка `ds.transaction` — предупреждение node-pg. Для чтений без атомарности — параллель на `DataSource` без транзакции или последовательные `await` внутри транзакции.
