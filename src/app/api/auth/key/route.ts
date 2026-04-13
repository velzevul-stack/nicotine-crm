import { NextRequest, NextResponse } from 'next/server';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { loginWithAccessKey } from '@/services/auth/access-key-login.service';

export async function POST(request: NextRequest) {
  const rateLimitResponse = checkAuthRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const startTime = Date.now();
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (parseErr) {
      console.error('[auth/key] Invalid JSON body:', parseErr);
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
    }

    const result = await loginWithAccessKey(body);

    const res = NextResponse.json({
      user: result.user,
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('[auth/key] Error after', Date.now() - startTime, 'ms:', msg);
    if (stack) console.error('[auth/key] stack:\n', stack);

    if (msg.includes('timeout')) {
      return NextResponse.json(
        { message: 'Request timeout. Please try again.' },
        { status: 500 },
      );
    }

    return serviceErrorResponse(e, 'Internal server error');
  }
}
