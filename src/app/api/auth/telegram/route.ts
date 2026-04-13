import { NextRequest, NextResponse } from 'next/server';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { loginWithTelegramInitData } from '@/services/auth/telegram-login.service';

export async function POST(request: NextRequest) {
  const rateLimitResponse = checkAuthRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
    }

    const result = await loginWithTelegramInitData(body);

    const res = NextResponse.json({
      user: result.user,
      shop: result.shop,
      session: result.session,
      subscriptionStatus: result.subscriptionStatus,
    });

    res.cookies.set('session', result.signedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return res;
  } catch (e) {
    console.error('[auth/telegram] Error:', e);
    return serviceErrorResponse(e, 'Internal server error');
  }
}
