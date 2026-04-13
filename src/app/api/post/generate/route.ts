import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { generatePostText } from '@/services/post/post-generate.service';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const result = await generatePostText(session, body);
    return NextResponse.json(result);
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}
