import crypto from 'crypto';

/** Данные сессии в cookie (без зависимостей от next/headers — для API routes). */
export interface Session {
  userId: string;
  shopId: string;
  telegramId: string;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || 'default-session-secret-change-in-production';
  if (process.env.NODE_ENV === 'production' && secret === 'default-session-secret-change-in-production') {
    throw new Error(
      'SESSION_SECRET must be set in production (min 32 chars). Generate: openssl rand -hex 32'
    );
  }
  return secret;
}

function signSession(session: Session): string {
  const secret = getSessionSecret();
  const data = JSON.stringify(session);
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${data}:${signature}`;
}

/**
 * Проверяет подпись и извлекает данные сессии (используется в getSession).
 */
export function verifySession(signedSession: string): Session | null {
  try {
    const lastColonIndex = signedSession.lastIndexOf(':');
    if (lastColonIndex === -1) {
      return null;
    }

    const data = signedSession.substring(0, lastColonIndex);
    const signature = signedSession.substring(lastColonIndex + 1);

    if (!data || !signature) return null;

    if (!/^[a-f0-9]{64}$/i.test(signature)) {
      return null;
    }

    const secret = getSessionSecret();
    const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');

    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return JSON.parse(data) as Session;
    }
    return null;
  } catch {
    return null;
  }
}

/** Подписанная строка для Set-Cookie (без импорта next/headers). */
export function createSignedSession(session: Session): string {
  return signSession(session);
}
