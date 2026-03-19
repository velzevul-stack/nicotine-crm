/**
 * Next.js instrumentation — вызывается при старте сервера.
 * В production проверяет обязательные переменные окружения.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production') {
    const { checkProductionEnv } = await import('./lib/env-check');
    checkProductionEnv();
  }
}
