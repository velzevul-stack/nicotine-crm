import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { adminGetMaintenance, adminSetMaintenance } from '@/services/admin/admin-maintenance.service';

/** GET — статус режима обслуживания */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await adminGetMaintenance(session.userId);
    return NextResponse.json(payload);
  } catch (e) {
    console.error('Error getting maintenance mode:', e);
    return serviceErrorResponse(e, 'Failed to get maintenance mode');
  }
}

/** POST — включить/выключить режим обслуживания */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = await adminSetMaintenance(session.userId, body);
    return NextResponse.json({ success: true, ...payload });
  } catch (e) {
    console.error('Error setting maintenance mode:', e);
    return serviceErrorResponse(e, 'Failed to set maintenance mode');
  }
}
