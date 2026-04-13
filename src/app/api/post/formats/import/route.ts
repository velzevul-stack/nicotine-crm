import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { importPostFormat } from '@/services/post/post-formats.service';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const format = await importPostFormat(session, body);
    return NextResponse.json({ format }, { status: 201 });
  } catch (e) {
    console.error('Error importing post format:', e);
    return serviceErrorResponse(e, 'Failed to import format');
  }
}
