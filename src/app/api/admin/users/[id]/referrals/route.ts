import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { adminListReferralsByReferrer } from '@/services/admin/admin-user-referrals.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await adminListReferralsByReferrer(session.userId, id);
    return NextResponse.json(payload);
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}
