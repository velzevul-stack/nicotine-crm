/**
 * URL Mini App для кнопок Web App в боте.
 */

export function getTelegramMiniAppBaseUrl(): string {
  return (process.env.TELEGRAM_MINI_APP_URL || 'https://127.0.0.1:8443').replace(/\/$/, '');
}

/** Главная Mini App (без ключа). */
export function getTelegramMiniAppRootUrl(): string {
  return `${getTelegramMiniAppBaseUrl()}/`;
}

/**
 * Страница /login с ключом в query — клиент подставит и при необходимости войдёт.
 * Ключ длиннее лимита Telegram start_param (64), поэтому не используем #tgWebAppStartParam.
 */
export function getTelegramMiniAppLoginUrl(accessKey: string): string {
  const url = new URL('login', `${getTelegramMiniAppBaseUrl()}/`);
  url.searchParams.set('accessKey', accessKey);
  return url.toString();
}
