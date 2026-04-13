/**
 * DEV-only: create session without Telegram initData.
 * Uses the same DB user as Telegram mini app for wendigo (WENDIGO_TELEGRAM_ID), so web and app share one shop.
 * Only works when NODE_ENV=development.
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { createDevWendigoSession } from '@/services/auth/dev-wendigo-session.service';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ message: 'Not available' }, { status: 403 });
  }

  const rateLimitResponse = checkAuthRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const result = await createDevWendigoSession();

    const res = NextResponse.json({
      user: result.user,
      shop: result.shop,
      session: result.session,
    });

    res.cookies.set('session', result.signedSession, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return res;
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}
