import { cookies } from 'next/headers';
import { verifySession, type Session } from '@/lib/session-token';

export type { Session } from '@/lib/session-token';

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const signed = c.get('session')?.value;
  if (!signed) return null;

  const verifiedSession = verifySession(signed);
  return verifiedSession;
}
