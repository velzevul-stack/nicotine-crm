import crypto from 'crypto';

/**
 * Генерирует уникальный длинный ключ для доступа
 */
export function generateAccessKey(): string {
  const randomBytes = crypto.randomBytes(32);
  return `KEY-${randomBytes.toString('hex').toUpperCase()}`;
}

/**
 * Генерирует уникальный реферальный код
 */
export function generateReferralCode(): string {
  const randomBytes = crypto.randomBytes(8);
  return randomBytes.toString('hex').toUpperCase().substring(0, 12);
}
