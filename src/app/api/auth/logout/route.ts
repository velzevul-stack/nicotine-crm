import { NextResponse } from 'next/server';

/** Сбрасывает httpOnly-cookie сессии (ключ в localStorage очищает клиент). */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return res;
}
