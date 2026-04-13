import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import {
  adminCreateGlobalPostFormat,
  adminDeleteGlobalPostFormat,
  adminListGlobalPostFormats,
  adminUpdateGlobalPostFormat,
} from '@/services/admin/admin-global-formats.service';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formats = await adminListGlobalPostFormats(session.userId);
    return NextResponse.json({ formats });
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const format = await adminCreateGlobalPostFormat(session.userId, body);
    return NextResponse.json({ success: true, format });
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
    const format = await adminUpdateGlobalPostFormat(session.userId, body);
    return NextResponse.json({ success: true, format });
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get('id') ?? '';

  try {
    await adminDeleteGlobalPostFormat(session.userId, id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}
