/** Имя бота без @ (deeplink t.me/...) */
export const TELEGRAM_BOT_USERNAME_DEFAULT = 'nicotinecrm_bot';

function stripAt(u: string): string {
  return u.replace(/^@/, '').trim();
}

/** Сервер, cron, скрипты: TELEGRAM_BOT_USERNAME в .env при необходимости переопределяет */
export function getTelegramBotUsername(): string {
  const fromEnv = process.env.TELEGRAM_BOT_USERNAME?.trim();
  return stripAt(fromEnv || TELEGRAM_BOT_USERNAME_DEFAULT);
}

/**
 * Клиент (браузер): для переопределения добавьте NEXT_PUBLIC_TELEGRAM_BOT_USERNAME в .env
 */
export function getTelegramBotUsernamePublic(): string {
  const fromEnv = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim();
  return stripAt(fromEnv || TELEGRAM_BOT_USERNAME_DEFAULT);
}
