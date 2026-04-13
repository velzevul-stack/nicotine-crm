import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { syncUserUsageStats } from '@/services/stats/user-stats-sync.service';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await syncUserUsageStats({ userId: session.userId }, body);
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err, 'Не удалось синхронизировать статистику');
  }
}
