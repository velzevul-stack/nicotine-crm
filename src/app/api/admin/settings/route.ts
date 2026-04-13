import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import {
  adminGetSystemSettings,
  adminPatchSystemSettings,
} from '@/services/admin/admin-system-settings.service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await adminGetSystemSettings(session.userId);
    return NextResponse.json(payload);
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = await adminPatchSystemSettings(session.userId, body);
    return NextResponse.json(payload);
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}
