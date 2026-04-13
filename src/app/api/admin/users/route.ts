import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import {
  adminDeleteUser,
  adminPatchUser,
  adminSearchUsers,
} from '@/services/admin/admin-users.service';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const search = request.nextUrl.searchParams.get('search') || '';
    const payload = await adminSearchUsers(session.userId, search);
    return NextResponse.json(payload);
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await adminPatchUser(session.userId, body);
    return NextResponse.json({ success: true, user: result.user });
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId } = await request.json();
    await adminDeleteUser(session.userId, userId);
    return NextResponse.json({ success: true });
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}
