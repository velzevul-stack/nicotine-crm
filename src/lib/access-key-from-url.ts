const SESSION_KEY = 'psp_login_access_key_from_url';
const BRIDGE_FLAG = 'psp_login_access_key_bridge';

function stripAccessKeyQueryFromLocation(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has('accessKey') && !params.has('key')) return;
  params.delete('accessKey');
  params.delete('key');
  const q = params.toString();
  const path = `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', path);
}

/**
 * Ключ из ?accessKey= или ?key= для автозаполнения при открытии Mini App из бота.
 * Убирает query из адреса. Флаг bridge нужен для второго mount в React Strict Mode.
 */
export function takeAccessKeyFromUrlForLogin(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const raw = params.get('accessKey') ?? params.get('key');
  if (raw?.trim()) {
    const key = raw.trim();
    stripAccessKeyQueryFromLocation();
    sessionStorage.setItem(SESSION_KEY, key);
    sessionStorage.setItem(BRIDGE_FLAG, '1');
    return key;
  }

  if (sessionStorage.getItem(BRIDGE_FLAG) === '1') {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached?.trim()) {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(BRIDGE_FLAG);
      return cached.trim();
    }
    sessionStorage.removeItem(BRIDGE_FLAG);
  }

  return null;
}

export function clearAccessKeyFromUrlSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(BRIDGE_FLAG);
}

/** Предотвращает двойной auto-login при двух подряд useEffect в dev (Strict Mode). */
let lastAttemptedNavKeyAutoLogin: string | null = null;

export function tryMarkNavKeyAutoLoginAttempt(key: string): boolean {
  if (lastAttemptedNavKeyAutoLogin === key) return false;
  lastAttemptedNavKeyAutoLogin = key;
  return true;
}

export function resetNavKeyAutoLoginAttempt(): void {
  lastAttemptedNavKeyAutoLogin = null;
}
