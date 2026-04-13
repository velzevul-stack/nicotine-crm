import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { createPostFormatSuggestion } from '@/services/post/post-format-suggestion.service';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await createPostFormatSuggestion(session, body);
    return NextResponse.json({ success: true, suggestion: result.suggestion });
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}
