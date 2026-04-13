import crypto from 'crypto';

export type ParsedTelegramInit = {
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  startParam?: string;
};

/** Валидация подписи Telegram WebApp `initData` (login widget / Mini App). */
export function parseTelegramWebAppInitData(
  initData: string,
  botToken: string,
): ParsedTelegramInit | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (computed !== hash) return null;
  const userStr = params.get('user');
  if (!userStr) return null;
  try {
    const user = JSON.parse(decodeURIComponent(userStr));
    const startParamRaw = params.get('start_param');
    const startParam =
      startParamRaw && startParamRaw.trim() ? startParamRaw.trim() : undefined;
    return {
      telegramId: String(user.id),
      firstName: user.first_name ?? null,
      lastName: user.last_name ?? null,
      username: user.username ?? null,
      ...(startParam ? { startParam } : {}),
    };
  } catch {
    return null;
  }
}
