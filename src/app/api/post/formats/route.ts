import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { createPostFormat, listPostFormats } from '@/services/post/post-formats.service';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const formats = await listPostFormats(session.shopId);
    return NextResponse.json({ formats });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[GET /api/post/formats] Error:', err.message, err.stack);
    return serviceErrorResponse(error, 'Internal Server Error');
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const format = await createPostFormat(session, body);
    return NextResponse.json({ format }, { status: 201 });
  } catch (e) {
    console.error('Error creating post format:', e);
    return serviceErrorResponse(e, 'Failed to create format');
  }
}
