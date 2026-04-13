import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { adminListUserStats } from '@/services/admin/admin-user-stats.service';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await adminListUserStats(session.userId);
    return NextResponse.json(payload);
  } catch (e) {
    console.error('Error getting admin stats:', e);
    return serviceErrorResponse(e, 'Failed to get stats');
  }
}
