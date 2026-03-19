/**
 * Проверка обязательных переменных окружения в production.
 * Вызывается при старте сервера (instrumentation.ts).
 * При невалидной конфигурации — выбрасывает ошибку (приложение не стартует).
 */
export function checkProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const errors: string[] = [];

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    errors.push(
      'SESSION_SECRET: обязателен в production, минимум 32 символа. Сгенерируйте: openssl rand -hex 32'
    );
  }
  if (sessionSecret === 'your-session-secret-min-32-chars-change-in-production') {
    errors.push('SESSION_SECRET: нельзя использовать значение по умолчанию из .env.example');
  }

  if (!process.env.DB_HOST) errors.push('DB_HOST: обязателен');
  if (!process.env.DB_USER) errors.push('DB_USER: обязателен');
  if (!process.env.DB_PASSWORD) errors.push('DB_PASSWORD: обязателен');
  if (!process.env.DB_NAME) errors.push('DB_NAME: обязателен');

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    errors.push('TELEGRAM_BOT_TOKEN: обязателен для авторизации и webhook');
  }

  if (!process.env.TELEGRAM_MINI_APP_URL) {
    errors.push(
      'TELEGRAM_MINI_APP_URL: обязателен (URL Mini App, например https://your-domain.com)'
    );
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.length < 32) {
    errors.push(
      'CRON_SECRET: обязателен в production для /api/cron/* (минимум 32 символа). Сгенерируйте: openssl rand -hex 32'
    );
  }
  if (cronSecret === 'your-cron-secret-key-min-32-chars') {
    errors.push('CRON_SECRET: нельзя использовать значение по умолчанию из .env.example');
  }

  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret || webhookSecret.length < 32) {
    errors.push(
      'TELEGRAM_WEBHOOK_SECRET: обязателен в production для защиты webhook (минимум 32 символа). Сгенерируйте: openssl rand -hex 32'
    );
  }
  if (webhookSecret === 'your-webhook-secret-min-32-chars') {
    errors.push('TELEGRAM_WEBHOOK_SECRET: нельзя использовать значение по умолчанию из .env.example');
  }

  if (errors.length > 0) {
    throw new Error(
      `[env-check] Production: невалидная конфигурация:\n${errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }
}
