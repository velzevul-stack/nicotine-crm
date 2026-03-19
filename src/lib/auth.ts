import { cookies } from 'next/headers';
import crypto from 'crypto';

export interface Session {
  userId: string;
  shopId: string;
  telegramId: string;
}

/**
 * Получает секретный ключ для подписи сессий из переменных окружения
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || 'default-session-secret-change-in-production';
  if (process.env.NODE_ENV === 'production' && secret === 'default-session-secret-change-in-production') {
    throw new Error(
      'SESSION_SECRET must be set in production (min 32 chars). Generate: openssl rand -hex 32'
    );
  }
  return secret;
}

/**
 * Подписывает данные сессии
 */
function signSession(session: Session): string {
  const secret = getSessionSecret();
  const data = JSON.stringify(session);
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${data}:${signature}`;
}

/**
 * Проверяет подпись и извлекает данные сессии
 */
function verifySession(signedSession: string): Session | null {
  try {
    // Ищем последнее двоеточие (подпись всегда в конце)
    const lastColonIndex = signedSession.lastIndexOf(':');
    if (lastColonIndex === -1) {
      // Нет двоеточия - это старый формат без подписи
      return null;
    }
    
    const data = signedSession.substring(0, lastColonIndex);
    const signature = signedSession.substring(lastColonIndex + 1);
    
    if (!data || !signature) return null;
    
    // Проверяем, что signature выглядит как hex-строка (64 символа для SHA256)
    if (!/^[a-f0-9]{64}$/i.test(signature)) {
      // Не похоже на подпись - возможно это часть JSON
      return null;
    }

    const secret = getSessionSecret();
    const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');
    
    // Используем безопасное сравнение для предотвращения timing attacks
    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return JSON.parse(data) as Session;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const signed = c.get('session')?.value;
  if (!signed) return null;
  
  const verifiedSession = verifySession(signed);
  return verifiedSession;
}

/**
 * Создает подписанную сессию (используется в auth endpoints)
 */
export function createSignedSession(session: Session): string {
  return signSession(session);
}
