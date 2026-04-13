import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { adminGetServerInfo } from '@/services/admin/admin-server-info.service';

/** GET — сводка о процессе и БД для админки */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await adminGetServerInfo(session.userId);
    return NextResponse.json(payload);
  } catch (e) {
    console.error('Error getting server info:', e);
    return serviceErrorResponse(e, 'Failed to get server info');
  }
}
