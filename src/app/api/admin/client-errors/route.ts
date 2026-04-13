import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { adminListClientErrors } from '@/services/admin/admin-client-errors.service';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') ?? '30', 10)));
  const offset = Math.max(0, parseInt(request.nextUrl.searchParams.get('offset') ?? '0', 10));

  try {
    const payload = await adminListClientErrors(session.userId, { limit, offset });
    return NextResponse.json(payload);
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}
