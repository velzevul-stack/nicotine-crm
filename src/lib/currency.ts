/**
 * Currency formatting utilities
 */

export const CURRENCIES = [
  { code: 'BYN', symbol: 'BYN', name: 'Белорусский рубль' },
  { code: 'RUB', symbol: '₽', name: 'Российский рубль' },
  { code: 'USD', symbol: '$', name: 'Доллар США' },
  { code: 'EUR', symbol: '€', name: 'Евро' },
  { code: 'UAH', symbol: '₴', name: 'Украинская гривна' },
];

export function formatCurrency(amount: number, currencyCode: string = 'BYN'): string {
  const currency = CURRENCIES.find((c) => c.code === currencyCode) || CURRENCIES[0];
  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${currency.symbol}`;
}

export function getCurrencySymbol(currencyCode: string = 'BYN'): string {
  const currency = CURRENCIES.find((c) => c.code === currencyCode) || CURRENCIES[0];
  return currency.symbol;
}

export function formatPrice(amount: number, currencyCode: string = 'BYN'): { amount: string; symbol: string } {
  const currency = CURRENCIES.find((c) => c.code === currencyCode) || CURRENCIES[0];
  return {
    amount: amount.toString(),
    symbol: currency.symbol,
  };
}
