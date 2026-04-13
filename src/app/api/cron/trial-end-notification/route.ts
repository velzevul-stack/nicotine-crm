import { NextRequest, NextResponse } from 'next/server';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { isCronRequestAuthorized } from '@/services/cron/cron-auth';
import { runTrialEndNotifications } from '@/services/cron/trial-end-notification.service';

/**
 * Loss Aversion: уведомления пользователям с окончанием триала сегодня.
 *
 * Авторизация: `x-vercel-cron` или `CRON_SECRET` в `Authorization: Bearer` / `?secret=`.
 */
export async function GET(request: NextRequest) {
  const authCtx = {
    getHeader: (name: string) => request.headers.get(name),
    url: request.url,
  };

  if (!isCronRequestAuthorized(authCtx)) {
    console.warn('[Trial End Notification] Unauthorized request attempt', {
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });
    return NextResponse.json(
      {
        success: false,
        message: 'Unauthorized. This endpoint requires authentication.',
      },
      { status: 401 },
    );
  }

  try {
    const payload = await runTrialEndNotifications();
    return NextResponse.json(payload);
  } catch (error: unknown) {
    console.error('[Trial End Notification] Error:', error);
    return serviceErrorResponse(error, 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
