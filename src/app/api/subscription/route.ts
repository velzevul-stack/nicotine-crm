import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { getSubscriptionSummary } from '@/services/subscription/subscription.service';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await getSubscriptionSummary({ userId: session.userId });
    return NextResponse.json(data);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при загрузке подписки');
  }
}
