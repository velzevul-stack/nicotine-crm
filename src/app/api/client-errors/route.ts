import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { logClientErrorIfEnabled } from '@/services/client-errors/client-errors.service';

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const session = await getSession();
  const ua = request.headers.get('user-agent');

  try {
    await logClientErrorIfEnabled({
      body: raw,
      session: session ? { shopId: session.shopId, userId: session.userId } : null,
      userAgent: ua,
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при записи клиентской ошибки');
  }
}
