/** Минимальный контекст запроса для проверки cron (без зависимости от Next.js). */
export type CronRequestAuth = {
  getHeader(name: string): string | null;
  url: string;
};

/**
 * Vercel Cron (`x-vercel-cron`) или `CRON_SECRET` в `Authorization: Bearer` / `?secret=`.
 */
export function isCronRequestAuthorized(ctx: CronRequestAuth): boolean {
  if (ctx.getHeader('x-vercel-cron')) {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('[cron] CRON_SECRET not set, only Vercel Cron requests allowed');
    return false;
  }

  const authHeader = ctx.getHeader('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  const url = new URL(ctx.url);
  if (url.searchParams.get('secret') === cronSecret) {
    return true;
  }

  return false;
}
