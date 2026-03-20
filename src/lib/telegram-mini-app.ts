/**
 * Telegram Mini App: initData часто пустой в первый момент после загрузки iframe.
 * Ждём появления WebApp, вызываем ready()/expand(), затем — непустой initData.
 */

type TelegramWebAppLike = {
  ready: () => void;
  expand?: () => void;
  initData: string;
  /** Bot API 7.7+ — отключает вертикальные свайпы, закрывающие Mini App на iOS */
  disableVerticalSwipes?: () => void;
};

export function getTelegramWebApp(): TelegramWebAppLike | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { Telegram?: { WebApp?: TelegramWebAppLike } };
  return w.Telegram?.WebApp;
}

export function isTelegramMiniApp(): boolean {
  return Boolean(getTelegramWebApp());
}

/** Снижает случайное сворачивание Mini App при скролле списков (актуально для iPhone). */
export function applyTelegramMiniAppSwipeGuard(): void {
  try {
    getTelegramWebApp()?.disableVerticalSwipes?.();
  } catch {
    /* старые клиенты Telegram */
  }
}

const STEP_MS = 40;

/**
 * Сначала ждём объект WebApp (до webAppWaitMs), затем — непустой initData (до initDataWaitMs).
 */
export async function waitForTelegramInitData(options?: {
  webAppWaitMs?: number;
  initDataWaitMs?: number;
}): Promise<string> {
  const webAppWaitMs = options?.webAppWaitMs ?? 5000;
  const initDataWaitMs = options?.initDataWaitMs ?? 8000;
  const webAppDeadline = Date.now() + webAppWaitMs;

  let tg: TelegramWebAppLike | undefined;
  while (Date.now() < webAppDeadline) {
    tg = getTelegramWebApp();
    if (tg) break;
    await new Promise((r) => setTimeout(r, STEP_MS));
  }

  if (!tg) {
    return '';
  }

  try {
    tg.ready();
    tg.expand?.();
    tg.disableVerticalSwipes?.();
  } catch {
    /* ignore */
  }

  const dataDeadline = Date.now() + initDataWaitMs;
  while (Date.now() < dataDeadline) {
    const raw = tg.initData;
    if (typeof raw === 'string' && raw.length > 0) {
      return raw;
    }
    await new Promise((r) => setTimeout(r, STEP_MS));
  }

  return typeof tg.initData === 'string' ? tg.initData : '';
}
